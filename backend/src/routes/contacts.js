const express = require('express');
const { z }   = require('zod');
const supabase = require('../supabase');
const auth     = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

const ContactSchema = z.object({
  name:       z.string().trim().min(1).max(100),
  title:      z.string().trim().max(100).optional(),
  phone:      z.string().trim().min(1).max(30),
  sort_order: z.coerce.number().optional().default(0),
});
const ContactPatchSchema = ContactSchema.partial();

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
  const parsed = ContactSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { name, title, phone, sort_order } = parsed.data;

  const { data, error } = await supabase
    .from('contacts')
    .insert({ name, title: title || null, phone, sort_order })
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}));

// POST /api/contacts/reorder — admin
router.post('/reorder', auth, adminAuth, asyncHandler(async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0)
    return res.status(400).json({ error: 'נדרש מערך פריטים' });

  // Validate all IDs exist before upserting to prevent inserting arbitrary rows
  const ids = items.map(({ id }) => id);
  const { data: existing } = await supabase.from('contacts').select('id').in('id', ids);
  const validIds = new Set((existing || []).map(r => r.id));
  const safeItems = items.filter(({ id }) => validIds.has(id));
  if (safeItems.length === 0) return res.status(400).json({ error: 'לא נמצאו מזהי אנשי קשר תקינים' });

  const { error } = await supabase
    .from('contacts')
    .upsert(safeItems.map(({ id, sort_order }) => ({ id, sort_order })), { onConflict: 'id' });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
}));

// PATCH /api/contacts/:id — admin
router.patch('/:id', auth, adminAuth, asyncHandler(async (req, res) => {
  const parsed = ContactPatchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { name, title, phone } = parsed.data;
  const updates = {};
  if (name  !== undefined) updates.name  = name;
  if (title !== undefined) updates.title = title || null;
  if (phone !== undefined) updates.phone = phone;

  if (Object.keys(updates).length === 0)
    return res.status(400).json({ error: 'אין שדות לעדכון' });

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
