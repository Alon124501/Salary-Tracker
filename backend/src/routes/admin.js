const express = require('express');
const ExcelJS = require('exceljs');
const archiver = require('archiver');
const nodemailer = require('nodemailer');
const supabase = require('../supabase');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const asyncHandler = require('../middleware/asyncHandler');
const { foodAudit, totalTestsFor } = require('../lib/payCalc');
const { buildSheet } = require('../lib/reportSheet');

const router = express.Router();
router.use(auth);
router.use(adminAuth);

const ACCOUNTING_EMAIL = 'alonm@mpcheck.co.il';
const PROFILE_SELECT = 'first_name, last_name, username';

function monthRange(month) {
  const [year, mon] = month.split('-').map(Number);
  return {
    start: `${month}-01`,
    end: new Date(year, mon, 0).toISOString().slice(0, 10),
  };
}

// ── Users ──────────────────────────────────────────────────────────────────

// GET /api/admin/users
router.get('/users', asyncHandler(async (req, res) => {
  const [{ data: profiles, error }, { data: devices, error: devErr }, { data: reports, error: repErr }] = await Promise.all([
    supabase.rpc('get_all_profiles'),
    supabase.from('user_devices').select('user_id, device_id, device_catalog(id, name)'),
    supabase.from('equipment_reports').select('user_id, submitted_at'),
  ]);
  if (error)  return res.status(500).json({ error: error.message });
  if (devErr) return res.status(500).json({ error: devErr.message });
  if (repErr) return res.status(500).json({ error: repErr.message });

  const devicesByUser = {};
  for (const d of devices || []) {
    if (!devicesByUser[d.user_id]) devicesByUser[d.user_id] = [];
    if (d.device_catalog) devicesByUser[d.user_id].push({ id: d.device_catalog.id, name: d.device_catalog.name });
  }

  const lastReportByUser = {};
  for (const r of reports || []) {
    const prev = lastReportByUser[r.user_id];
    if (!prev || r.submitted_at > prev) lastReportByUser[r.user_id] = r.submitted_at;
  }

  // Generate signed URLs for profession documents (1-week expiry)
  const withUrls = await Promise.all((profiles || []).map(async p => {
    let doc_url = null;
    if (p.profession_document_url) {
      const { data } = await supabase.storage
        .from('profession-documents')
        .createSignedUrl(p.profession_document_url, 604800);
      doc_url = data?.signedUrl || null;
    }
    return {
      ...p,
      profession_document_signed_url: doc_url,
      devices: devicesByUser[p.id] || [],
      last_reported: lastReportByUser[p.id] || null,
    };
  }));

  res.json(withUrls);
}));

// PATCH /api/admin/users/:id
router.patch('/users/:id', asyncHandler(async (req, res) => {
  const allowed = [
    'first_name', 'last_name', 'email', 'id_number', 'phone', 'address',
    'vehicle_type_color', 'vehicle_number', 'shift_preference',
    'clothing_size', 'uniform_sets', 'echo_certified', 'shirt_size', 'pants_size',
  ];

  const updates = {};
  if (req.body.is_admin !== undefined) {
    if (req.params.id === req.userId)
      return res.status(403).json({ error: 'לא ניתן לשנות את סטטוס הניהול של עצמך' });
    updates.is_admin = req.body.is_admin === true || req.body.is_admin === 'true';
  }
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key] === '' ? null : req.body[key];
  }
  if (Object.keys(updates).length === 0)
    return res.status(400).json({ error: 'לא סופקו שדות תקינים' });

  const { data, error } = await supabase.from('profiles').update(updates).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}));

// POST /api/admin/users/:id/devices — admin override, adds one device
router.post('/users/:id/devices', asyncHandler(async (req, res) => {
  const { device_id } = req.body;
  if (!device_id) return res.status(400).json({ error: 'נדרש מזהה מכשיר' });

  const { error } = await supabase.from('user_devices').insert({ user_id: req.params.id, device_id });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
}));

// DELETE /api/admin/users/:id/devices/:deviceId — admin override, removes one device
router.delete('/users/:id/devices/:deviceId', asyncHandler(async (req, res) => {
  const { error } = await supabase.from('user_devices')
    .delete().eq('user_id', req.params.id).eq('device_id', req.params.deviceId);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
}));

// DELETE /api/admin/users/:id — permanently delete an employee
router.delete('/users/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (id === req.userId) return res.status(400).json({ error: 'לא ניתן למחוק את החשבון שלך' });

  // Fetch document path before deletion (profile may cascade-delete with auth user)
  const { data: profile } = await supabase.from('profiles')
    .select('profession_document_url').eq('id', id).maybeSingle();

  const { error } = await supabase.auth.admin.deleteUser(id);
  if (error) return res.status(500).json({ error: error.message });

  if (profile?.profession_document_url) {
    await supabase.storage.from('profession-documents')
      .remove([profile.profession_document_url]).catch(() => {});
  }

  res.json({ success: true });
}));

// ── Reports ────────────────────────────────────────────────────────────────

// GET /api/admin/reports?month=YYYY-MM
router.get('/reports', asyncHandler(async (req, res) => {
  const { month } = req.query;
  if (!month) return res.status(400).json({ error: 'נדרש פרמטר חודש (YYYY-MM)' });

  const { start, end } = monthRange(month);

  const [
    { data: profiles, error: pErr },
    { data: allEntries, error: eErr },
    { data: approvals },
  ] = await Promise.all([
    supabase.from('profiles').select(`id, ${PROFILE_SELECT}`).order('first_name'),
    supabase.from('entries').select('*').gte('date', start).lte('date', end),
    supabase.from('user_monthly_approvals').select('user_id, approved_at').eq('month', month),
  ]);
  if (pErr) return res.status(500).json({ error: pErr.message });
  if (eErr) return res.status(500).json({ error: eErr.message });

  const approvalMap = Object.fromEntries((approvals || []).map(a => [a.user_id, a.approved_at]));

  const entriesByUser = {};
  for (const e of allEntries || []) {
    if (!entriesByUser[e.user_id]) entriesByUser[e.user_id] = [];
    entriesByUser[e.user_id].push(e);
  }

  const summaries = profiles.map(p => {
    const entries = entriesByUser[p.id] || [];
    const totals = { insurance_tests: 0, screening_tests: 0, mixed_screening_tests: 0,
                     partial_tests: 0, kilometers: 0, office_hours: 0, total_tests: 0, days: entries.length };
    for (const e of entries) {
      totals.insurance_tests      += e.insurance_tests       || 0;
      totals.screening_tests      += e.screening_tests       || 0;
      totals.mixed_screening_tests += e.mixed_screening_tests || 0;
      totals.partial_tests        += e.partial_tests         || 0;
      totals.kilometers           += e.kilometers            || 0;
      totals.office_hours         += e.office_hours          || 0;
      totals.total_tests          += totalTestsFor(e);
    }
    return {
      user: {
        id: p.id,
        name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.username,
        username: p.username,
      },
      totals,
      foodAudit: foodAudit(entries),
      approved: approvalMap[p.id] ? { at: approvalMap[p.id] } : null,
    };
  });

  res.json({ month, summaries });
}));

// POST /api/admin/reports/approve
router.post('/reports/approve', asyncHandler(async (req, res) => {
  const { month } = req.body;
  if (!month) return res.status(400).json({ error: 'נדרש חודש' });

  const { data: existing } = await supabase.from('monthly_report_approvals').select('id').eq('month', month).maybeSingle();
  if (existing) return res.status(409).json({ error: 'החודש הזה כבר אושר ונשלח.' });

  const { start, end } = monthRange(month);
  const [year, mon] = month.split('-').map(Number);
  const monthName = new Date(year, mon - 1).toLocaleString('he-IL', { month: 'long' });

  const [
    { data: profiles, error: pErr },
    { data: allEntries, error: eErr },
  ] = await Promise.all([
    supabase.from('profiles').select(`id, ${PROFILE_SELECT}`).order('first_name'),
    supabase.from('entries').select('*').gte('date', start).lte('date', end).order('date', { ascending: true }),
  ]);
  if (pErr) return res.status(500).json({ error: pErr.message });
  if (eErr) return res.status(500).json({ error: eErr.message });

  const entriesByUser = {};
  for (const e of allEntries || []) {
    if (!entriesByUser[e.user_id]) entriesByUser[e.user_id] = [];
    entriesByUser[e.user_id].push(e);
  }

  // Build ZIP of one Excel per user
  const zipBuffer = await new Promise((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 6 } });
    const chunks = [];
    archive.on('data', chunk => chunks.push(chunk));
    archive.on('end', () => resolve(Buffer.concat(chunks)));
    archive.on('error', reject);

    (async () => {
      for (const p of profiles) {
        const entries = entriesByUser[p.id] || [];
        if (entries.length === 0) continue;
        const name = `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.username;

        const workbook = new ExcelJS.Workbook();
        buildSheet(workbook.addWorksheet('Salary Report'), entries, p, `${name} — ${monthName} ${year}`);
        const buf = await workbook.xlsx.writeBuffer();
        archive.append(Buffer.from(buf), { name: `${name} - ${monthName} ${year}.xlsx` });
      }
      archive.finalize();
    })().catch(reject);
  });

  // Send to accounting
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;
  if (!gmailUser || !gmailPass)
    return res.status(500).json({ error: 'פרטי ההתחברות ל-Gmail אינם מוגדרים בשרת' });

  const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: gmailUser, pass: gmailPass } });
  await transporter.sendMail({
    from: `Medical Pay <${gmailUser}>`,
    to: ACCOUNTING_EMAIL,
    subject: `חבילת דוחות חודשית — ${monthName} ${year}`,
    text: `מצורפים כל דוחות השכר עבור ${monthName} ${year}.`,
    attachments: [{ filename: `reports-${month}.zip`, content: zipBuffer, contentType: 'application/zip' }],
  });

  await supabase.from('monthly_report_approvals').insert({ month, approved_by: req.userId });

  res.json({ success: true, month });
}));

// GET /api/admin/users/:userId/report/excel?month=YYYY-MM
router.get('/users/:userId/report/excel', asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { month } = req.query;
  if (!month) return res.status(400).json({ error: 'נדרש פרמטר חודש (YYYY-MM)' });

  const { start, end } = monthRange(month);
  const [year, mon] = month.split('-').map(Number);
  const monthName = new Date(year, mon - 1).toLocaleString('he-IL', { month: 'long' });

  const [{ data: profile }, { data: entries }] = await Promise.all([
    supabase.from('profiles').select(PROFILE_SELECT).eq('id', userId).single(),
    supabase.from('entries').select('*').eq('user_id', userId).gte('date', start).lte('date', end).order('date', { ascending: true }),
  ]);
  if (!profile) return res.status(404).json({ error: 'משתמש לא נמצא' });
  if (!entries || entries.length === 0)
    return res.status(404).json({ error: 'אין רשומות לחודש זה' });

  const name = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.username;
  const workbook = new ExcelJS.Workbook();
  buildSheet(workbook.addWorksheet('Salary Report'), entries || [], profile, `${name} — ${monthName} ${year}`);
  const buf = await workbook.xlsx.writeBuffer();

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="report.xlsx"; filename*=UTF-8''${encodeURIComponent(`${name} - ${monthName} ${year}.xlsx`)}`);
  res.send(Buffer.from(buf));
}));

// POST /api/admin/users/:userId/report/approve
router.post('/users/:userId/report/approve', asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { month } = req.body;
  if (!month) return res.status(400).json({ error: 'נדרש חודש' });

  const { data: existing } = await supabase.from('user_monthly_approvals')
    .select('id').eq('user_id', userId).eq('month', month).maybeSingle();
  if (existing) return res.status(409).json({ error: 'הדוח הזה כבר אושר ונשלח.' });

  try {
    const { start, end } = monthRange(month);
    const [year, mon] = month.split('-').map(Number);
    const monthName = new Date(year, mon - 1).toLocaleString('he-IL', { month: 'long' });

    const [{ data: profile }, { data: entriesRaw }] = await Promise.all([
      supabase.from('profiles').select(PROFILE_SELECT).eq('id', userId).single(),
      supabase.from('entries').select('*').eq('user_id', userId).gte('date', start).lte('date', end).order('date', { ascending: true }),
    ]);
    if (!profile) return res.status(404).json({ error: 'משתמש לא נמצא' });
    if (!entriesRaw || entriesRaw.length === 0)
      return res.status(404).json({ error: 'אין רשומות לחודש זה' });
    const entries = entriesRaw || [];

    const name = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.username;
    const workbook = new ExcelJS.Workbook();
    buildSheet(workbook.addWorksheet('Salary Report'), entries, profile, `${name} — ${monthName} ${year}`);
    const buf = await workbook.xlsx.writeBuffer();

    const gmailUser = process.env.GMAIL_USER;
    const gmailPass = process.env.GMAIL_APP_PASSWORD;
    if (!gmailUser || !gmailPass)
      return res.status(500).json({ error: 'פרטי ההתחברות ל-Gmail אינם מוגדרים בשרת' });

    // Build signed URLs for receipts (7-day expiry) — avoids Gmail size limits
    const receiptPaths = entries.flatMap(e => [
      ...(e.food_receipt_urls || []),
      ...(e.parking_receipt_urls || []),
    ]);
    const signedUrls = (await Promise.all(
      receiptPaths.map(async path => {
        const { data, error } = await supabase.storage.from('receipts').createSignedUrl(path, 60 * 60 * 24 * 7);
        if (error || !data?.signedUrl) return null;
        return { filename: path.split('/').pop(), url: data.signedUrl };
      })
    )).filter(Boolean);

    const receiptSection = signedUrls.length
      ? `\n\nקבלות (הקישורים תקפים ל-7 ימים):\n${signedUrls.map((r, i) => `${i + 1}. ${r.filename}\n   ${r.url}`).join('\n')}`
      : '';

    const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: gmailUser, pass: gmailPass } });
    await transporter.sendMail({
      from: `Medical Pay <${gmailUser}>`,
      to: ACCOUNTING_EMAIL,
      subject: `דוח שכר — ${name} ${monthName} ${year}`,
      text: `מצורף דוח השכר עבור ${name} (${monthName} ${year}).${receiptSection}`,
      attachments: [{
        filename: `${name} - ${monthName} ${year}.xlsx`,
        content: Buffer.from(buf),
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }],
    });

    const { data: approval, error: insertError } = await supabase.from('user_monthly_approvals')
      .insert({ user_id: userId, month, approved_by: req.userId })
      .select('approved_at').single();
    if (insertError) throw new Error(insertError.message);

    res.json({ success: true, approvedAt: approval.approved_at });
  } catch (err) {
    const msg = typeof err?.message === 'string' ? err.message : 'האישור נכשל';
    res.status(500).json({ error: msg });
  }
}));

module.exports = router;
