const express = require('express');
const { z }   = require('zod');
const supabase = require('../supabase');
const auth     = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

const TimeOffSchema = z.object({
  category:   z.enum(['vacation', 'sick', 'other']),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'נדרש תאריך התחלה תקין'),
  end_date:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'נדרש תאריך סיום תקין'),
  note:       z.string().max(500).optional().default(''),
}).refine(d => d.end_date >= d.start_date, {
  message: 'תאריך סיום חייב להיות אחרי תאריך התחלה',
  path: ['end_date'],
});

const DecisionSchema = z.object({
  status: z.enum(['approved', 'rejected']),
});

// POST /api/timeoff/requests — employee submits a request
router.post('/requests', auth, asyncHandler(async (req, res) => {
  const parsed = TimeOffSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const { data, error } = await supabase
    .from('time_off_requests')
    .insert({ user_id: req.userId, ...parsed.data })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}));

// GET /api/timeoff/requests/mine — employee's own requests
router.get('/requests/mine', auth, asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('time_off_requests')
    .select('*')
    .eq('user_id', req.userId)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
}));

// DELETE /api/timeoff/requests/:id — employee cancels own pending request
router.delete('/requests/:id', auth, asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('time_off_requests')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.userId)
    .eq('status', 'pending')
    .select()
    .single();
  if (error || !data) return res.status(404).json({ error: 'הבקשה לא נמצאה או שאינה ממתינה' });
  res.json(data);
}));

// GET /api/timeoff/requests — admin queue, all requests
router.get('/requests', auth, adminAuth, asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('time_off_requests')
    .select('*, profiles!user_id(first_name, last_name, username)')
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
}));

// PUT /api/timeoff/requests/:id/decide — admin approves or rejects
router.put('/requests/:id/decide', auth, adminAuth, asyncHandler(async (req, res) => {
  const parsed = DecisionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const { data, error } = await supabase
    .from('time_off_requests')
    .update({ status: parsed.data.status, decided_by: req.userId, decided_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .eq('status', 'pending')
    .select()
    .single();
  if (error || !data) return res.status(404).json({ error: 'הבקשה לא נמצאה או שכבר טופלה' });
  res.json(data);
}));

module.exports = router;
