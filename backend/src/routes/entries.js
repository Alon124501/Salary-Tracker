const express = require('express');
const supabase = require('../supabase');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

function calcDaily(e) {
  const totalTests = (e.insurance_tests || 0) + (e.screening_tests || 0) +
                     (e.mixed_screening_tests || 0) + (e.partial_tests || 0);

  const insurance = (e.insurance_tests || 0) * 80;
  const screening = (e.screening_tests || 0) * 105;
  const mixed = (e.mixed_screening_tests || 0) * 120;
  const partial = (e.partial_tests || 0) * 50;
  const rawTestsPay = insurance + screening + mixed + partial;
  const MIN_TESTS_PAY = 240; // minimum = 3 insurance tests
  const testsPay = totalTests > 0 && totalTests < 3 ? Math.max(rawTestsPay, MIN_TESTS_PAY) : rawTestsPay;
  const minBonus = testsPay - rawTestsPay;

  const km = (e.kilometers || 0) * 2 + ((e.kilometers || 0) >= 100 ? 100 : 0);
  const learning = (e.learning_hours || 0) * 60;
  const expenses = (e.food_expense || 0) + (e.parking_expense || 0);
  return { insurance, screening, mixed, partial: partial + minBonus, km, learning, expenses,
           total: testsPay + km + learning + expenses };
}

// Returns { start, end } as 'YYYY-MM-DD' strings for a given 'YYYY-MM' month
function monthRange(month) {
  const [year, mon] = month.split('-').map(Number);
  const start = `${month}-01`;
  const end = new Date(year, mon, 0).toISOString().slice(0, 10); // last day of month
  return { start, end };
}

// GET /api/entries?month=YYYY-MM
router.get('/', async (req, res) => {
  const { month } = req.query;
  let query = supabase.from('entries').select('*').eq('user_id', req.userId).order('date', { ascending: false });
  if (month) {
    const { start, end } = monthRange(month);
    query = query.gte('date', start).lte('date', end);
  }
  const { data: rows, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(rows.map(e => ({ ...e, calc: calcDaily(e) })));
});

// GET /api/entries/summary?month=YYYY-MM
router.get('/summary', async (req, res) => {
  const { month } = req.query;
  if (!month) return res.status(400).json({ error: 'month param required (YYYY-MM)' });

  const { start, end } = monthRange(month);
  const { data: rows, error } = await supabase.from('entries').select('*')
    .eq('user_id', req.userId).gte('date', start).lte('date', end);
  if (error) return res.status(500).json({ error: error.message });

  const totals = {
    insurance: 0, screening: 0, mixed: 0, partial: 0,
    km: 0, learning: 0, expenses: 0, total: 0, days: rows.length
  };
  for (const e of rows) {
    const c = calcDaily(e);
    totals.insurance += c.insurance;
    totals.screening += c.screening;
    totals.mixed += c.mixed;
    totals.partial += c.partial;
    totals.km += c.km;
    totals.learning += c.learning;
    totals.expenses += c.expenses;
    totals.total += c.total;
  }
  res.json(totals);
});

// GET /api/entries/backup
router.get('/backup', async (req, res) => {
  const { data: rows, error } = await supabase.from('entries').select('*')
    .eq('user_id', req.userId).order('date', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  const entries = rows.map(({ user_id, id, ...e }) => e);
  res.json({ exported_at: new Date().toISOString(), entries });
});

// POST /api/entries  (upsert by date)
router.post('/', async (req, res) => {
  const { date, insurance_tests, screening_tests, mixed_screening_tests,
          partial_tests, kilometers, learning_hours, food_expense, parking_expense } = req.body;
  if (!date) return res.status(400).json({ error: 'date is required' });

  const { data: entry, error } = await supabase.from('entries').upsert({
    user_id: req.userId,
    date,
    insurance_tests: insurance_tests || 0,
    screening_tests: screening_tests || 0,
    mixed_screening_tests: mixed_screening_tests || 0,
    partial_tests: partial_tests || 0,
    kilometers: kilometers || 0,
    learning_hours: learning_hours || 0,
    food_expense: food_expense || 0,
    parking_expense: parking_expense || 0,
  }, { onConflict: 'user_id,date' }).select().single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ ...entry, calc: calcDaily(entry) });
});

// PUT /api/entries/:id
router.put('/:id', async (req, res) => {
  // Verify ownership
  const { data: entry, error: fetchErr } = await supabase.from('entries').select('*')
    .eq('id', req.params.id).eq('user_id', req.userId).single();
  if (fetchErr || !entry) return res.status(404).json({ error: 'Entry not found' });

  const { insurance_tests, screening_tests, mixed_screening_tests,
          partial_tests, kilometers, learning_hours, food_expense, parking_expense } = req.body;

  const { data: updated, error: updateErr } = await supabase.from('entries').update({
    insurance_tests: insurance_tests ?? entry.insurance_tests,
    screening_tests: screening_tests ?? entry.screening_tests,
    mixed_screening_tests: mixed_screening_tests ?? entry.mixed_screening_tests,
    partial_tests: partial_tests ?? entry.partial_tests,
    kilometers: kilometers ?? entry.kilometers,
    learning_hours: learning_hours ?? entry.learning_hours,
    food_expense: food_expense ?? entry.food_expense,
    parking_expense: parking_expense ?? entry.parking_expense,
  }).eq('id', entry.id).select().single();

  if (updateErr) return res.status(500).json({ error: updateErr.message });
  res.json({ ...updated, calc: calcDaily(updated) });
});

// DELETE /api/entries/:id
router.delete('/:id', async (req, res) => {
  const { data: entry, error: fetchErr } = await supabase.from('entries').select('id')
    .eq('id', req.params.id).eq('user_id', req.userId).single();
  if (fetchErr || !entry) return res.status(404).json({ error: 'Entry not found' });

  const { error } = await supabase.from('entries').delete().eq('id', entry.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// POST /api/entries/restore
router.post('/restore', async (req, res) => {
  const { entries } = req.body;
  if (!Array.isArray(entries)) return res.status(400).json({ error: 'entries array required' });

  const rows = entries.filter(e => e.date).map(e => ({
    user_id: req.userId,
    date: e.date,
    insurance_tests: e.insurance_tests || 0,
    screening_tests: e.screening_tests || 0,
    mixed_screening_tests: e.mixed_screening_tests || 0,
    partial_tests: e.partial_tests || 0,
    kilometers: e.kilometers || 0,
    learning_hours: e.learning_hours || 0,
    food_expense: e.food_expense || 0,
    parking_expense: e.parking_expense || 0,
  }));

  const { error } = await supabase.from('entries').upsert(rows, { onConflict: 'user_id,date' });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, imported: rows.length });
});

module.exports = router;
