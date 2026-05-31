const express = require('express');
const supabase = require('../supabase');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');

const router = express.Router();

// GET /api/faq — public
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('faq_items')
    .select('id, category, question, answer, sort_order')
    .order('sort_order', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });

  const grouped = { insurance: [], screening: [] };
  for (const item of data || []) {
    if (grouped[item.category]) grouped[item.category].push(item);
  }
  res.json(grouped);
});

// POST /api/faq — admin: create item
router.post('/', auth, adminAuth, async (req, res) => {
  const { category, question, answer, sort_order } = req.body;
  if (!category || !question || !answer)
    return res.status(400).json({ error: 'category, question, and answer are required' });

  const { data, error } = await supabase
    .from('faq_items')
    .insert({ category, question, answer, sort_order: sort_order ?? 0 })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/faq/reorder — admin: batch update sort_order
router.post('/reorder', auth, adminAuth, async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0)
    return res.status(400).json({ error: 'items array is required' });

  const { error } = await supabase
    .from('faq_items')
    .upsert(items.map(({ id, sort_order }) => ({ id, sort_order })), { onConflict: 'id' });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// PATCH /api/faq/:id — admin: update question/answer
router.patch('/:id', auth, adminAuth, async (req, res) => {
  const { question, answer } = req.body;
  const updates = {};
  if (question !== undefined) updates.question = question;
  if (answer   !== undefined) updates.answer   = answer;

  const { data, error } = await supabase
    .from('faq_items')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// DELETE /api/faq/:id — admin: delete item
router.delete('/:id', auth, adminAuth, async (req, res) => {
  const { error } = await supabase.from('faq_items').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

module.exports = router;
