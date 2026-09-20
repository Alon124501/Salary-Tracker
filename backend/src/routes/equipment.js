const express = require('express');
const { z }   = require('zod');
const supabase = require('../supabase');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

const CatalogNameSchema = z.object({ name: z.string().trim().min(1).max(100) });

const OrderSchema = z.object({
  items: z.array(z.object({
    catalog_id: z.uuid(),
    name:       z.string().trim().min(1).max(200),
    quantity:   z.coerce.number().positive(),
  })).min(1, 'נדרש מערך פריטים'),
  needed_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'נדרש תאריך תקין'),
});

// GET /api/equipment/catalog — all authenticated
router.get('/catalog', auth, asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('equipment_catalog')
    .select('id, name, sort_order')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
}));

// POST /api/equipment/catalog — admin
router.post('/catalog', auth, adminAuth, asyncHandler(async (req, res) => {
  const parsed = CatalogNameSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const { data, error } = await supabase
    .from('equipment_catalog')
    .insert({ name: parsed.data.name })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}));

// PUT /api/equipment/catalog/:id — admin
router.put('/catalog/:id', auth, adminAuth, asyncHandler(async (req, res) => {
  const parsed = CatalogNameSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const { data, error } = await supabase
    .from('equipment_catalog')
    .update({ name: parsed.data.name })
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

// DELETE /api/equipment/orders/:id — admin approves (deletes) an order
router.delete('/orders/:id', auth, adminAuth, asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('equipment_orders')
    .delete()
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}));

module.exports = router;
