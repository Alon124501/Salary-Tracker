const express = require('express');
const { z }   = require('zod');
const supabase = require('../supabase');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const asyncHandler = require('../middleware/asyncHandler');
const { runStockCheck, sendOrderEmail } = require('../lib/reorder');
const { runReplyCheck } = require('../lib/supplierReplies');

const router = express.Router();

const emptyToUndefined = (val) => (val === '' || val === null || val === undefined ? undefined : val);
// Reorder fields can be cleared (empty input = auto-reorder off), so empty maps to null, not undefined
const emptyToNull = (val) => (val === '' || val === null ? null : val);
const optionalString = (max) => z.preprocess(emptyToUndefined, z.string().trim().max(max).optional());
const optionalNumber = () => z.preprocess(emptyToUndefined, z.coerce.number().optional());
const optionalNonnegativeNumber = () => z.preprocess(emptyToUndefined, z.coerce.number().nonnegative().optional());

const CatalogItemSchema = z.object({
  name: z.string().trim().min(1).max(100),
  sku: optionalString(100),
  supplier_contact_name: optionalString(200),
  supplier_email: optionalString(200),
  supplier_phone: optionalString(50),
  supplier_whatsapp: optionalString(50),
  supplier_company_id: optionalString(50),
  price_excl_vat: optionalNonnegativeNumber(),
  price_incl_vat: optionalNonnegativeNumber(),
  vat_amount: optionalNonnegativeNumber(),
  units_per_box: optionalNonnegativeNumber(),
  stock_qty: optionalNumber(),
  reorder_threshold: z.preprocess(emptyToNull, z.coerce.number().int().nonnegative().nullable().optional()),
  reorder_qty_boxes: z.preprocess(emptyToNull, z.coerce.number().int().positive().nullable().optional()),
  stock_unit: z.enum(['unit', 'box']).optional(),
  supplier_id: z.preprocess(emptyToNull, z.uuid().nullable().optional()),
});

const SupplierSchema = z.object({
  company_name: optionalString(200),
  contact_name: optionalString(200),
  email:        optionalString(200),
  phone:        optionalString(50),
  whatsapp:     optionalString(50),
  company_id:   optionalString(50),
}).refine(s => s.company_name || s.contact_name, { message: 'נדרש שם חברה או איש קשר' });

// Supplier record → the inline snapshot columns on equipment_catalog
const supplierSnapshot = (s) => ({
  supplier_contact_name: s.contact_name ?? null,
  supplier_email:        s.email ?? null,
  supplier_phone:        s.phone ?? null,
  supplier_whatsapp:     s.whatsapp ?? null,
  supplier_company_id:   s.company_id ?? null,
});

// When a catalog item is linked to a supplier, its inline supplier fields always come from that supplier
async function withSupplierSnapshot(item) {
  if (!item.supplier_id) return item;
  const { data: supplier, error } = await supabase
    .from('suppliers').select('*').eq('id', item.supplier_id).single();
  if (error || !supplier) throw Object.assign(new Error('ספק לא נמצא'), { status: 400 });
  return { ...item, ...supplierSnapshot(supplier) };
}

const OrderSchema = z.object({
  items: z.array(z.object({
    catalog_id: z.uuid(),
    name:       z.string().trim().min(1).max(200),
    quantity:   z.coerce.number().positive(),
  })).min(1, 'נדרש מערך פריטים'),
  needed_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'נדרש תאריך תקין'),
});

// GET /api/equipment/catalog — all authenticated (minimal fields; no supplier/pricing data)
router.get('/catalog', auth, asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('equipment_catalog')
    .select('id, name, sort_order, stock_qty')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
}));

// GET /api/equipment/catalog/admin — admin only, full product record (supplier/pricing/stock)
router.get('/catalog/admin', auth, adminAuth, asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('equipment_catalog')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
}));

// POST /api/equipment/catalog — admin
router.post('/catalog', auth, adminAuth, asyncHandler(async (req, res) => {
  const parsed = CatalogItemSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  let item;
  try { item = await withSupplierSnapshot(parsed.data); }
  catch (e) { return res.status(e.status || 500).json({ error: e.message }); }

  const { data, error } = await supabase
    .from('equipment_catalog')
    .insert(item)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}));

// PUT /api/equipment/catalog/:id — admin
router.put('/catalog/:id', auth, adminAuth, asyncHandler(async (req, res) => {
  const parsed = CatalogItemSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  let item;
  try { item = await withSupplierSnapshot(parsed.data); }
  catch (e) { return res.status(e.status || 500).json({ error: e.message }); }

  const { data, error } = await supabase
    .from('equipment_catalog')
    .update(item)
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}));

// DELETE /api/equipment/catalog/:id — admin
router.delete('/catalog/:id', auth, adminAuth, asyncHandler(async (req, res) => {
  const { error } = await supabase
    .from('equipment_catalog')
    .delete()
    .eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
}));

// ── Suppliers (admin) ─────────────────────────────────────────────────────

// GET /api/equipment/suppliers — admin
router.get('/suppliers', auth, adminAuth, asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
}));

// POST /api/equipment/suppliers — admin
router.post('/suppliers', auth, adminAuth, asyncHandler(async (req, res) => {
  const parsed = SupplierSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const { data, error } = await supabase
    .from('suppliers')
    .insert(parsed.data)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}));

// PUT /api/equipment/suppliers/:id — admin; also refreshes the snapshot on every linked catalog item
router.put('/suppliers/:id', auth, adminAuth, asyncHandler(async (req, res) => {
  const parsed = SupplierSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  // Cleared inputs arrive as undefined; store them as null so the field is actually emptied
  const update = Object.fromEntries(
    ['company_name', 'contact_name', 'email', 'phone', 'whatsapp', 'company_id']
      .map(k => [k, parsed.data[k] ?? null]));

  const { data, error } = await supabase
    .from('suppliers')
    .update(update)
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });

  const { error: syncErr } = await supabase
    .from('equipment_catalog')
    .update(supplierSnapshot(data))
    .eq('supplier_id', req.params.id);
  if (syncErr) return res.status(500).json({ error: syncErr.message });

  res.json(data);
}));

// DELETE /api/equipment/suppliers/:id — admin; linked items keep their snapshot, link becomes null
router.delete('/suppliers/:id', auth, adminAuth, asyncHandler(async (req, res) => {
  const { error } = await supabase
    .from('suppliers')
    .delete()
    .eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
}));

// POST /api/equipment/orders — authenticated employee
router.post('/orders', auth, asyncHandler(async (req, res) => {
  const parsed = OrderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { items, needed_date } = parsed.data;

  const { data, error } = await supabase
    .from('equipment_orders')
    .insert({ user_id: req.userId, items, needed_date })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}));

// GET /api/equipment/orders — admin
router.get('/orders', auth, adminAuth, asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('equipment_orders')
    .select('id, user_id, items, needed_date, status, created_at, completed_at, profiles(first_name, last_name, username)')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
}));

// DELETE /api/equipment/orders/:id — admin marks fulfilled: decrements stock, then marks the order
// completed (kept, not deleted, as consumption history for supplier reorder suggestions)
router.delete('/orders/:id', auth, adminAuth, asyncHandler(async (req, res) => {
  const { data: order, error: fetchError } = await supabase
    .from('equipment_orders')
    .select('id, items, status')
    .eq('id', req.params.id)
    .single();
  if (fetchError) return res.status(500).json({ error: fetchError.message });
  if (!order) return res.status(404).json({ error: 'ההזמנה לא נמצאה' });
  if (order.status !== 'pending') return res.status(409).json({ error: 'ההזמנה כבר הושלמה' });

  const unmatchedItems = [];
  for (const item of order.items) {
    const { data: matched, error: decError } = await supabase.rpc('decrement_catalog_stock', {
      p_catalog_id: item.catalog_id,
      p_qty: item.quantity,
    });
    if (decError) return res.status(500).json({ error: decError.message });
    if (!matched) unmatchedItems.push(item.name);
  }

  const { data, error } = await supabase
    .from('equipment_orders')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ...data, unmatched_items: unmatchedItems });
}));

// ── Supplier reorders (admin) ─────────────────────────────────────────────

const SUPPLIER_ORDER_SELECT =
  '*, supplier_order_items(*, equipment_catalog(stock_qty, reorder_threshold, stock_unit, units_per_box))';

async function loadSupplierOrder(id) {
  const { data, error } = await supabase
    .from('supplier_orders')
    .select(SUPPLIER_ORDER_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

// GET /api/equipment/supplier-orders — open (draft/sent) first, then the 30 most recent closed
router.get('/supplier-orders', auth, adminAuth, asyncHandler(async (req, res) => {
  const { data: open, error: openErr } = await supabase
    .from('supplier_orders')
    .select(SUPPLIER_ORDER_SELECT)
    .in('status', ['draft', 'sent'])
    .order('created_at', { ascending: false });
  if (openErr) return res.status(500).json({ error: openErr.message });

  const { data: closed, error: closedErr } = await supabase
    .from('supplier_orders')
    .select(SUPPLIER_ORDER_SELECT)
    .in('status', ['received', 'cancelled'])
    .order('created_at', { ascending: false })
    .limit(30);
  if (closedErr) return res.status(500).json({ error: closedErr.message });

  res.json([...(open || []), ...(closed || [])]);
}));

// POST /api/equipment/supplier-orders/check-now — run the daily stock check immediately
router.post('/supplier-orders/check-now', auth, adminAuth, asyncHandler(async (req, res) => {
  res.json(await runStockCheck());
}));

// POST /api/equipment/supplier-orders/check-replies — read supplier replies from the mailbox now
router.post('/supplier-orders/check-replies', auth, adminAuth, asyncHandler(async (req, res) => {
  res.json(await runReplyCheck());
}));

const QtySchema = z.object({
  qty_boxes: z.coerce.number().int().positive('כמות חייבת להיות מספר שלם חיובי'),
});

// PUT /api/equipment/supplier-orders/:id/items/:itemId — edit quantity (draft only)
router.put('/supplier-orders/:id/items/:itemId', auth, adminAuth, asyncHandler(async (req, res) => {
  const parsed = QtySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const order = await loadSupplierOrder(req.params.id);
  if (!order) return res.status(404).json({ error: 'ההזמנה לא נמצאה' });
  if (order.status !== 'draft') return res.status(409).json({ error: 'ניתן לערוך רק טיוטה' });

  const { data, error } = await supabase
    .from('supplier_order_items')
    .update({ qty_boxes: parsed.data.qty_boxes })
    .eq('id', req.params.itemId)
    .eq('order_id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}));

// DELETE /api/equipment/supplier-orders/:id/items/:itemId — drop a line from a draft
router.delete('/supplier-orders/:id/items/:itemId', auth, adminAuth, asyncHandler(async (req, res) => {
  const order = await loadSupplierOrder(req.params.id);
  if (!order) return res.status(404).json({ error: 'ההזמנה לא נמצאה' });
  if (order.status !== 'draft') return res.status(409).json({ error: 'ניתן לערוך רק טיוטה' });

  const { error } = await supabase
    .from('supplier_order_items')
    .delete()
    .eq('id', req.params.itemId)
    .eq('order_id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });

  // Last line removed → nothing left to order
  if (order.supplier_order_items.length <= 1) {
    const { error: cancelErr } = await supabase
      .from('supplier_orders').update({ status: 'cancelled' }).eq('id', req.params.id);
    if (cancelErr) return res.status(500).json({ error: cancelErr.message });
  }
  res.json({ success: true });
}));

async function markSent(id, channel, adminId) {
  const { data, error } = await supabase
    .from('supplier_orders')
    .update({ status: 'sent', channel, sent_at: new Date().toISOString(), approved_by: adminId })
    .eq('id', id)
    .eq('status', 'draft')
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

const SendEmailSchema = z.object({
  text: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(5000, 'ההודעה ארוכה מדי').optional()),
});

// POST /api/equipment/supplier-orders/:id/send-email — admin approves; email goes to the supplier.
// Body { text } is the message as edited in the send dialog (optional; generated text otherwise).
router.post('/supplier-orders/:id/send-email', auth, adminAuth, asyncHandler(async (req, res) => {
  const parsed = SendEmailSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const order = await loadSupplierOrder(req.params.id);
  if (!order) return res.status(404).json({ error: 'ההזמנה לא נמצאה' });
  if (order.status !== 'draft') return res.status(409).json({ error: 'ההזמנה כבר נשלחה' });
  if (!order.supplier_order_items.length) return res.status(400).json({ error: 'אין פריטים בהזמנה' });

  try {
    await sendOrderEmail(order, order.supplier_order_items, parsed.data.text);
  } catch (err) {
    return res.status(500).json({ error: `שליחת המייל נכשלה: ${err.message}` });
  }
  res.json(await markSent(order.id, 'email', req.userId));
}));

// POST /api/equipment/supplier-orders/:id/mark-sent — admin sent it via WhatsApp from the browser
router.post('/supplier-orders/:id/mark-sent', auth, adminAuth, asyncHandler(async (req, res) => {
  const order = await loadSupplierOrder(req.params.id);
  if (!order) return res.status(404).json({ error: 'ההזמנה לא נמצאה' });
  if (order.status !== 'draft') return res.status(409).json({ error: 'ההזמנה כבר נשלחה' });
  res.json(await markSent(order.id, 'whatsapp', req.userId));
}));

// POST /api/equipment/supplier-orders/:id/receive — goods arrived: add boxes to stock
router.post('/supplier-orders/:id/receive', auth, adminAuth, asyncHandler(async (req, res) => {
  const order = await loadSupplierOrder(req.params.id);
  if (!order) return res.status(404).json({ error: 'ההזמנה לא נמצאה' });
  if (order.status !== 'sent') return res.status(409).json({ error: 'ניתן לסמן כהתקבל רק הזמנה שנשלחה' });

  // Claim the order first so a double click can't add the stock twice
  const { data: claimed, error: claimErr } = await supabase
    .from('supplier_orders')
    .update({ status: 'received', received_at: new Date().toISOString() })
    .eq('id', order.id)
    .eq('status', 'sent')
    .select('id');
  if (claimErr) return res.status(500).json({ error: claimErr.message });
  if (!claimed?.length) return res.status(409).json({ error: 'ההזמנה כבר סומנה כהתקבלה' });

  const unmatchedItems = [];
  for (const item of order.supplier_order_items) {
    const cat = item.equipment_catalog;
    if (!item.catalog_id || !cat) { unmatchedItems.push(item.name); continue; }
    const perBox = cat.stock_unit === 'unit' ? (cat.units_per_box || 1) : 1;
    const { data: matched, error: incError } = await supabase.rpc('increment_catalog_stock', {
      p_catalog_id: item.catalog_id,
      p_qty: item.qty_boxes * perBox,
    });
    if (incError) return res.status(500).json({ error: incError.message });
    if (!matched) unmatchedItems.push(item.name);
  }
  res.json({ success: true, unmatched_items: unmatchedItems });
}));

// POST /api/equipment/supplier-orders/:id/cancel
router.post('/supplier-orders/:id/cancel', auth, adminAuth, asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('supplier_orders')
    .update({ status: 'cancelled' })
    .eq('id', req.params.id)
    .in('status', ['draft', 'sent'])
    .select();
  if (error) return res.status(500).json({ error: error.message });
  if (!data?.length) return res.status(409).json({ error: 'לא ניתן לבטל הזמנה זו' });
  res.json(data[0]);
}));

module.exports = router;
