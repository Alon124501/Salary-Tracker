const nodemailer = require('nodemailer');
const { z } = require('zod');
const Anthropic = require('@anthropic-ai/sdk');
const supabase = require('../supabase');
const { sendPushToAdmins } = require('./webPush');
const { graphConfigured, sendMail } = require('./msGraph');

// Supplier reorder agent. A rule decides WHEN to reorder (stock_qty <= reorder_threshold);
// Claude only SUGGESTS a quantity from recent consumption. Drafts are never sent to a
// supplier automatically — an admin approves each one from the dashboard.

const ADMIN_EMAIL = 'alonm@mpcheck.co.il';
const HISTORY_DAYS = 90;
const AI_MODEL = 'claude-opus-5-5';
// Supplier-facing name: suppliers know the company (MPCHECK), not the app (Medical Pay)
const COMPANY_NAME = 'MPCHECK';
const SIGNATURE_NAME = 'אלון מועלם';

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ timeout: 60_000, maxRetries: 1 })
  : null;

function supplierKey(item) {
  return item.supplier_email || item.supplier_whatsapp || item.supplier_company_id
    || item.supplier_contact_name || 'ספק לא מוגדר';
}

function mailTransport() {
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;
  if (!gmailUser || !gmailPass) return null;
  return {
    from: `Medical Pay <${gmailUser}>`,
    transporter: nodemailer.createTransport({ service: 'gmail', auth: { user: gmailUser, pass: gmailPass } }),
  };
}

// Stock-unit consumption per catalog item per week, from fulfilled employee orders.
async function loadConsumption(catalogIds) {
  const since = new Date(Date.now() - HISTORY_DAYS * 86400_000).toISOString();
  const { data, error } = await supabase
    .from('equipment_orders')
    .select('items, completed_at')
    .eq('status', 'completed')
    .gte('completed_at', since);
  if (error) throw new Error(error.message);

  const byItem = Object.fromEntries(catalogIds.map(id => [id, {}]));
  for (const order of data || []) {
    const week = Math.floor((Date.now() - new Date(order.completed_at).getTime()) / (7 * 86400_000));
    for (const line of order.items || []) {
      if (!byItem[line.catalog_id]) continue;
      byItem[line.catalog_id][week] = (byItem[line.catalog_id][week] || 0) + Number(line.quantity || 0);
    }
  }
  const weeks = Math.ceil(HISTORY_DAYS / 7);
  // index 0 = oldest week, last = current week
  return Object.fromEntries(Object.entries(byItem).map(([id, w]) =>
    [id, Array.from({ length: weeks }, (_, i) => w[weeks - 1 - i] || 0)]));
}

const SuggestionSchema = z.object({
  suggested_boxes: z.number().int().positive(),
  reason: z.string().min(1).max(500),
});

const SUGGESTION_JSON_SCHEMA = {
  type: 'object',
  properties: {
    suggested_boxes: { type: 'integer', description: 'כמות הקרטונים המומלצת להזמנה' },
    reason: { type: 'string', description: 'הסבר קצר בעברית (משפט או שניים)' },
  },
  required: ['suggested_boxes', 'reason'],
  additionalProperties: false,
};

// Returns { suggested_boxes, reason } or null (no key, no history, API failure, refusal).
// Null means the draft simply keeps the admin's rule quantity.
async function suggestQuantity(item, weeklyUsage) {
  if (!anthropic) return null;
  if (!weeklyUsage.some(n => n > 0)) return null;

  const unitsPerBox = item.stock_unit === 'unit' ? (item.units_per_box || 1) : 1;
  const prompt = [
    'אתה עוזר לניהול מלאי ציוד רפואי מתכלה בחברה קטנה. החלט כמה קרטונים להזמין מהספק.',
    `פריט: ${item.name}`,
    `יחידת מלאי: ${item.stock_unit === 'unit' ? 'יחידה בודדת' : 'קרטון'}`,
    `יחידות בקרטון: ${unitsPerBox}`,
    `מלאי נוכחי (ביחידות מלאי): ${item.stock_qty}`,
    `סף הזמנה חוזרת (ביחידות מלאי): ${item.reorder_threshold}`,
    `כמות ברירת מחדל שהמנהל הגדיר: ${item.reorder_qty_boxes} קרטונים`,
    `צריכה שבועית ב-${weeklyUsage.length} השבועות האחרונים (ביחידות מלאי, מהישן לחדש): ${weeklyUsage.join(', ')}`,
    '',
    'המטרה: מלאי שיספיק לכ-4 שבועות קדימה מעל הסף, בלי להזמין יותר מדי.',
    'אם אין סיבה ברורה לסטות מכמות ברירת המחדל, החזר אותה. כתוב את ההסבר בעברית.',
  ].join('\n');

  try {
    const response = await anthropic.beta.messages.create({
      model: AI_MODEL,
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: {
        effort: 'low',
        format: { type: 'json_schema', schema: SUGGESTION_JSON_SCHEMA },
      },
      messages: [{ role: 'user', content: prompt }],
    });
    if (response.stop_reason !== 'end_turn') {
      console.error('[reorder] AI suggestion stopped early:', response.stop_reason);
      return null;
    }
    const text = response.content.find(b => b.type === 'text')?.text;
    const parsed = SuggestionSchema.safeParse(JSON.parse(text));
    if (!parsed.success) {
      console.error('[reorder] AI suggestion failed validation:', parsed.error.issues[0]?.message);
      return null;
    }
    return parsed.data;
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      console.error(`[reorder] AI suggestion API error ${err.status}:`, err.message);
    } else {
      console.error('[reorder] AI suggestion failed:', err.message);
    }
    return null;
  }
}

// Finds low-stock items not already in an open supplier order and drafts orders,
// grouped one per supplier. Returns { drafted: [{ order_id, supplier_key, items }] }.
async function runStockCheck() {
  const { data: catalog, error: catErr } = await supabase
    .from('equipment_catalog')
    .select('*')
    .not('reorder_threshold', 'is', null);
  if (catErr) throw new Error(catErr.message);

  const low = (catalog || []).filter(i =>
    i.stock_qty <= i.reorder_threshold && Number(i.reorder_qty_boxes) > 0);
  if (!low.length) return { drafted: [] };

  // Skip items already in a draft or sent (not yet received) order
  const { data: openOrders, error: openErr } = await supabase
    .from('supplier_orders')
    .select('id, supplier_key, status, supplier_order_items(catalog_id)')
    .in('status', ['draft', 'sent']);
  if (openErr) throw new Error(openErr.message);

  const alreadyOrdered = new Set(
    (openOrders || []).flatMap(o => o.supplier_order_items.map(i => i.catalog_id)));
  const toOrder = low.filter(i => !alreadyOrdered.has(i.id));
  if (!toOrder.length) return { drafted: [] };

  const consumption = await loadConsumption(toOrder.map(i => i.id));

  const groups = new Map();
  for (const item of toOrder) {
    const key = supplierKey(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }

  const drafted = [];
  for (const [key, items] of groups) {
    let orderId = (openOrders || []).find(o => o.status === 'draft' && o.supplier_key === key)?.id;
    if (!orderId) {
      const s = items[0];
      const { data: order, error } = await supabase
        .from('supplier_orders')
        .insert({
          supplier_key: key,
          supplier_contact_name: s.supplier_contact_name,
          supplier_email: s.supplier_email,
          supplier_whatsapp: s.supplier_whatsapp,
          supplier_phone: s.supplier_phone,
          supplier_company_id: s.supplier_company_id,
        })
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      orderId = order.id;
    }

    const lines = await Promise.all(items.map(async item => {
      const ai = await suggestQuantity(item, consumption[item.id] || []);
      return {
        order_id: orderId,
        catalog_id: item.id,
        name: item.name,
        sku: item.sku,
        rule_qty_boxes: item.reorder_qty_boxes,
        ai_qty_boxes: ai?.suggested_boxes ?? null,
        ai_reason: ai?.reason ?? null,
        qty_boxes: item.reorder_qty_boxes,
        unit_price_incl_vat: item.price_incl_vat,
      };
    }));

    const { error: itemsErr } = await supabase.from('supplier_order_items').insert(lines);
    if (itemsErr) throw new Error(itemsErr.message);
    drafted.push({ order_id: orderId, supplier_key: key, items: lines.map(l => l.name) });
  }

  await notifyAdmins(drafted);
  return { drafted };
}

async function notifyAdmins(drafted) {
  if (!drafted.length) return;
  const itemNames = drafted.flatMap(d => d.items);
  const body = `מלאי נמוך: ${itemNames.join(', ')}. טיוטות הזמנה מחכות לאישור.`;

  await sendPushToAdmins({ title: 'הזמנות ציוד לאישור', body: body.slice(0, 120) })
    .catch(err => console.error('[reorder] push failed:', err.message));

  const mail = mailTransport();
  if (!mail) return;
  const lines = drafted.map(d => `• ${d.supplier_key}: ${d.items.join(', ')}`).join('\n');
  try {
    await mail.transporter.sendMail({
      from: mail.from,
      to: ADMIN_EMAIL,
      subject: `הזמנות ציוד לאישור (${itemNames.length} פריטים)`,
      text: `המלאי ירד מתחת לסף עבור הפריטים הבאים, ונוצרו טיוטות הזמנה מספקים:\n\n${lines}\n\nיש לאשר ולשלוח מלשונית "הזמנות" בלוח הניהול.`,
    });
  } catch (err) {
    console.error('[reorder] admin email failed:', err.message);
  }
}

function buildOrderText(order, items) {
  const greeting = order.supplier_contact_name ? `שלום ${order.supplier_contact_name},` : 'שלום,';
  const lines = items.map(i =>
    `• ${i.name}${i.sku ? ` (מק״ט ${i.sku})` : ''} — כמות: ${i.qty_boxes}`);
  return [greeting, '', 'נבקש להזמין את הפריטים הבאים:', ...lines, '', 'תודה,', SIGNATURE_NAME, COMPANY_NAME].join('\n');
}

// Order number in the subject lets the reply check match a supplier's reply to its order
function orderSubject(order) {
  return `הזמנת ציוד #${order.order_number} — ${COMPANY_NAME}`;
}

// customText: the message as the admin edited it in the send dialog; falls back to the generated text.
// Sent from alonm@mpcheck.co.il via Microsoft Graph once the MS_* env vars exist, else from Gmail.
async function sendOrderEmail(order, items, customText) {
  if (!order.supplier_email) throw new Error('לספק אין כתובת אימייל');
  const subject = orderSubject(order);
  const text = customText || buildOrderText(order, items);

  if (graphConfigured()) {
    await sendMail({
      to: order.supplier_email,
      replyTo: process.env.SUPPLIER_SENDER_EMAIL,
      subject,
      text,
    });
    return;
  }

  const mail = mailTransport();
  if (!mail) throw new Error('GMAIL_USER או GMAIL_APP_PASSWORD אינם מוגדרים');
  await mail.transporter.sendMail({
    from: `${COMPANY_NAME} <${process.env.GMAIL_USER}>`,
    to: order.supplier_email,
    cc: ADMIN_EMAIL,
    replyTo: ADMIN_EMAIL,
    subject,
    text,
  });
}

module.exports = { runStockCheck, suggestQuantity, buildOrderText, sendOrderEmail, supplierKey, anthropic, AI_MODEL };
