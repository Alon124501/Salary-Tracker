const express = require('express');
const ExcelJS = require('exceljs');
const archiver = require('archiver');
const nodemailer = require('nodemailer');
const supabase = require('../supabase');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');

const router = express.Router();
router.use(auth);
router.use(adminAuth);

const ACCOUNTING_EMAIL = 'Yelena.p@mpcheck.co.il';
const EQUIPMENT_TYPES = ['bone_density', 'tonometer', 'echocardiogram', 'tanita', 'ge'];

function calcDaily(e, mileageRate = 2) {
  const totalTests = (e.insurance_tests || 0) + (e.screening_tests || 0) +
                     (e.mixed_screening_tests || 0) + (e.partial_tests || 0);
  const insurance  = (e.insurance_tests || 0) * 80;
  const screening  = (e.screening_tests || 0) * 105;
  const mixed      = (e.mixed_screening_tests || 0) * 120;
  const partial    = (e.partial_tests || 0) * 50;
  const rawTestsPay = insurance + screening + mixed + partial;
  const MIN_TESTS_PAY = 240;
  const testsPay = totalTests > 0 && totalTests < 3 ? Math.max(rawTestsPay, MIN_TESTS_PAY) : rawTestsPay;
  const minBonus = testsPay - rawTestsPay;
  const km       = (e.kilometers || 0) * mileageRate + ((e.kilometers || 0) >= 100 ? 100 : 0);
  const office   = (e.office_hours || 0) * 60;
  const expenses = (e.food_expense || 0) + (e.parking_expense || 0);
  return { insurance, screening, mixed, partial, minBonus, km, office, expenses,
           total: testsPay + km + office + expenses };
}

function buildSheet(sheet, entries, mileageRate = 2) {
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
    const c = calcDaily(e, mileageRate);
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
    moneySums.ins  += (e.insurance_tests       || 0) * 80;
    moneySums.scr  += (e.screening_tests       || 0) * 105;
    moneySums.mix  += (e.mixed_screening_tests || 0) * 120;
    moneySums.par  += (e.partial_tests         || 0) * 50;
    moneySums.km   += c.km;
    moneySums.hrs  += (e.office_hours || 0) * 60;
    grandTotal     += c.total;
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

  sheet.addRow({});
  const grandTotalRow = sheet.addRow({ date: 'TOTAL EARNINGS', min_bonus: `₪${grandTotal}` });
  grandTotalRow.height = 26;
  for (let col = 1; col <= numCols; col++) {
    const cell = grandTotalRow.getCell(col);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
    cell.alignment = centerAlign;
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
router.get('/users', async (req, res) => {
  const [{ data: profiles, error }, { data: equipment, error: eqErr }] = await Promise.all([
    supabase.from('profiles')
      .select('id, first_name, last_name, username, email, district, profession, profession_document_url, phone, shifts_per_week, shift_preference, clothing_size, uniform_sets, echo_certified, mileage_rate, is_admin')
      .order('first_name'),
    supabase.from('user_equipment').select('user_id, equipment_type'),
  ]);
  if (error)  return res.status(500).json({ error: error.message });
  if (eqErr)  return res.status(500).json({ error: eqErr.message });

  const eqByUser = {};
  for (const eq of equipment || []) {
    if (!eqByUser[eq.user_id]) eqByUser[eq.user_id] = [];
    eqByUser[eq.user_id].push(eq.equipment_type);
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
    return { ...p, profession_document_signed_url: doc_url, equipment: eqByUser[p.id] || [] };
  }));

  res.json(withUrls);
});

// PATCH /api/admin/users/:id
router.patch('/users/:id', async (req, res) => {
  const allowed = ['clothing_size', 'uniform_sets', 'echo_certified', 'mileage_rate', 'shift_preference', 'shifts_per_week'];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  if (Object.keys(updates).length === 0)
    return res.status(400).json({ error: 'No valid fields provided' });

  const { data, error } = await supabase.from('profiles').update(updates).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/admin/users/:id/equipment
router.post('/users/:id/equipment', async (req, res) => {
  const { equipment_type } = req.body;
  if (!EQUIPMENT_TYPES.includes(equipment_type))
    return res.status(400).json({ error: `Invalid equipment_type. Valid: ${EQUIPMENT_TYPES.join(', ')}` });

  const { error } = await supabase.from('user_equipment').insert({ user_id: req.params.id, equipment_type });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// DELETE /api/admin/users/:id/equipment/:type
router.delete('/users/:id/equipment/:type', async (req, res) => {
  const { error } = await supabase.from('user_equipment')
    .delete().eq('user_id', req.params.id).eq('equipment_type', req.params.type);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ── Reports ────────────────────────────────────────────────────────────────

// GET /api/admin/reports?month=YYYY-MM
router.get('/reports', async (req, res) => {
  const { month } = req.query;
  if (!month) return res.status(400).json({ error: 'month param required (YYYY-MM)' });

  const { start, end } = monthRange(month);

  const [
    { data: profiles, error: pErr },
    { data: allEntries, error: eErr },
    { data: approvals },
  ] = await Promise.all([
    supabase.from('profiles').select('id, first_name, last_name, username, mileage_rate').order('first_name'),
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
    const mileageRate = p.mileage_rate ?? 2;
    const totals = { insurance_tests: 0, screening_tests: 0, mixed_screening_tests: 0,
                     partial_tests: 0, kilometers: 0, office_hours: 0, total: 0, days: entries.length };
    for (const e of entries) {
      const c = calcDaily(e, mileageRate);
      totals.insurance_tests      += e.insurance_tests       || 0;
      totals.screening_tests      += e.screening_tests       || 0;
      totals.mixed_screening_tests += e.mixed_screening_tests || 0;
      totals.partial_tests        += e.partial_tests         || 0;
      totals.kilometers           += e.kilometers            || 0;
      totals.office_hours         += e.office_hours          || 0;
      totals.total                += c.total;
    }
    return {
      user: {
        id: p.id,
        name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.username,
        username: p.username,
      },
      totals,
      approved: approvalMap[p.id] ? { at: approvalMap[p.id] } : null,
    };
  });

  res.json({ month, summaries });
});

// POST /api/admin/reports/approve
router.post('/reports/approve', async (req, res) => {
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
  ] = await Promise.all([
    supabase.from('profiles').select('id, first_name, last_name, username, mileage_rate').order('first_name'),
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
        const mileageRate = p.mileage_rate ?? 2;
        const name = `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.username;

        const workbook = new ExcelJS.Workbook();
        buildSheet(workbook.addWorksheet('Salary Report'), entries, mileageRate);
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
});

// GET /api/admin/users/:userId/report/excel?month=YYYY-MM
router.get('/users/:userId/report/excel', async (req, res) => {
  const { userId } = req.params;
  const { month } = req.query;
  if (!month) return res.status(400).json({ error: 'month param required (YYYY-MM)' });

  const { start, end } = monthRange(month);
  const [year, mon] = month.split('-').map(Number);
  const monthName = new Date(year, mon - 1).toLocaleString('en-US', { month: 'long' });

  const [{ data: profile }, { data: entries }] = await Promise.all([
    supabase.from('profiles').select('first_name, last_name, username, mileage_rate').eq('id', userId).single(),
    supabase.from('entries').select('*').eq('user_id', userId).gte('date', start).lte('date', end).order('date', { ascending: true }),
  ]);
  if (!profile) return res.status(404).json({ error: 'User not found' });
  if (!entries || entries.length === 0) return res.status(404).json({ error: 'No entries for this month' });

  const name = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.username;
  const workbook = new ExcelJS.Workbook();
  buildSheet(workbook.addWorksheet('Salary Report'), entries, profile.mileage_rate ?? 2);
  const buf = await workbook.xlsx.writeBuffer();

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${name} - ${monthName} ${year}.xlsx"`);
  res.send(Buffer.from(buf));
});

// POST /api/admin/users/:userId/report/approve
router.post('/users/:userId/report/approve', async (req, res) => {
  const { userId } = req.params;
  const { month } = req.body;
  if (!month) return res.status(400).json({ error: 'month is required' });

  const { data: existing } = await supabase.from('user_monthly_approvals')
    .select('id').eq('user_id', userId).eq('month', month).maybeSingle();
  if (existing) return res.status(409).json({ error: 'This report has already been approved and sent.' });

  const { start, end } = monthRange(month);
  const [year, mon] = month.split('-').map(Number);
  const monthName = new Date(year, mon - 1).toLocaleString('en-US', { month: 'long' });

  const [{ data: profile }, { data: entries }] = await Promise.all([
    supabase.from('profiles').select('first_name, last_name, username, mileage_rate').eq('id', userId).single(),
    supabase.from('entries').select('*').eq('user_id', userId).gte('date', start).lte('date', end).order('date', { ascending: true }),
  ]);
  if (!profile) return res.status(404).json({ error: 'User not found' });
  if (!entries || entries.length === 0) return res.status(404).json({ error: 'No entries for this month' });

  const name = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.username;
  const workbook = new ExcelJS.Workbook();
  buildSheet(workbook.addWorksheet('Salary Report'), entries, profile.mileage_rate ?? 2);
  const buf = await workbook.xlsx.writeBuffer();

  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;
  if (!gmailUser || !gmailPass)
    return res.status(500).json({ error: 'Gmail credentials not configured on server' });

  // Build attachments: Excel + all receipt photos
  const attachments = [{
    filename: `${name} - ${monthName} ${year}.xlsx`,
    content: Buffer.from(buf),
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }];

  const receiptPaths = entries.flatMap(e => [
    ...(e.food_receipt_urls || []),
    ...(e.parking_receipt_urls || []),
  ]);
  for (const path of receiptPaths) {
    const { data: blob, error: dlErr } = await supabase.storage.from('receipts').download(path);
    if (dlErr || !blob) continue;
    const arrayBuf = await blob.arrayBuffer();
    attachments.push({ filename: path.split('/').pop(), content: Buffer.from(arrayBuf) });
  }

  const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: gmailUser, pass: gmailPass } });
  await transporter.sendMail({
    from: `Salary Tracker <${gmailUser}>`,
    to: ACCOUNTING_EMAIL,
    subject: `Salary Report — ${name} ${monthName} ${year}`,
    text: `Please find attached the salary report for ${name} (${monthName} ${year}).`,
    attachments,
  });

  const { data: approval } = await supabase.from('user_monthly_approvals')
    .insert({ user_id: userId, month, approved_by: req.userId })
    .select('approved_at').single();

  res.json({ success: true, approvedAt: approval.approved_at });
});

// ── Submissions ────────────────────────────────────────────────────────────

// GET /api/admin/submissions?month=YYYY-MM
router.get('/submissions', async (req, res) => {
  const { month } = req.query;
  if (!month) return res.status(400).json({ error: 'month param required (YYYY-MM)' });

  const { data, error } = await supabase.from('report_submissions')
    .select('id, user_id, month, submitted_at, sent_at')
    .eq('month', month)
    .order('submitted_at', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });

  const userIds = (data || []).map(s => s.user_id);
  let profilesMap = {};
  if (userIds.length > 0) {
    const { data: profiles } = await supabase.from('profiles')
      .select('id, first_name, last_name, username')
      .in('id', userIds);
    for (const p of profiles || []) {
      profilesMap[p.id] = { id: p.id, name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.username };
    }
  }

  const submissions = (data || []).map(s => ({
    id: s.id,
    month: s.month,
    submitted_at: s.submitted_at,
    sent_at: s.sent_at,
    user: profilesMap[s.user_id] || { id: s.user_id, name: s.user_id },
  }));

  res.json({ month, submissions });
});

// POST /api/admin/submissions/:submissionId/send
router.post('/submissions/:submissionId/send', async (req, res) => {
  const { submissionId } = req.params;

  const { data: submission, error: subErr } = await supabase.from('report_submissions')
    .select('id, user_id, month, sent_at').eq('id', submissionId).single();
  if (subErr || !submission) return res.status(404).json({ error: 'Submission not found' });
  if (submission.sent_at) return res.status(409).json({ error: 'This report has already been sent.' });

  const { month } = submission;
  const { start, end } = monthRange(month);
  const [year, mon] = month.split('-').map(Number);
  const monthName = new Date(year, mon - 1).toLocaleString('en-US', { month: 'long' });

  // Load user profile and entries
  const [{ data: profile, error: pErr }, { data: entries, error: eErr }] = await Promise.all([
    supabase.from('profiles').select('first_name, last_name, username, mileage_rate').eq('id', submission.user_id).single(),
    supabase.from('entries').select('*').eq('user_id', submission.user_id).gte('date', start).lte('date', end).order('date', { ascending: true }),
  ]);
  if (pErr) return res.status(500).json({ error: pErr.message });
  if (eErr) return res.status(500).json({ error: eErr.message });

  const name = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.username;
  const mileageRate = profile.mileage_rate ?? 2;

  // Build Excel
  const workbook = new ExcelJS.Workbook();
  buildSheet(workbook.addWorksheet('Salary Report'), entries || [], mileageRate);
  const excelBuffer = await workbook.xlsx.writeBuffer();

  // Download receipt files from storage
  const storagePath = `${submission.user_id}/${month}`;
  const { data: fileList } = await supabase.storage.from('reports').list(storagePath);

  const attachments = [{
    filename: `${name} - ${monthName} ${year}.xlsx`,
    content: Buffer.from(excelBuffer),
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }];

  for (const file of fileList || []) {
    const { data: blob, error: dlErr } = await supabase.storage.from('reports').download(`${storagePath}/${file.name}`);
    if (dlErr || !blob) continue;
    const arrayBuf = await blob.arrayBuffer();
    attachments.push({
      filename: file.name,
      content: Buffer.from(arrayBuf),
    });
  }

  // Send email
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;
  if (!gmailUser || !gmailPass)
    return res.status(500).json({ error: 'Gmail credentials not configured on server' });

  const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: gmailUser, pass: gmailPass } });
  try {
    await transporter.sendMail({
      from: `Salary Tracker <${gmailUser}>`,
      to: ACCOUNTING_EMAIL,
      subject: `${monthName} ${year} - ${name}`,
      text: `Please find attached the salary report for ${name} — ${monthName} ${year}.`,
      attachments,
    });
  } catch (mailErr) {
    console.error('Mail error:', mailErr.message);
    return res.status(500).json({ error: mailErr.message });
  }

  // Mark as sent
  await supabase.from('report_submissions')
    .update({ sent_at: new Date().toISOString(), sent_by: req.userId })
    .eq('id', submissionId);

  res.json({ success: true });
});

module.exports = router;
