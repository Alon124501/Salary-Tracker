const express = require('express');
const { z }   = require('zod');
const supabase = require('../supabase');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

const TypeSchema = z.object({
  label: z.string().trim().min(1, 'נדרש שם סוג בדיקה').max(100),
});
const TypePatchSchema = z.object({
  label:  z.string().trim().min(1, 'נדרש שם סוג בדיקה').max(100).optional(),
  active: z.boolean().optional(),
});

const FIELDS = 'id, label, active, created_at';

// GET /api/other-test-types — all authenticated; includes disabled types too
// so an old entry that used one can still render its label.
router.get('/', auth, asyncHandler(async (req, res) => {
  const { data, error } = await supabase.from('other_test_types').select(FIELDS)
    .order('created_at', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
}));

// POST /api/other-test-types — admin
router.post('/', auth, adminAuth, asyncHandler(async (req, res) => {
  const parsed = TypeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const { data, error } = await supabase.from('other_test_types')
    .insert({ label: parsed.data.label }).select(FIELDS).single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
}));

// PATCH /api/other-test-types/:id — admin: rename or enable/disable.
// No delete: past entries keep referencing the type by id.
router.patch('/:id', auth, adminAuth, asyncHandler(async (req, res) => {
  const parsed = TypePatchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const { data, error } = await supabase.from('other_test_types')
    .update(parsed.data).eq('id', req.params.id).select(FIELDS).maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'סוג הבדיקה לא נמצא' });
  res.json(data);
}));

module.exports = router;
