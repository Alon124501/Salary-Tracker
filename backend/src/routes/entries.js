const express = require('express');
const multer  = require('multer');
const { z }   = require('zod');
const supabase = require('../supabase');
const auth     = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { foodAudit, totalTestsFor, dailyExpenses, FOOD_BONUS_TEST_THRESHOLD } = require('../lib/payCalc');

const router = express.Router();
router.use(auth);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const NumericField = z.coerce.number().min(0).optional().default(0);

const EntryBodySchema = z.object({
  date:                  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD').optional(),
  insurance_tests:       NumericField,
  screening_tests:       NumericField,
  mixed_screening_tests: NumericField,
  partial_tests:         NumericField,
  kilometers:            NumericField,
  office_hours:          NumericField,
  food_expense:          NumericField,
  parking_expense:       NumericField,
});

// PUT uses optional fields WITHOUT defaults so omitted fields stay undefined
// and the ?? fallback to the existing DB value works correctly.
const PutNumericField = z.coerce.number().min(0).optional();
const PutBodySchema = z.object({
  insurance_tests:       PutNumericField,
  screening_tests:       PutNumericField,
  mixed_screening_tests: PutNumericField,
  partial_tests:         PutNumericField,
  kilometers:            PutNumericField,
  office_hours:          PutNumericField,
  food_expense:          PutNumericField,
  parking_expense:       PutNumericField,
});

// Only blocks INCREASES to food_expense on days with <4 tests; decreases and
// unrelated field edits always pass through untouched.
function enforceFoodGate(finalFields, previousFoodExpense) {
  const qualifies = totalTestsFor(finalFields) >= FOOD_BONUS_TEST_THRESHOLD;
  const isIncrease = (finalFields.food_expense || 0) > (previousFoodExpense || 0);
  if (!qualifies && isIncrease) {
    finalFields.food_expense = previousFoodExpense || 0;
  }
  return finalFields;
}

function monthRange(month) {
  const [year, mon] = month.split('-').map(Number);
  const start = `${month}-01`;
  const end = new Date(year, mon, 0).toISOString().slice(0, 10);
  return { start, end };
}

// GET /api/entries?month=YYYY-MM
router.get('/', asyncHandler(async (req, res) => {
  const { month } = req.query;
  let query = supabase.from('entries').select('*').eq('user_id', req.userId).order('date', { ascending: false });
  if (month) {
    const { start, end } = monthRange(month);
    query = query.gte('date', start).lte('date', end);
  }
  const { data: rows, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(rows);
}));

// GET /api/entries/summary?month=YYYY-MM
router.get('/summary', asyncHandler(async (req, res) => {
  const { month } = req.query;
  if (!month) return res.status(400).json({ error: 'month param required (YYYY-MM)' });

  const { start, end } = monthRange(month);
  const { data: rows, error } = await supabase.from('entries').select('*')
    .eq('user_id', req.userId).gte('date', start).lte('date', end);
  if (error) return res.status(500).json({ error: error.message });

  const totals = {
    insurance_tests: 0, screening_tests: 0, mixed_screening_tests: 0, partial_tests: 0,
    totalTests: 0, kilometers: 0, office_hours: 0, expenses: 0, days: rows.length
  };
  for (const e of rows) {
    totals.insurance_tests += e.insurance_tests || 0;
    totals.screening_tests += e.screening_tests || 0;
    totals.mixed_screening_tests += e.mixed_screening_tests || 0;
    totals.partial_tests += e.partial_tests || 0;
    totals.kilometers += e.kilometers || 0;
    totals.office_hours += e.office_hours || 0;
    totals.expenses += dailyExpenses(e);
  }
  totals.totalTests = totals.insurance_tests + totals.screening_tests +
                       totals.mixed_screening_tests + totals.partial_tests;
  totals.foodAudit = foodAudit(rows);
  res.json(totals);
}));

// GET /api/entries/backup
router.get('/backup', asyncHandler(async (req, res) => {
  const { data: rows, error } = await supabase.from('entries').select('*')
    .eq('user_id', req.userId).order('date', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  const entries = rows.map(({ user_id, id, ...e }) => e);
  res.json({ exported_at: new Date().toISOString(), entries });
}));

// POST /api/entries  (upsert by date)
router.post('/', asyncHandler(async (req, res) => {
  const parsed = EntryBodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { date, ...fields } = parsed.data;
  if (!date) return res.status(400).json({ error: 'date is required' });

  const { data: existing } = await supabase.from('entries')
    .select('food_expense').eq('user_id', req.userId).eq('date', date).maybeSingle();
  enforceFoodGate(fields, existing?.food_expense);

  const { data: entry, error } = await supabase.from('entries').upsert({
    user_id: req.userId,
    date,
    ...fields,
  }, { onConflict: 'user_id,date' }).select().single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(entry);
}));

// PUT /api/entries/:id/receipt
router.put('/:id/receipt', upload.single('receipt'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const { data: entry, error: fetchErr } = await supabase.from('entries')
    .select('id, date')
    .eq('id', req.params.id)
    .eq('user_id', req.userId)
    .single();
  if (fetchErr || !entry) return res.status(404).json({ error: 'Entry not found' });

  const ext = req.file.originalname.split('.').pop();
  const month = entry.date.slice(0, 7);
  const filePath = `${req.userId}/${month}/${entry.id}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from('receipts')
    .upload(filePath, req.file.buffer, { contentType: req.file.mimetype, upsert: true });
  if (uploadErr) return res.status(500).json({ error: uploadErr.message });

  const { error: updateErr } = await supabase.from('entries')
    .update({ receipt_url: filePath })
    .eq('id', entry.id);
  if (updateErr) return res.status(500).json({ error: updateErr.message });

  res.json({ success: true, receipt_url: filePath });
}));

// POST /api/entries/:id/food-receipt
router.post('/:id/food-receipt', upload.single('food_receipt'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const { data: entry, error: fetchErr } = await supabase.from('entries')
    .select('id, date, food_receipt_urls, insurance_tests, screening_tests, mixed_screening_tests, partial_tests')
    .eq('id', req.params.id).eq('user_id', req.userId).single();
  if (fetchErr || !entry) return res.status(404).json({ error: 'Entry not found' });
  if (totalTestsFor(entry) < FOOD_BONUS_TEST_THRESHOLD) {
    return res.status(400).json({ error: 'Add at least 4 tests for this day before uploading a food receipt' });
  }

  const ext = req.file.originalname.split('.').pop();
  const month = entry.date.slice(0, 7);
  const filePath = `${req.userId}/${month}/${entry.id}/food_${Date.now()}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from('receipts')
    .upload(filePath, req.file.buffer, { contentType: req.file.mimetype });
  if (uploadErr) return res.status(500).json({ error: uploadErr.message });

  const currentUrls = entry.food_receipt_urls || [];
  const { error: updateErr } = await supabase.from('entries')
    .update({ food_receipt_urls: [...currentUrls, filePath] })
    .eq('id', entry.id);
  if (updateErr) return res.status(500).json({ error: updateErr.message });

  const { data: signedData } = await supabase.storage
    .from('receipts').createSignedUrl(filePath, 604800);

  res.json({ path: filePath, signedUrl: signedData?.signedUrl });
}));

// GET /api/entries/:id/food-receipts
router.get('/:id/food-receipts', asyncHandler(async (req, res) => {
  const { data: entry, error: fetchErr } = await supabase.from('entries')
    .select('food_receipt_urls')
    .eq('id', req.params.id).eq('user_id', req.userId).single();
  if (fetchErr || !entry) return res.status(404).json({ error: 'Entry not found' });

  const paths = entry.food_receipt_urls || [];
  const receipts = await Promise.all(paths.map(async path => {
    const { data: urlData, error: urlErr } = await supabase.storage.from('receipts').createSignedUrl(path, 604800);
    if (urlErr) console.error('createSignedUrl failed for', path, urlErr.message);
    return { path, signedUrl: urlData?.signedUrl ?? null };
  }));
  res.json(receipts);
}));

// DELETE /api/entries/:id/food-receipt
router.delete('/:id/food-receipt', asyncHandler(async (req, res) => {
  const path = req.query.path;
  if (!path) return res.status(400).json({ error: 'path is required' });

  const { data: entry, error: fetchErr } = await supabase.from('entries')
    .select('food_receipt_urls')
    .eq('id', req.params.id).eq('user_id', req.userId).single();
  if (fetchErr || !entry) return res.status(404).json({ error: 'Entry not found' });

  const currentUrls = entry.food_receipt_urls || [];
  if (!currentUrls.includes(path)) return res.status(404).json({ error: 'Receipt not found' });

  await supabase.storage.from('receipts').remove([path]);

  const { error: updateErr } = await supabase.from('entries')
    .update({ food_receipt_urls: currentUrls.filter(p => p !== path) })
    .eq('id', req.params.id);
  if (updateErr) return res.status(500).json({ error: updateErr.message });

  res.json({ success: true });
}));

// POST /api/entries/:id/parking-receipt
router.post('/:id/parking-receipt', upload.single('parking_receipt'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const { data: entry, error: fetchErr } = await supabase.from('entries')
    .select('id, date, parking_receipt_urls')
    .eq('id', req.params.id).eq('user_id', req.userId).single();
  if (fetchErr || !entry) return res.status(404).json({ error: 'Entry not found' });

  const ext = req.file.originalname.split('.').pop();
  const month = entry.date.slice(0, 7);
  const filePath = `${req.userId}/${month}/${entry.id}/parking_${Date.now()}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from('receipts')
    .upload(filePath, req.file.buffer, { contentType: req.file.mimetype });
  if (uploadErr) return res.status(500).json({ error: uploadErr.message });

  const currentUrls = entry.parking_receipt_urls || [];
  const { error: updateErr } = await supabase.from('entries')
    .update({ parking_receipt_urls: [...currentUrls, filePath] })
    .eq('id', entry.id);
  if (updateErr) return res.status(500).json({ error: updateErr.message });

  const { data: signedData } = await supabase.storage
    .from('receipts').createSignedUrl(filePath, 604800);

  res.json({ path: filePath, signedUrl: signedData?.signedUrl });
}));

// GET /api/entries/:id/parking-receipts
router.get('/:id/parking-receipts', asyncHandler(async (req, res) => {
  const { data: entry, error: fetchErr } = await supabase.from('entries')
    .select('parking_receipt_urls')
    .eq('id', req.params.id).eq('user_id', req.userId).single();
  if (fetchErr || !entry) return res.status(404).json({ error: 'Entry not found' });

  const paths = entry.parking_receipt_urls || [];
  const receipts = await Promise.all(paths.map(async path => {
    const { data: urlData, error: urlErr } = await supabase.storage.from('receipts').createSignedUrl(path, 604800);
    if (urlErr) console.error('createSignedUrl failed for', path, urlErr.message);
    return { path, signedUrl: urlData?.signedUrl ?? null };
  }));
  res.json(receipts);
}));

// DELETE /api/entries/:id/parking-receipt
router.delete('/:id/parking-receipt', asyncHandler(async (req, res) => {
  const path = req.query.path;
  if (!path) return res.status(400).json({ error: 'path is required' });

  const { data: entry, error: fetchErr } = await supabase.from('entries')
    .select('parking_receipt_urls')
    .eq('id', req.params.id).eq('user_id', req.userId).single();
  if (fetchErr || !entry) return res.status(404).json({ error: 'Entry not found' });

  const currentUrls = entry.parking_receipt_urls || [];
  if (!currentUrls.includes(path)) return res.status(404).json({ error: 'Receipt not found' });

  await supabase.storage.from('receipts').remove([path]);

  const { error: updateErr } = await supabase.from('entries')
    .update({ parking_receipt_urls: currentUrls.filter(p => p !== path) })
    .eq('id', req.params.id);
  if (updateErr) return res.status(500).json({ error: updateErr.message });

  res.json({ success: true });
}));

// PUT /api/entries/:id
router.put('/:id', asyncHandler(async (req, res) => {
  const { data: entry, error: fetchErr } = await supabase.from('entries').select('*')
    .eq('id', req.params.id).eq('user_id', req.userId).single();
  if (fetchErr || !entry) return res.status(404).json({ error: 'Entry not found' });

  const parsed = PutBodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const { date: _date, ...fields } = parsed.data;
  const updates = {
    insurance_tests:       fields.insurance_tests       ?? entry.insurance_tests,
    screening_tests:       fields.screening_tests       ?? entry.screening_tests,
    mixed_screening_tests: fields.mixed_screening_tests ?? entry.mixed_screening_tests,
    partial_tests:         fields.partial_tests         ?? entry.partial_tests,
    kilometers:            fields.kilometers            ?? entry.kilometers,
    office_hours:          fields.office_hours          ?? entry.office_hours,
    food_expense:          fields.food_expense          ?? entry.food_expense,
    parking_expense:       fields.parking_expense       ?? entry.parking_expense,
  };
  enforceFoodGate(updates, entry.food_expense);

  const { data: updated, error: updateErr } = await supabase.from('entries')
    .update(updates).eq('id', entry.id).select().single();
  if (updateErr) return res.status(500).json({ error: updateErr.message });

  res.json(updated);
}));

// DELETE /api/entries/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  const { data: entry, error: fetchErr } = await supabase.from('entries').select('id')
    .eq('id', req.params.id).eq('user_id', req.userId).single();
  if (fetchErr || !entry) return res.status(404).json({ error: 'Entry not found' });

  const { error } = await supabase.from('entries').delete().eq('id', entry.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
}));

// POST /api/entries/restore
router.post('/restore', asyncHandler(async (req, res) => {
  const { entries } = req.body;
  if (!Array.isArray(entries)) return res.status(400).json({ error: 'entries array required' });

  const rows = entries.filter(e => e.date).map(e => ({
    user_id: req.userId,
    date: e.date,
    insurance_tests: Math.max(0, Number(e.insurance_tests) || 0),
    screening_tests: Math.max(0, Number(e.screening_tests) || 0),
    mixed_screening_tests: Math.max(0, Number(e.mixed_screening_tests) || 0),
    partial_tests: Math.max(0, Number(e.partial_tests) || 0),
    kilometers: Math.max(0, Number(e.kilometers) || 0),
    office_hours: Math.max(0, Number(e.office_hours) || 0),
    food_expense: Math.max(0, Number(e.food_expense) || 0),
    parking_expense: Math.max(0, Number(e.parking_expense) || 0),
  }));

  const { error } = await supabase.from('entries').upsert(rows, { onConflict: 'user_id,date' });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, imported: rows.length });
}));

module.exports = router;
