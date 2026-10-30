const express = require('express');
const { z }   = require('zod');
const supabase = require('../supabase');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

const ReasonSchema = z.object({
  label: z.string().trim().min(1, 'נדרש שם סיבה').max(100),
});
const ReasonPatchSchema = z.object({
  label:  z.string().trim().min(1, 'נדרש שם סיבה').max(100).optional(),
  active: z.boolean().optional(),
});

const FIELDS = 'id, label, is_other, active, created_at';

// "אחר" always last, otherwise creation order.
function sortReasons(rows) {
  return (rows || []).sort((a, b) =>
    (a.is_other - b.is_other) || a.created_at.localeCompare(b.created_at));
}

// GET /api/cancellation-reasons — all authenticated; includes disabled reasons
// too so an old entry that used one can still render its label.
router.get('/', auth, asyncHandler(async (req, res) => {
  const { data, error } = await supabase.from('cancellation_reasons').select(FIELDS);
  if (error) return res.status(500).json({ error: error.message });
  res.json(sortReasons(data));
}));

// POST /api/cancellation-reasons — admin
router.post('/', auth, adminAuth, asyncHandler(async (req, res) => {
  const parsed = ReasonSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const { data, error } = await supabase.from('cancellation_reasons')
    .insert({ label: parsed.data.label }).select(FIELDS).single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
}));

// PATCH /api/cancellation-reasons/:id — admin: rename or enable/disable.
// No delete: past entries keep referencing the reason by id.
router.patch('/:id', auth, adminAuth, asyncHandler(async (req, res) => {
  const parsed = ReasonPatchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const { data: reason, error: fetchErr } = await supabase.from('cancellation_reasons')
    .select('id, is_other').eq('id', req.params.id).maybeSingle();
  if (fetchErr) return res.status(500).json({ error: fetchErr.message });
  if (!reason) return res.status(404).json({ error: 'הסיבה לא נמצאה' });
  if (reason.is_other) return res.status(400).json({ error: 'לא ניתן לשנות את הסיבה "אחר"' });

  const { data, error } = await supabase.from('cancellation_reasons')
    .update(parsed.data).eq('id', reason.id).select(FIELDS).single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}));

module.exports = router;
