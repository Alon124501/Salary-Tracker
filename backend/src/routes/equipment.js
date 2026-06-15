const express = require('express');
const supabase = require('../supabase');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

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
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });

  const { data, error } = await supabase
    .from('equipment_catalog')
    .insert({ name: name.trim() })
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
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0)
    return res.status(400).json({ error: 'items array is required' });

  const filtered = items.filter(i => i.quantity > 0);
  if (filtered.length === 0)
    return res.status(400).json({ error: 'at least one item must have quantity > 0' });

  const { data, error } = await supabase
    .from('equipment_orders')
    .insert({ user_id: req.userId, items: filtered })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}));

// GET /api/equipment/orders — admin
router.get('/orders', auth, adminAuth, asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('equipment_orders')
    .select('id, user_id, items, status, created_at, completed_at, profiles(first_name, last_name, username)')
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
