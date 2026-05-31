const express = require('express');
const supabase = require('../supabase');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');

const router = express.Router();

// GET /api/portal/credentials — authenticated
router.get('/credentials', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('app_credentials')
    .select('id, name, username, password, sort_order')
    .order('sort_order', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

// POST /api/portal/credentials — admin
router.post('/credentials', auth, adminAuth, async (req, res) => {
  const { name, username, password, sort_order } = req.body;
  if (!name || !username || !password)
    return res.status(400).json({ error: 'name, username, and password are required' });

  const { data, error } = await supabase
    .from('app_credentials')
    .insert({ name, username, password, sort_order: sort_order ?? 0 })
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/portal/credentials/reorder — admin
router.post('/credentials/reorder', auth, adminAuth, async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0)
    return res.status(400).json({ error: 'items array is required' });

  const { error } = await supabase
    .from('app_credentials')
    .upsert(items.map(({ id, sort_order }) => ({ id, sort_order })), { onConflict: 'id' });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// PATCH /api/portal/credentials/:id — admin
router.patch('/credentials/:id', auth, adminAuth, async (req, res) => {
  const { name, username, password } = req.body;
  const updates = {};
  if (name     !== undefined) updates.name     = name;
  if (username !== undefined) updates.username = username;
  if (password !== undefined) updates.password = password;

  const { data, error } = await supabase
    .from('app_credentials')
    .update(updates)
    .eq('id', req.params.id)
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// DELETE /api/portal/credentials/:id — admin
router.delete('/credentials/:id', auth, adminAuth, async (req, res) => {
  const { error } = await supabase.from('app_credentials').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

module.exports = router;
