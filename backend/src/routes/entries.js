const express = require('express');
const db = require('../db');
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

// GET /api/entries?month=YYYY-MM
router.get('/', (req, res) => {
  const { month } = req.query;
  let rows;
  if (month) {
    rows = db.prepare(
      "SELECT * FROM entries WHERE user_id = ? AND date LIKE ? ORDER BY date DESC"
    ).all(req.userId, `${month}%`);
  } else {
    rows = db.prepare(
      "SELECT * FROM entries WHERE user_id = ? ORDER BY date DESC"
    ).all(req.userId);
  }
  const result = rows.map(e => ({ ...e, calc: calcDaily(e) }));
  res.json(result);
});

// GET /api/entries/summary?month=YYYY-MM
router.get('/summary', (req, res) => {
  const { month } = req.query;
  if (!month) return res.status(400).json({ error: 'month param required (YYYY-MM)' });

  const rows = db.prepare(
    "SELECT * FROM entries WHERE user_id = ? AND date LIKE ?"
  ).all(req.userId, `${month}%`);

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

// POST /api/entries  (upsert by date)
router.post('/', (req, res) => {
  const { date, insurance_tests, screening_tests, mixed_screening_tests,
          partial_tests, kilometers, learning_hours, food_expense, parking_expense } = req.body;
  if (!date) return res.status(400).json({ error: 'date is required' });

  const stmt = db.prepare(`
    INSERT INTO entries (user_id, date, insurance_tests, screening_tests, mixed_screening_tests,
      partial_tests, kilometers, learning_hours, food_expense, parking_expense)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, date) DO UPDATE SET
      insurance_tests = excluded.insurance_tests,
      screening_tests = excluded.screening_tests,
      mixed_screening_tests = excluded.mixed_screening_tests,
      partial_tests = excluded.partial_tests,
      kilometers = excluded.kilometers,
      learning_hours = excluded.learning_hours,
      food_expense = excluded.food_expense,
      parking_expense = excluded.parking_expense
  `);
  stmt.run(req.userId, date,
    insurance_tests || 0, screening_tests || 0, mixed_screening_tests || 0,
    partial_tests || 0, kilometers || 0, learning_hours || 0,
    food_expense || 0, parking_expense || 0);

  const entry = db.prepare('SELECT * FROM entries WHERE user_id = ? AND date = ?').get(req.userId, date);
  res.status(201).json({ ...entry, calc: calcDaily(entry) });
});

// PUT /api/entries/:id
router.put('/:id', (req, res) => {
  const entry = db.prepare('SELECT * FROM entries WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!entry) return res.status(404).json({ error: 'Entry not found' });

  const { insurance_tests, screening_tests, mixed_screening_tests,
          partial_tests, kilometers, learning_hours, food_expense, parking_expense } = req.body;

  db.prepare(`
    UPDATE entries SET
      insurance_tests = ?, screening_tests = ?, mixed_screening_tests = ?,
      partial_tests = ?, kilometers = ?, learning_hours = ?,
      food_expense = ?, parking_expense = ?
    WHERE id = ?
  `).run(
    insurance_tests ?? entry.insurance_tests,
    screening_tests ?? entry.screening_tests,
    mixed_screening_tests ?? entry.mixed_screening_tests,
    partial_tests ?? entry.partial_tests,
    kilometers ?? entry.kilometers,
    learning_hours ?? entry.learning_hours,
    food_expense ?? entry.food_expense,
    parking_expense ?? entry.parking_expense,
    entry.id
  );

  const updated = db.prepare('SELECT * FROM entries WHERE id = ?').get(entry.id);
  res.json({ ...updated, calc: calcDaily(updated) });
});

// DELETE /api/entries/:id
router.delete('/:id', (req, res) => {
  const entry = db.prepare('SELECT * FROM entries WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!entry) return res.status(404).json({ error: 'Entry not found' });
  db.prepare('DELETE FROM entries WHERE id = ?').run(entry.id);
  res.json({ success: true });
});

// GET /api/entries/backup
router.get('/backup', (req, res) => {
  const rows = db.prepare('SELECT * FROM entries WHERE user_id = ? ORDER BY date ASC').all(req.userId);
  const entries = rows.map(({ user_id, id, ...e }) => e);
  res.json({ exported_at: new Date().toISOString(), entries });
});

// POST /api/entries/restore
router.post('/restore', (req, res) => {
  const { entries } = req.body;
  if (!Array.isArray(entries)) return res.status(400).json({ error: 'entries array required' });
  const stmt = db.prepare(`
    INSERT INTO entries (user_id, date, insurance_tests, screening_tests, mixed_screening_tests,
      partial_tests, kilometers, learning_hours, food_expense, parking_expense)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, date) DO UPDATE SET
      insurance_tests = excluded.insurance_tests,
      screening_tests = excluded.screening_tests,
      mixed_screening_tests = excluded.mixed_screening_tests,
      partial_tests = excluded.partial_tests,
      kilometers = excluded.kilometers,
      learning_hours = excluded.learning_hours,
      food_expense = excluded.food_expense,
      parking_expense = excluded.parking_expense
  `);
  for (const e of entries) {
    if (!e.date) continue;
    stmt.run(req.userId, e.date,
      e.insurance_tests || 0, e.screening_tests || 0, e.mixed_screening_tests || 0,
      e.partial_tests || 0, e.kilometers || 0, e.learning_hours || 0,
      e.food_expense || 0, e.parking_expense || 0);
  }
  res.json({ success: true, imported: entries.length });
});

module.exports = router;
