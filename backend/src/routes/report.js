const express = require('express');
const ExcelJS = require('exceljs');
const nodemailer = require('nodemailer');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

function calcDaily(e) {
  const insurance = (e.insurance_tests || 0) * 80;
  const screening = (e.screening_tests || 0) * 105;
  const mixed = (e.mixed_screening_tests || 0) * 120;
  const partial = (e.partial_tests || 0) * 50;
  const km = (e.kilometers || 0) * 2 + ((e.kilometers || 0) >= 100 ? 100 : 0);
  const learning = (e.learning_hours || 0) * 60;
  const expenses = (e.food_expense || 0) + (e.parking_expense || 0);
  return { insurance, screening, mixed, partial, km, learning, expenses,
           total: insurance + screening + mixed + partial + km + learning + expenses };
}

// POST /api/report?month=YYYY-MM
router.post('/', async (req, res) => {
  const { month } = req.query;
  if (!month) return res.status(400).json({ error: 'month param required (YYYY-MM)' });

  const user = db.prepare('SELECT username FROM users WHERE id = ?').get(req.userId);
  const entries = db.prepare(
    "SELECT * FROM entries WHERE user_id = ? AND date LIKE ? ORDER BY date ASC"
  ).all(req.userId, `${month}%`);

  // Build Excel
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Salary Report');

  // Header style
  const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
  const headerFont = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  const centerAlign = { horizontal: 'center', vertical: 'middle' };

  sheet.columns = [
    { header: 'Date',                  key: 'date',           width: 14 },
    { header: 'Insurance Tests',       key: 'ins',            width: 16 },
    { header: 'Screening Tests',       key: 'scr',            width: 16 },
    { header: 'Mixed Screening',       key: 'mix',            width: 16 },
    { header: 'Partial Tests',         key: 'par',            width: 14 },
    { header: 'Kilometers',            key: 'km',             width: 12 },
    { header: 'Learning Hours',        key: 'hrs',            width: 14 },
    { header: 'Food (₪)',              key: 'food',           width: 12 },
    { header: 'Parking (₪)',           key: 'parking',        width: 12 },
    { header: 'Tests Pay (₪)',         key: 'tests_pay',      width: 14 },
    { header: 'KM Pay (₪)',            key: 'km_pay',         width: 12 },
    { header: 'Learning Pay (₪)',      key: 'learning_pay',   width: 15 },
    { header: 'Expenses (₪)',          key: 'expenses',       width: 12 },
    { header: 'Daily Total (₪)',       key: 'total',          width: 14 },
  ];

  // Style header row
  sheet.getRow(1).eachCell(cell => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = centerAlign;
  });
  sheet.getRow(1).height = 22;

  // Totals accumulators
  const sums = { ins: 0, scr: 0, mix: 0, par: 0, km: 0, hrs: 0, food: 0, parking: 0,
                 tests_pay: 0, km_pay: 0, learning_pay: 0, expenses: 0, total: 0 };

  for (const e of entries) {
    const c = calcDaily(e);
    const tests_pay = c.insurance + c.screening + c.mixed + c.partial;
    const row = {
      date: e.date,
      ins: e.insurance_tests,
      scr: e.screening_tests,
      mix: e.mixed_screening_tests,
      par: e.partial_tests,
      km: e.kilometers,
      hrs: e.learning_hours,
      food: e.food_expense,
      parking: e.parking_expense,
      tests_pay,
      km_pay: c.km,
      learning_pay: c.learning,
      expenses: c.expenses,
      total: c.total,
    };
    sheet.addRow(row);
    for (const k of Object.keys(sums)) sums[k] += row[k] || 0;
  }

  // Totals row
  sheet.addRow({});
  const totalsRow = sheet.addRow({
    date: 'TOTAL',
    ...sums,
  });
  totalsRow.eachCell(cell => {
    cell.font = { bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F2F5' } };
  });

  // Alternate row shading
  for (let i = 2; i <= entries.length + 1; i++) {
    if (i % 2 === 0) {
      sheet.getRow(i).eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
      });
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();

  // Format subject: "March 2026 - alon1"
  const [year, monthNum] = month.split('-');
  const monthName = new Date(year, monthNum - 1).toLocaleString('en-US', { month: 'long' });
  const subject = `${monthName} ${year} - ${user.username}`;

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  try {
    await transporter.sendMail({
      from: `Salary Tracker <${process.env.GMAIL_USER}>`,
      to: 'alon124501@gmail.com',
      subject,
      text: `Please find attached the salary report for ${monthName} ${year}.`,
      attachments: [{
        filename: `${subject}.xlsx`,
        content: buffer,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }],
    });
    res.json({ success: true, subject });
  } catch (mailErr) {
    console.error('Mail error:', mailErr.message);
    res.status(500).json({ error: mailErr.message });
  }
});

module.exports = router;
