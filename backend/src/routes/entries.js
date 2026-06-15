const express = require('express');
const multer  = require('multer');
const { z }   = require('zod');
const supabase = require('../supabase');
const auth     = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

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

function calcDaily(e, mileageRate = 2) {
  const totalTests = (e.insurance_tests || 0) + (e.screening_tests || 0) +
                     (e.mixed_screening_tests || 0) + (e.partial_tests || 0);

  const insurance = (e.insurance_tests || 0) * 80;
  const screening = (e.screening_tests || 0) * 105;
  const mixed = (e.mixed_screening_tests || 0) * 120;
  const partial = (e.partial_tests || 0) * 50;
  const rawTestsPay = insurance + screening + mixed + partial;
  const MIN_TESTS_PAY = 240;
  const testsPay = totalTests > 0 ? Math.max(rawTestsPay, MIN_TESTS_PAY) : rawTestsPay;
  const minBonus = testsPay - rawTestsPay;

  const km = (e.kilometers || 0) * mileageRate + ((e.kilometers || 0) >= 100 ? 100 : 0);
  const office = (e.office_hours || 0) * 60;
  const expenses = (e.food_expense || 0) + (e.parking_expense || 0);
  return { insurance, screening, mixed, partial, minBonus, km, office, expenses,
           total: testsPay + km + office + expenses };
}

async function getUserMileageRate(userId) {
  const { data } = await supabase.from('profiles').select('mileage_rate').eq('id', userId).single();
  return data?.mileage_rate ?? 2;
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
  const [{ data: rows, error }, mileageRate] = await Promise.all([query, getUserMileageRate(req.userId)]);
  if (error) return res.status(500).json({ error: error.message });
  res.json(rows.map(e => ({ ...e, calc: calcDaily(e, mileageRate) })));
}));

// GET /api/entries/summary?month=YYYY-MM
router.get('/summary', asyncHandler(async (req, res) => {
  const { month } = req.query;
  if (!month) return res.status(400).json({ error: 'month param required (YYYY-MM)' });

  const { start, end } = monthRange(month);
  const [{ data: rows, error }, mileageRate] = await Promise.all([
    supabase.from('entries').select('*').eq('user_id', req.userId).gte('date', start).lte('date', end),
    getUserMileageRate(req.userId),
  ]);
  if (error) return res.status(500).json({ error: error.message });

  const totals = {
    insurance: 0, screening: 0, mixed: 0, partial: 0, minBonus: 0,
    km: 0, office: 0, expenses: 0, total: 0, days: rows.length
  };
  for (const e of rows) {
    const c = calcDaily(e, mileageRate);
    totals.insurance += c.insurance;
    totals.screening += c.screening;
    totals.mixed += c.mixed;
    totals.partial += c.partial;
    totals.minBonus += c.minBonus;
    totals.km += c.km;
    totals.office += c.office;
    totals.expenses += c.expenses;
    totals.total += c.total;
  }
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
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });
  const { date, ...fields } = parsed.data;
  if (!date) return res.status(400).json({ error: 'date is required' });

  const { data: entry, error } = await supabase.from('entries').upsert({
    user_id: req.userId,
    date,
    ...fields,
  }, { onConflict: 'user_id,date' }).select().single();

  if (error) return res.status(500).json({ error: error.message });
  const mileageRate = await getUserMileageRate(req.userId);
  res.status(201).json({ ...entry, calc: calcDaily(entry, mileageRate) });
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
    .select('id, date, food_receipt_urls')
    .eq('id', req.params.id).eq('user_id', req.userId).single();
  if (fetchErr || !entry) return res.status(404).json({ error: 'Entry not found' });

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

  const parsed = EntryBodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });

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

  const { data: updated, error: updateErr } = await supabase.from('entries')
    .update(updates).eq('id', entry.id).select().single();
  if (updateErr) return res.status(500).json({ error: updateErr.message });

  const mileageRate = await getUserMileageRate(req.userId);
  res.json({ ...updated, calc: calcDaily(updated, mileageRate) });
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
