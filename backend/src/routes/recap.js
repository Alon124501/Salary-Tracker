const express = require('express');
const auth     = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const asyncHandler = require('../middleware/asyncHandler');
const { buildRecap, buildDrilldown } = require('../lib/monthSummary');

// Admin-only: the recap is viewable solely inside the admin dashboard.
const router = express.Router();
router.use(auth);
router.use(adminAuth);

const MONTH_RE = /^\d{4}-\d{2}$/;
const UUID_RE = /^[0-9a-f-]{36}$/i;

function validMonth(req, res) {
  if (!MONTH_RE.test(req.params.month)) {
    res.status(400).json({ error: 'חודש לא תקין (YYYY-MM)' });
    return false;
  }
  return true;
}

function monthLabel(month) {
  return new Date(`${month}-15T12:00:00Z`).toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
}

// GET /api/recap/:month
router.get('/:month', asyncHandler(async (req, res) => {
  if (!validMonth(req, res)) return;
  res.json(await buildRecap(req.params.month));
}));

// GET /api/recap/:month/user/:userId — day-by-day drill-down
router.get('/:month/user/:userId', asyncHandler(async (req, res) => {
  if (!validMonth(req, res)) return;
  if (!UUID_RE.test(req.params.userId)) return res.status(400).json({ error: 'מזהה עובד לא תקין' });
  const days = await buildDrilldown(req.params.month, req.params.userId);
  if (!days) return res.status(404).json({ error: 'העובד לא נמצא' });
  res.json({ days });
}));

// GET /api/recap/:month/share — WhatsApp text; the link opens the admin dashboard (login required)
router.get('/:month/share', asyncHandler(async (req, res) => {
  if (!validMonth(req, res)) return;
  const { month } = req.params;
  const recap = await buildRecap(month);
  const base = req.get('origin') || process.env.FRONTEND_URL || '';
  const url = `${base}/admin?tab=recap&month=${month}`;

  const lines = [`📊 סיכום חודשי – ${monthLabel(month)}`];
  const top = recap.awards.mostTests;
  if (top) lines.push(`🏆 שיאן בדיקות: ${top.people.map(p => p.name).join(', ')} (${top.value})`);
  lines.push(`👥 ${recap.company.activeEmployees} עובדים פעילים · ${recap.company.tests} בדיקות`);
  lines.push(`לצפייה בסיכום המלא (כניסת מנהלים): ${url}`);
  res.json({ url, text: lines.join('\n') });
}));

module.exports = router;
