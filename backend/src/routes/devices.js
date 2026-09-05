const express = require('express');
const nodemailer = require('nodemailer');
const supabase = require('../supabase');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const asyncHandler = require('../middleware/asyncHandler');
const { currentWeek } = require('../lib/equipmentWeek');

const router = express.Router();

const RECAP_EMAILS = ['alonm@mpcheck.co.il', 'davida@mpcheck.co.il'];

async function sendRecapEmail(name, deviceNames) {
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;
  if (!gmailUser || !gmailPass) {
    console.error('[devices] Gmail credentials not configured, skipping recap email');
    return;
  }
  const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: gmailUser, pass: gmailPass } });
  const list = deviceNames.length ? deviceNames.join(', ') : '(לא דווח על ציוד)';
  try {
    await transporter.sendMail({
      from: `Medical Pay <${gmailUser}>`,
      to: RECAP_EMAILS,
      subject: `סיכום ציוד — ${name}`,
      text: `${name} דיווח/ה על הציוד: ${list}`,
    });
  } catch (err) {
    console.error('[devices] Failed to send recap email:', err.message);
  }
}

// GET /api/devices/catalog — all authenticated
router.get('/catalog', auth, asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('device_catalog')
    .select('id, name, sort_order')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
}));

// POST /api/devices/catalog — admin
router.post('/catalog', auth, adminAuth, asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'נדרש שם' });

  const { data, error } = await supabase
    .from('device_catalog')
    .insert({ name: name.trim() })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}));

// DELETE /api/devices/catalog/:id — admin
router.delete('/catalog/:id', auth, adminAuth, asyncHandler(async (req, res) => {
  const { error } = await supabase
    .from('device_catalog')
    .delete()
    .eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
}));

// GET /api/devices/mine — authenticated employee
router.get('/mine', auth, asyncHandler(async (req, res) => {
  const week = currentWeek();
  const [{ data: devices, error: devErr }, { data: report, error: repErr }, { data: anyReport, error: anyErr }] = await Promise.all([
    supabase.from('user_devices').select('device_id').eq('user_id', req.userId),
    supabase.from('equipment_reports').select('id').eq('user_id', req.userId).eq('week', week).maybeSingle(),
    supabase.from('equipment_reports').select('id').eq('user_id', req.userId).limit(1).maybeSingle(),
  ]);
  if (devErr) return res.status(500).json({ error: devErr.message });
  if (repErr) return res.status(500).json({ error: repErr.message });
  if (anyErr) return res.status(500).json({ error: anyErr.message });

  res.json({
    deviceIds: (devices || []).map(d => d.device_id),
    submittedThisWeek: !!report,
    everSubmitted: !!anyReport,
  });
}));

// POST /api/devices/report — authenticated employee
router.post('/report', auth, asyncHandler(async (req, res) => {
  const { deviceIds } = req.body;
  if (!Array.isArray(deviceIds)) return res.status(400).json({ error: 'נדרש מערך מזהי מכשירים' });

  const [{ data: profile, error: pErr }, { data: catalog, error: cErr }] = await Promise.all([
    supabase.from('profiles').select('first_name, last_name, username').eq('id', req.userId).single(),
    supabase.from('device_catalog').select('id, name'),
  ]);
  if (pErr) return res.status(500).json({ error: pErr.message });
  if (cErr) return res.status(500).json({ error: cErr.message });

  const catalogById = new Map((catalog || []).map(c => [c.id, c.name]));
  const validIds = deviceIds.filter(id => catalogById.has(id));

  const { error: delErr } = await supabase.from('user_devices').delete().eq('user_id', req.userId);
  if (delErr) {
    console.error('[devices/report] delete failed:', delErr);
    return res.status(500).json({ error: delErr.message });
  }

  if (validIds.length > 0) {
    const rows = validIds.map(device_id => ({ user_id: req.userId, device_id }));
    const { error: insErr } = await supabase.from('user_devices').insert(rows);
    if (insErr) {
      console.error('[devices/report] insert failed:', insErr);
      return res.status(500).json({ error: insErr.message });
    }
  }

  const week = currentWeek();
  const { error: repErr } = await supabase.from('equipment_reports')
    .upsert({ user_id: req.userId, week, submitted_at: new Date().toISOString() }, { onConflict: 'user_id,week' });
  if (repErr) {
    console.error('[devices/report] equipment_reports upsert failed:', repErr);
    return res.status(500).json({ error: repErr.message });
  }

  const name = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.username;
  const deviceNames = validIds.map(id => catalogById.get(id));
  await sendRecapEmail(name, deviceNames);

  res.json({ success: true, week });
}));

module.exports = router;
