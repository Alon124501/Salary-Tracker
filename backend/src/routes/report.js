const express = require('express');
const ExcelJS = require('exceljs');
const archiver = require('archiver');
const supabase = require('../supabase');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

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

function monthRange(month) {
  const [year, mon] = month.split('-').map(Number);
  const start = `${month}-01`;
  const end = new Date(year, mon, 0).toISOString().slice(0, 10);
  return { start, end };
}

function buildSheet(sheet, entries, mileageRate = 2, title = '', bonuses = []) {
  const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
  const headerFont = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  const centerAlign = { horizontal: 'center', vertical: 'middle' };
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

  // Bonus section
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

  // Grand total row
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

// GET /api/report/excel?month=YYYY-MM
router.get('/excel', async (req, res) => {
  const { month } = req.query;
  if (!month) return res.status(400).json({ error: 'month param required (YYYY-MM)' });

  const { data: user, error: userErr } = await supabase.from('profiles')
    .select('first_name, last_name, username, mileage_rate').eq('id', req.userId).single();
  if (userErr) return res.status(500).json({ error: userErr.message });

  const { start, end } = monthRange(month);
  const [{ data: entries, error: entriesErr }, { data: bonuses }] = await Promise.all([
    supabase.from('entries').select('*')
      .eq('user_id', req.userId).gte('date', start).lte('date', end).order('date', { ascending: true }),
    supabase.from('admin_bonuses').select('*')
      .eq('user_id', req.userId).gte('date', start).lte('date', end).order('date'),
  ]);
  if (entriesErr) return res.status(500).json({ error: entriesErr.message });

  const [year, monthNum] = month.split('-').map(Number);
  const monthName = new Date(year, monthNum - 1).toLocaleString('en-US', { month: 'long' });
  const name = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username;
  const title = `${name} — ${monthName} ${year}`;
  const filename = `${name} - ${monthName} ${year}.xlsx`;

  try {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Salary Report');
    buildSheet(sheet, entries || [], user.mileage_rate ?? 2, title, bonuses || []);

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (err) {
    console.error('[report/excel] Error:', err.message, err.stack);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/report/download-zip?month=YYYY-MM
router.get('/download-zip', async (req, res) => {
  const { month } = req.query;
  if (!month) return res.status(400).json({ error: 'month param required (YYYY-MM)' });

  const { data: user, error: userErr } = await supabase.from('profiles')
    .select('first_name, last_name, username, mileage_rate').eq('id', req.userId).single();
  if (userErr) return res.status(500).json({ error: userErr.message });

  const { start, end } = monthRange(month);
  const [{ data: entries, error: entriesErr }, { data: bonuses }] = await Promise.all([
    supabase.from('entries').select('*')
      .eq('user_id', req.userId).gte('date', start).lte('date', end).order('date', { ascending: true }),
    supabase.from('admin_bonuses').select('*')
      .eq('user_id', req.userId).gte('date', start).lte('date', end).order('date'),
  ]);
  if (entriesErr) return res.status(500).json({ error: entriesErr.message });

  const [year, monthNum] = month.split('-').map(Number);
  const monthName = new Date(year, monthNum - 1).toLocaleString('en-US', { month: 'long' });
  const name = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username;
  const title = `${name} — ${monthName} ${year}`;

  try {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Salary Report');
    buildSheet(sheet, entries || [], user.mileage_rate ?? 2, title, bonuses || []);
    const excelBuffer = await workbook.xlsx.writeBuffer();

    const filename = `${name} - ${monthName} ${year}.zip`;
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Content-Type', 'application/zip');

    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.on('error', err => {
      console.error('[report/download-zip] Archive error:', err.message);
      res.end();
    });
    archive.pipe(res);

    archive.append(Buffer.from(excelBuffer), { name: `${name} - ${monthName} ${year}.xlsx` });
    archive.append(Buffer.alloc(0), { name: 'Food Receipts/' });
    archive.append(Buffer.alloc(0), { name: 'Parking Receipts/' });

    for (const entry of entries || []) {
      for (const path of entry.food_receipt_urls || []) {
        const { data: blob, error: dlErr } = await supabase.storage.from('receipts').download(path);
        if (dlErr || !blob) continue;
        const arrayBuf = await blob.arrayBuffer();
        archive.append(Buffer.from(arrayBuf), { name: `Food Receipts/${entry.date} - ${path.split('/').pop()}` });
      }
      for (const path of entry.parking_receipt_urls || []) {
        const { data: blob, error: dlErr } = await supabase.storage.from('receipts').download(path);
        if (dlErr || !blob) continue;
        const arrayBuf = await blob.arrayBuffer();
        archive.append(Buffer.from(arrayBuf), { name: `Parking Receipts/${entry.date} - ${path.split('/').pop()}` });
      }
    }

    await archive.finalize();
  } catch (err) {
    console.error('[report/download-zip] Error:', err.message, err.stack);
    if (!res.headersSent) return res.status(500).json({ error: err.message });
    res.end();
  }
});

module.exports = router;
