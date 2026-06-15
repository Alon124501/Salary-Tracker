const express = require('express');
const supabase = require('../supabase');
const auth     = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

// GET /api/contacts — authenticated
router.get('/', auth, asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('contacts')
    .select('id, name, title, phone, sort_order')
    .order('sort_order', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
}));

// POST /api/contacts — admin
router.post('/', auth, adminAuth, asyncHandler(async (req, res) => {
  const { name, title, phone, sort_order } = req.body;
  if (!name?.trim() || !phone?.trim())
    return res.status(400).json({ error: 'name and phone are required' });

  const { data, error } = await supabase
    .from('contacts')
    .insert({ name: name.trim(), title: title?.trim() || null, phone: phone.trim(), sort_order: sort_order ?? 0 })
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}));

// POST /api/contacts/reorder — admin
router.post('/reorder', auth, adminAuth, asyncHandler(async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0)
    return res.status(400).json({ error: 'items array is required' });

  // Validate all IDs exist before upserting to prevent inserting arbitrary rows
  const ids = items.map(({ id }) => id);
  const { data: existing } = await supabase.from('contacts').select('id').in('id', ids);
  const validIds = new Set((existing || []).map(r => r.id));
  const safeItems = items.filter(({ id }) => validIds.has(id));
  if (safeItems.length === 0) return res.status(400).json({ error: 'No valid contact IDs' });

  const { error } = await supabase
    .from('contacts')
    .upsert(safeItems.map(({ id, sort_order }) => ({ id, sort_order })), { onConflict: 'id' });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
}));

// PATCH /api/contacts/:id — admin
router.patch('/:id', auth, adminAuth, asyncHandler(async (req, res) => {
  const { name, title, phone } = req.body;
  const updates = {};
  if (name  !== undefined) updates.name  = name.trim();
  if (title !== undefined) updates.title = title?.trim() || null;
  if (phone !== undefined) updates.phone = phone.trim();

  if (Object.keys(updates).length === 0)
    return res.status(400).json({ error: 'No fields to update' });

  const { data, error } = await supabase
    .from('contacts')
    .update(updates)
    .eq('id', req.params.id)
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}));

// DELETE /api/contacts/:id — admin
router.delete('/:id', auth, adminAuth, asyncHandler(async (req, res) => {
  const { error } = await supabase.from('contacts').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
}));

module.exports = router;
