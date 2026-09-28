const express = require('express');
const { z }   = require('zod');
const supabase = require('../supabase');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

const emptyToUndefined = (val) => (val === '' || val === null || val === undefined ? undefined : val);
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
});

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

  const { data, error } = await supabase
    .from('equipment_catalog')
    .insert(parsed.data)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}));

// PUT /api/equipment/catalog/:id — admin
router.put('/catalog/:id', auth, adminAuth, asyncHandler(async (req, res) => {
  const parsed = CatalogItemSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const { data, error } = await supabase
    .from('equipment_catalog')
    .update(parsed.data)
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
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
}));

// DELETE /api/equipment/orders/:id — admin marks fulfilled: decrements stock, then removes the order
router.delete('/orders/:id', auth, adminAuth, asyncHandler(async (req, res) => {
  const { data: order, error: fetchError } = await supabase
    .from('equipment_orders')
    .select('id, items')
    .eq('id', req.params.id)
    .single();
  if (fetchError) return res.status(500).json({ error: fetchError.message });
  if (!order) return res.status(404).json({ error: 'ההזמנה לא נמצאה' });

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
    .delete()
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ...data, unmatched_items: unmatchedItems });
}));

module.exports = router;
