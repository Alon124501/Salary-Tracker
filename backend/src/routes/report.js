const express = require('express');
const ExcelJS = require('exceljs');
const multer = require('multer');
const supabase = require('../supabase');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

function extOf(file) {
  const map = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/heic': '.heic', 'image/webp': '.webp' };
  return map[file.mimetype] || '.jpg';
}

function calcDaily(e, mileageRate = 2) {
  const totalTests = (e.insurance_tests || 0) + (e.screening_tests || 0) +
                     (e.mixed_screening_tests || 0) + (e.partial_tests || 0);

  const insurance = (e.insurance_tests || 0) * 80;
  const screening = (e.screening_tests || 0) * 105;
  const mixed = (e.mixed_screening_tests || 0) * 120;
  const partial = (e.partial_tests || 0) * 50;
  const rawTestsPay = insurance + screening + mixed + partial;
  const MIN_TESTS_PAY = 240;
  const testsPay = totalTests > 0 && totalTests < 3 ? Math.max(rawTestsPay, MIN_TESTS_PAY) : rawTestsPay;
  const minBonus = testsPay - rawTestsPay;

  const km = (e.kilometers || 0) * mileageRate + ((e.kilometers || 0) >= 100 ? 100 : 0);
  const office = (e.office_hours || 0) * 60;
  const expenses = (e.food_expense || 0) + (e.parking_expense || 0);
  return { insurance, screening, mixed, partial, minBonus, km, office, expenses,
           total: testsPay + km + office + expenses };
}

function monthRange(month) {
  const [year, mon] = month.split('-').map(Number);
  const start = `${month}-01`;
  const end = new Date(year, mon, 0).toISOString().slice(0, 10);
  return { start, end };
}

function buildSheet(sheet, entries, mileageRate = 2) {
  const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
  const headerFont = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  const centerAlign = { horizontal: 'center', vertical: 'middle' };
  const moneyFont = { italic: true, size: 9, color: { argb: 'FF6B7280' } };
  const stripeFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
  const totalFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F2F5' } };
  const numCols = 12;

  sheet.columns = [
    { header: 'Date',                key: 'date',       width: 14 },
    { header: 'Insurance Tests',     key: 'ins',        width: 16 },
    { header: 'Screening Tests',     key: 'scr',        width: 16 },
    { header: 'Mixed Screening',     key: 'mix',        width: 16 },
    { header: 'Partial Tests',       key: 'par',        width: 14 },
    { header: 'Kilometers',          key: 'km',         width: 12 },
    { header: '100km Bonus (₪)',     key: 'km_bonus',   width: 14 },
    { header: 'Office Hours',        key: 'hrs',        width: 14 },
    { header: 'Food (₪)',            key: 'food',       width: 12 },
    { header: 'Parking (₪)',         key: 'parking',    width: 12 },
    { header: 'Tests Pay (₪)',       key: 'tests_pay',  width: 14 },
    { header: 'Min. Guarantee (₪)', key: 'min_bonus',  width: 16 },
  ];

  sheet.getRow(1).eachCell(cell => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = centerAlign;
  });
  sheet.getRow(1).height = 22;

  const sums = { ins: 0, scr: 0, mix: 0, par: 0, km: 0, km_bonus: 0, hrs: 0, food: 0, parking: 0,
                 tests_pay: 0, min_bonus: 0 };
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
      for (let col = 1; col <= numCols; col++) {
        dataRow.getCell(col).fill = stripeFill;
      }
    }

    sums.ins        += e.insurance_tests       || 0;
    sums.scr        += e.screening_tests       || 0;
    sums.mix        += e.mixed_screening_tests || 0;
    sums.par        += e.partial_tests         || 0;
    sums.km         += e.kilometers            || 0;
    sums.km_bonus   += (e.kilometers || 0) >= 100 ? 100 : 0;
    sums.hrs        += e.office_hours          || 0;
    sums.food       += e.food_expense          || 0;
    sums.parking    += e.parking_expense       || 0;
    sums.tests_pay  += tests_pay;
    sums.min_bonus  += c.minBonus || 0;
    moneySums.ins   += (e.insurance_tests       || 0) * 80;
    moneySums.scr   += (e.screening_tests       || 0) * 105;
    moneySums.mix   += (e.mixed_screening_tests || 0) * 120;
    moneySums.par   += (e.partial_tests         || 0) * 50;
    moneySums.km    += c.km;
    moneySums.hrs   += (e.office_hours || 0) * 60;
    grandTotal      += c.total;
  }

  // Blank separator
  sheet.addRow({});

  // TOTAL count row
  const totalsRow = sheet.addRow({ date: 'TOTAL', ...sums });
  totalsRow.eachCell(cell => {
    cell.font = { bold: true };
    cell.fill = totalFill;
    cell.alignment = centerAlign;
  });

  // TOTAL money sub-row
  const totalMoneyRow = sheet.addRow({
    ins:       moneySums.ins  > 0 ? `₪${moneySums.ins}`        : '',
    scr:       moneySums.scr  > 0 ? `₪${moneySums.scr}`        : '',
    mix:       moneySums.mix  > 0 ? `₪${moneySums.mix}`        : '',
    par:       moneySums.par  > 0 ? `₪${moneySums.par}`        : '',
    km:        moneySums.km   > 0 ? `₪${moneySums.km}`         : '',
    km_bonus:  sums.km_bonus  > 0 ? `₪${sums.km_bonus}`        : '',
    hrs:       moneySums.hrs  > 0 ? `₪${moneySums.hrs}`        : '',
    food:      sums.food      > 0 ? `₪${sums.food}`            : '',
    parking:   sums.parking   > 0 ? `₪${sums.parking}`         : '',
    tests_pay: sums.tests_pay > 0 ? `₪${sums.tests_pay}`       : '',
    min_bonus: sums.min_bonus > 0 ? `₪${sums.min_bonus}`       : '',
  });
  totalMoneyRow.height = 14;
  for (let col = 1; col <= numCols; col++) {
    const cell = totalMoneyRow.getCell(col);
    cell.font = { bold: true, italic: true, size: 9, color: { argb: 'FF6B7280' } };
    cell.fill = totalFill;
    cell.alignment = centerAlign;
  }

  // Grand total row
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

// GET /api/report/excel?month=YYYY-MM
router.get('/excel', async (req, res) => {
  const { month } = req.query;
  if (!month) return res.status(400).json({ error: 'month param required (YYYY-MM)' });

  const { data: user, error: userErr } = await supabase.from('profiles')
    .select('username, mileage_rate').eq('id', req.userId).single();
  if (userErr) return res.status(500).json({ error: userErr.message });

  const { start, end } = monthRange(month);
  const { data: entries, error: entriesErr } = await supabase.from('entries').select('*')
    .eq('user_id', req.userId).gte('date', start).lte('date', end).order('date', { ascending: true });
  if (entriesErr) return res.status(500).json({ error: entriesErr.message });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Salary Report');
  buildSheet(sheet, entries, user.mileage_rate ?? 2);

  const [year, monthNum] = month.split('-');
  const monthName = new Date(year, monthNum - 1).toLocaleString('en-US', { month: 'long' });
  const filename = `${monthName} ${year} - ${user.username}.xlsx`;

  const buffer = await workbook.xlsx.writeBuffer();
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
});

// GET /api/report/submission?month=YYYY-MM
router.get('/submission', async (req, res) => {
  const { month } = req.query;
  if (!month) return res.status(400).json({ error: 'month param required (YYYY-MM)' });

  const { data, error } = await supabase.from('report_submissions')
    .select('id, submitted_at, sent_at')
    .eq('user_id', req.userId)
    .eq('month', month)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });

  res.json({ submitted: !!data, submitted_at: data?.submitted_at || null, sent: !!data?.sent_at });
});

// POST /api/report/submit?month=YYYY-MM
router.post('/submit', upload.fields([{ name: 'receipts' }, { name: 'parking' }]), async (req, res) => {
  const { month } = req.query;
  if (!month) return res.status(400).json({ error: 'month param required (YYYY-MM)' });

  const receiptFiles = req.files?.receipts || [];
  const parkingFiles = req.files?.parking || [];

  // Upload files to Supabase Storage
  const basePath = `${req.userId}/${month}`;
  const uploadErrors = [];

  for (let i = 0; i < receiptFiles.length; i++) {
    const f = receiptFiles[i];
    const path = `${basePath}/food_${i}${extOf(f)}`;
    const { error } = await supabase.storage.from('reports').upload(path, f.buffer, {
      contentType: f.mimetype,
      upsert: true,
    });
    if (error) uploadErrors.push(error.message);
  }

  for (let i = 0; i < parkingFiles.length; i++) {
    const f = parkingFiles[i];
    const path = `${basePath}/parking_${i}.pdf`;
    const { error } = await supabase.storage.from('reports').upload(path, f.buffer, {
      contentType: f.mimetype,
      upsert: true,
    });
    if (error) uploadErrors.push(error.message);
  }

  if (uploadErrors.length > 0) {
    return res.status(500).json({ error: 'Failed to upload some files: ' + uploadErrors.join('; ') });
  }

  // Upsert submission record (reset sent_at if resubmitting)
  const { error: upsertErr } = await supabase.from('report_submissions')
    .upsert({ user_id: req.userId, month, submitted_at: new Date().toISOString(), sent_at: null, sent_by: null },
             { onConflict: 'user_id,month' });
  if (upsertErr) return res.status(500).json({ error: upsertErr.message });

  res.json({ success: true });
});

module.exports = router;
