const express = require('express');
const { z }   = require('zod');
const supabase = require('../supabase');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');

const router = express.Router();

const FaqSchema = z.object({
  category:   z.enum(['insurance', 'screening']),
  question:   z.string().trim().min(1).max(500),
  answer:     z.string().trim().min(1).max(5000),
  sort_order: z.coerce.number().optional().default(0),
});
const FaqPatchSchema = z.object({
  question: z.string().trim().min(1).max(500).optional(),
  answer:   z.string().trim().min(1).max(5000).optional(),
});

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
  const parsed = FaqSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const { data, error } = await supabase
    .from('faq_items')
    .insert(parsed.data)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/faq/reorder — admin: batch update sort_order
router.post('/reorder', auth, adminAuth, async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0)
    return res.status(400).json({ error: 'נדרש מערך פריטים' });

  const { error } = await supabase
    .from('faq_items')
    .upsert(items.map(({ id, sort_order }) => ({ id, sort_order })), { onConflict: 'id' });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// PATCH /api/faq/:id — admin: update question/answer
router.patch('/:id', auth, adminAuth, async (req, res) => {
  const parsed = FaqPatchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { question, answer } = parsed.data;
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
