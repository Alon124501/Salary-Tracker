const express = require('express');
const ExcelJS = require('exceljs');
const archiver = require('archiver');
const nodemailer = require('nodemailer');
const supabase = require('../supabase');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const asyncHandler = require('../middleware/asyncHandler');
const { calcDaily } = require('../lib/payCalc');

const router = express.Router();
router.use(auth);
router.use(adminAuth);

const ACCOUNTING_EMAIL = 'davida@mpcheck.co.il';
const PROFILE_SELECT = 'first_name, last_name, username, payment_type, global_salary, mileage_rate, insurance_rate, screening_rate, mixed_screening_rate, partial_rate, hourly_rate';

function buildSheet(sheet, entries, profile = {}, title = '', bonuses = []) {
  const headerFill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
  const headerFont   = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  const centerAlign  = { horizontal: 'center', vertical: 'middle' };
  const stripeFill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
  const totalFill    = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F2F5' } };
  const numCols = 12;

  sheet.columns = [
    { header: 'Date',                key: 'date',      width: 14 },
    { header: 'Insurance Tests',     key: 'ins',       width: 16 },
    { header: 'Screening Tests',     key: 'scr',       width: 16 },
    { header: 'Mixed Screening',     key: 'mix',       width: 16 },
    { header: 'Partial Tests',       key: 'par',       width: 14 },
    { header: 'Kilometers',          key: 'km',        width: 12 },
    { header: '100km Bonus (₪)',     key: 'km_bonus',  width: 14 },
    { header: 'Office Hours',        key: 'hrs',       width: 14 },
    { header: 'Food (₪)',            key: 'food',      width: 12 },
    { header: 'Parking (₪)',         key: 'parking',   width: 12 },
    { header: 'Tests Pay (₪)',       key: 'tests_pay', width: 14 },
    { header: 'Min. Guarantee (₪)', key: 'min_bonus', width: 16 },
  ];

  sheet.getRow(1).eachCell(cell => {
    cell.fill = headerFill; cell.font = headerFont; cell.alignment = centerAlign;
  });
  sheet.getRow(1).height = 22;

  const sums = { ins: 0, scr: 0, mix: 0, par: 0, km: 0, km_bonus: 0, hrs: 0,
                 food: 0, parking: 0, tests_pay: 0, min_bonus: 0 };
  const moneySums = { ins: 0, scr: 0, mix: 0, par: 0, km: 0, hrs: 0 };
  let grandTotal = 0;

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const c = calcDaily(e, profile);
    const tests_pay = c.insurance + c.screening + c.mixed + c.partial;
    const dataRow = sheet.addRow({
      date: e.date, ins: e.insurance_tests, scr: e.screening_tests,
      mix: e.mixed_screening_tests, par: e.partial_tests, km: e.kilometers,
      km_bonus: (e.kilometers || 0) >= 100 ? 100 : null,
      hrs: e.office_hours, food: e.food_expense, parking: e.parking_expense,
      tests_pay, min_bonus: c.minBonus || 0,
    });
    if (i % 2 === 0) {
      for (let col = 1; col <= numCols; col++) dataRow.getCell(col).fill = stripeFill;
    }
    sums.ins       += e.insurance_tests       || 0;
    sums.scr       += e.screening_tests       || 0;
    sums.mix       += e.mixed_screening_tests || 0;
    sums.par       += e.partial_tests         || 0;
    sums.km        += e.kilometers            || 0;
    sums.km_bonus  += (e.kilometers || 0) >= 100 ? 100 : 0;
    sums.hrs       += e.office_hours          || 0;
    sums.food      += e.food_expense          || 0;
    sums.parking   += e.parking_expense       || 0;
    sums.tests_pay += tests_pay;
    sums.min_bonus += c.minBonus || 0;
    moneySums.ins  += c.insurance;
    moneySums.scr  += c.screening;
    moneySums.mix  += c.mixed;
    moneySums.par  += c.partial;
    moneySums.km   += c.km;
    moneySums.hrs  += c.office;
    grandTotal     += c.total;
  }
  if (profile.payment_type === 'global') {
    grandTotal += profile.global_salary || 0;
  }

  sheet.addRow({});
  const totalsRow = sheet.addRow({ date: 'TOTAL', ...sums });
  totalsRow.eachCell(cell => { cell.font = { bold: true }; cell.fill = totalFill; cell.alignment = centerAlign; });

  const totalMoneyRow = sheet.addRow({
    ins: moneySums.ins > 0 ? `₪${moneySums.ins}` : '',
    scr: moneySums.scr > 0 ? `₪${moneySums.scr}` : '',
    mix: moneySums.mix > 0 ? `₪${moneySums.mix}` : '',
    par: moneySums.par > 0 ? `₪${moneySums.par}` : '',
    km:  moneySums.km  > 0 ? `₪${moneySums.km}`  : '',
    km_bonus:  sums.km_bonus  > 0 ? `₪${sums.km_bonus}`  : '',
    hrs:       moneySums.hrs  > 0 ? `₪${moneySums.hrs}`  : '',
    food:      sums.food      > 0 ? `₪${sums.food}`      : '',
    parking:   sums.parking   > 0 ? `₪${sums.parking}`   : '',
    tests_pay: sums.tests_pay > 0 ? `₪${sums.tests_pay}` : '',
    min_bonus: sums.min_bonus > 0 ? `₪${sums.min_bonus}` : '',
  });
  totalMoneyRow.height = 14;
  for (let col = 1; col <= numCols; col++) {
    const cell = totalMoneyRow.getCell(col);
    cell.font = { bold: true, italic: true, size: 9, color: { argb: 'FF6B7280' } };
    cell.fill = totalFill; cell.alignment = centerAlign;
  }

  let bonusTotal = 0;
  if (bonuses.length > 0) {
    sheet.addRow({});
    const bonusHeaderRow = sheet.addRow({ date: 'ADDITIONAL COMPENSATION' });
    for (let col = 1; col <= numCols; col++) {
      const cell = bonusHeaderRow.getCell(col);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDE9FE' } };
      cell.font = { bold: true, color: { argb: 'FF6D28D9' }, size: 10 };
      cell.alignment = centerAlign;
    }
    bonusHeaderRow.height = 20;
    for (let i = 0; i < bonuses.length; i++) {
      const b = bonuses[i];
      const bonusRow = sheet.addRow({ date: b.date, ins: b.note || '', min_bonus: `₪${b.amount}` });
      if (i % 2 === 0) {
        for (let col = 1; col <= numCols; col++) bonusRow.getCell(col).fill = stripeFill;
      }
      bonusTotal += Number(b.amount);
    }
    const bonusTotRow = sheet.addRow({ date: 'Total Bonuses', min_bonus: `₪${bonusTotal}` });
    bonusTotRow.eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FF6D28D9' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDE9FE' } };
      cell.alignment = centerAlign;
    });
  }

  sheet.addRow({});
  const grandTotalRow = sheet.addRow({ date: 'TOTAL EARNINGS', min_bonus: `₪${grandTotal + bonusTotal}` });
  grandTotalRow.height = 26;
  for (let col = 1; col <= numCols; col++) {
    const cell = grandTotalRow.getCell(col);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
    cell.alignment = centerAlign;
  }

  if (title) {
    sheet.spliceRows(1, 0, [title]);
    sheet.mergeCells(1, 1, 1, numCols);
    sheet.getRow(1).height = 30;
    const titleCell = sheet.getCell(1, 1);
    titleCell.value = title;
    titleCell.font = { bold: true, size: 14, color: { argb: 'FF1E1B4B' } };
    titleCell.alignment = centerAlign;
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDE9FE' } };
  }
}

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
    supabase.from('equipment_reports').select('user_id, month, submitted_at'),
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
const PAYMENT_TYPES = ['per_test', 'per_hour', 'global'];

router.patch('/users/:id', asyncHandler(async (req, res) => {
  const allowed = [
    'first_name', 'last_name', 'email', 'phone', 'profession', 'district', 'address',
    'vehicle_type_color', 'vehicle_number', 'shifts_per_week', 'shift_preference',
    'clothing_size', 'uniform_sets', 'echo_certified', 'mileage_rate',
    'payment_type', 'global_salary',
    'insurance_rate', 'screening_rate', 'mixed_screening_rate', 'partial_rate', 'hourly_rate',
  ];
  if (req.body.payment_type !== undefined && !PAYMENT_TYPES.includes(req.body.payment_type))
    return res.status(400).json({ error: `Invalid payment_type. Valid: ${PAYMENT_TYPES.join(', ')}` });

  const updates = {};
  if (req.body.is_admin !== undefined) {
    if (req.params.id === req.userId)
      return res.status(403).json({ error: 'Cannot change your own admin status' });
    updates.is_admin = req.body.is_admin === true || req.body.is_admin === 'true';
  }
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key] === '' ? null : req.body[key];
  }
  if (Object.keys(updates).length === 0)
    return res.status(400).json({ error: 'No valid fields provided' });

  const { data, error } = await supabase.from('profiles').update(updates).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}));

// POST /api/admin/users/:id/devices — admin override, adds one device
router.post('/users/:id/devices', asyncHandler(async (req, res) => {
  const { device_id } = req.body;
  if (!device_id) return res.status(400).json({ error: 'device_id is required' });

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
  if (id === req.userId) return res.status(400).json({ error: 'Cannot delete your own account' });

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

// ── Bonuses ────────────────────────────────────────────────────────────────

function nextMonth(month) {
  const [year, mon] = month.split('-').map(Number);
  if (mon === 12) return `${year + 1}-01-01`;
  return `${year}-${String(mon + 1).padStart(2, '0')}-01`;
}

// GET /api/admin/users/:userId/bonuses?month=YYYY-MM
router.get('/users/:userId/bonuses', asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { month } = req.query;
  let q = supabase.from('admin_bonuses').select('*').eq('user_id', userId).order('date');
  if (month) q = q.gte('date', `${month}-01`).lt('date', nextMonth(month));
  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}));

// POST /api/admin/users/:userId/bonuses  — { date, amount, note }
router.post('/users/:userId/bonuses', asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { date, amount, note } = req.body;
  if (!date || !amount) return res.status(400).json({ error: 'date and amount are required' });
  const { data, error } = await supabase
    .from('admin_bonuses')
    .insert({ user_id: userId, date, amount: Number(amount), note: note || null })
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}));

// DELETE /api/admin/users/:userId/bonuses/:bonusId
router.delete('/users/:userId/bonuses/:bonusId', asyncHandler(async (req, res) => {
  const { userId, bonusId } = req.params;
  const { error } = await supabase.from('admin_bonuses')
    .delete().eq('id', bonusId).eq('user_id', userId);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
}));

// ── Reports ────────────────────────────────────────────────────────────────

// GET /api/admin/reports?month=YYYY-MM
router.get('/reports', asyncHandler(async (req, res) => {
  const { month } = req.query;
  if (!month) return res.status(400).json({ error: 'month param required (YYYY-MM)' });

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
                     partial_tests: 0, kilometers: 0, office_hours: 0, total: 0, days: entries.length };
    for (const e of entries) {
      const c = calcDaily(e, p);
      totals.insurance_tests      += e.insurance_tests       || 0;
      totals.screening_tests      += e.screening_tests       || 0;
      totals.mixed_screening_tests += e.mixed_screening_tests || 0;
      totals.partial_tests        += e.partial_tests         || 0;
      totals.kilometers           += e.kilometers            || 0;
      totals.office_hours         += e.office_hours          || 0;
      totals.total                += c.total;
    }
    if (p.payment_type === 'global') {
      totals.total += p.global_salary || 0;
    }
    return {
      user: {
        id: p.id,
        name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.username,
        username: p.username,
        payment_type: p.payment_type,
      },
      totals,
      approved: approvalMap[p.id] ? { at: approvalMap[p.id] } : null,
    };
  });

  res.json({ month, summaries });
}));

// POST /api/admin/reports/approve
router.post('/reports/approve', asyncHandler(async (req, res) => {
  const { month } = req.body;
  if (!month) return res.status(400).json({ error: 'month is required' });

  const { data: existing } = await supabase.from('monthly_report_approvals').select('id').eq('month', month).maybeSingle();
  if (existing) return res.status(409).json({ error: 'This month has already been approved and sent.' });

  const { start, end } = monthRange(month);
  const [year, mon] = month.split('-').map(Number);
  const monthName = new Date(year, mon - 1).toLocaleString('en-US', { month: 'long' });

  const [
    { data: profiles, error: pErr },
    { data: allEntries, error: eErr },
    { data: allBonuses },
  ] = await Promise.all([
    supabase.from('profiles').select(`id, ${PROFILE_SELECT}`).order('first_name'),
    supabase.from('entries').select('*').gte('date', start).lte('date', end).order('date', { ascending: true }),
    supabase.from('admin_bonuses').select('*').gte('date', start).lte('date', end).order('date'),
  ]);
  if (pErr) return res.status(500).json({ error: pErr.message });
  if (eErr) return res.status(500).json({ error: eErr.message });

  const entriesByUser = {};
  for (const e of allEntries || []) {
    if (!entriesByUser[e.user_id]) entriesByUser[e.user_id] = [];
    entriesByUser[e.user_id].push(e);
  }
  const bonusesByUser = {};
  for (const b of allBonuses || []) {
    if (!bonusesByUser[b.user_id]) bonusesByUser[b.user_id] = [];
    bonusesByUser[b.user_id].push(b);
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
        if (entries.length === 0 && p.payment_type !== 'global') continue;
        const name = `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.username;

        const workbook = new ExcelJS.Workbook();
        buildSheet(workbook.addWorksheet('Salary Report'), entries, p, `${name} — ${monthName} ${year}`, bonusesByUser[p.id] || []);
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
    return res.status(500).json({ error: 'Gmail credentials not configured on server' });

  const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: gmailUser, pass: gmailPass } });
  await transporter.sendMail({
    from: `Salary Tracker <${gmailUser}>`,
    to: ACCOUNTING_EMAIL,
    subject: `Monthly Reports Bundle — ${monthName} ${year}`,
    text: `Please find attached all salary reports for ${monthName} ${year}.`,
    attachments: [{ filename: `reports-${month}.zip`, content: zipBuffer, contentType: 'application/zip' }],
  });

  await supabase.from('monthly_report_approvals').insert({ month, approved_by: req.userId });

  res.json({ success: true, month });
}));

// GET /api/admin/users/:userId/report/excel?month=YYYY-MM
router.get('/users/:userId/report/excel', asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { month } = req.query;
  if (!month) return res.status(400).json({ error: 'month param required (YYYY-MM)' });

  const { start, end } = monthRange(month);
  const [year, mon] = month.split('-').map(Number);
  const monthName = new Date(year, mon - 1).toLocaleString('en-US', { month: 'long' });

  const [{ data: profile }, { data: entries }, { data: bonuses }] = await Promise.all([
    supabase.from('profiles').select(PROFILE_SELECT).eq('id', userId).single(),
    supabase.from('entries').select('*').eq('user_id', userId).gte('date', start).lte('date', end).order('date', { ascending: true }),
    supabase.from('admin_bonuses').select('*').eq('user_id', userId).gte('date', start).lte('date', end).order('date'),
  ]);
  if (!profile) return res.status(404).json({ error: 'User not found' });
  if ((!entries || entries.length === 0) && profile.payment_type !== 'global')
    return res.status(404).json({ error: 'No entries for this month' });

  const name = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.username;
  const workbook = new ExcelJS.Workbook();
  buildSheet(workbook.addWorksheet('Salary Report'), entries || [], profile, `${name} — ${monthName} ${year}`, bonuses || []);
  const buf = await workbook.xlsx.writeBuffer();

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(`${name} - ${monthName} ${year}.xlsx`)}"`);
  res.send(Buffer.from(buf));
}));

// POST /api/admin/users/:userId/report/approve
router.post('/users/:userId/report/approve', asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { month } = req.body;
  if (!month) return res.status(400).json({ error: 'month is required' });

  const { data: existing } = await supabase.from('user_monthly_approvals')
    .select('id').eq('user_id', userId).eq('month', month).maybeSingle();
  if (existing) return res.status(409).json({ error: 'This report has already been approved and sent.' });

  try {
    const { start, end } = monthRange(month);
    const [year, mon] = month.split('-').map(Number);
    const monthName = new Date(year, mon - 1).toLocaleString('en-US', { month: 'long' });

    const [{ data: profile }, { data: entriesRaw }, { data: bonuses }] = await Promise.all([
      supabase.from('profiles').select(PROFILE_SELECT).eq('id', userId).single(),
      supabase.from('entries').select('*').eq('user_id', userId).gte('date', start).lte('date', end).order('date', { ascending: true }),
      supabase.from('admin_bonuses').select('*').eq('user_id', userId).gte('date', start).lte('date', end).order('date'),
    ]);
    if (!profile) return res.status(404).json({ error: 'User not found' });
    if ((!entriesRaw || entriesRaw.length === 0) && profile.payment_type !== 'global')
      return res.status(404).json({ error: 'No entries for this month' });
    const entries = entriesRaw || [];

    const name = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.username;
    const workbook = new ExcelJS.Workbook();
    buildSheet(workbook.addWorksheet('Salary Report'), entries, profile, `${name} — ${monthName} ${year}`, bonuses || []);
    const buf = await workbook.xlsx.writeBuffer();

    const gmailUser = process.env.GMAIL_USER;
    const gmailPass = process.env.GMAIL_APP_PASSWORD;
    if (!gmailUser || !gmailPass)
      return res.status(500).json({ error: 'Gmail credentials not configured on server' });

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
      ? `\n\nReceipts (links valid for 7 days):\n${signedUrls.map((r, i) => `${i + 1}. ${r.filename}\n   ${r.url}`).join('\n')}`
      : '';

    const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: gmailUser, pass: gmailPass } });
    await transporter.sendMail({
      from: `Salary Tracker <${gmailUser}>`,
      to: ACCOUNTING_EMAIL,
      subject: `Salary Report — ${name} ${monthName} ${year}`,
      text: `Please find attached the salary report for ${name} (${monthName} ${year}).${receiptSection}`,
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
    const msg = typeof err?.message === 'string' ? err.message : 'Failed to approve report';
    res.status(500).json({ error: msg });
  }
}));

module.exports = router;
