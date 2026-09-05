const express = require('express');
const ExcelJS = require('exceljs');
const archiver = require('archiver');
const supabase = require('../supabase');
const auth = require('../middleware/auth');
const { buildSheet } = require('../lib/reportSheet');
const { currentWeek } = require('../lib/equipmentWeek');

const router = express.Router();
router.use(auth);

const PROFILE_SELECT = 'first_name, last_name, username';

function monthRange(month) {
  const [year, mon] = month.split('-').map(Number);
  const start = `${month}-01`;
  const end = new Date(year, mon, 0).toISOString().slice(0, 10);
  return { start, end };
}

// GET /api/report/excel?month=YYYY-MM
router.get('/excel', async (req, res) => {
  const { month } = req.query;
  if (!month) return res.status(400).json({ error: 'month param required (YYYY-MM)' });

  const { data: user, error: userErr } = await supabase.from('profiles')
    .select(PROFILE_SELECT).eq('id', req.userId).single();
  if (userErr) return res.status(500).json({ error: userErr.message });

  const { start, end } = monthRange(month);
  const { data: entries, error: entriesErr } = await supabase.from('entries').select('*')
    .eq('user_id', req.userId).gte('date', start).lte('date', end).order('date', { ascending: true });
  if (entriesErr) return res.status(500).json({ error: entriesErr.message });

  const [year, monthNum] = month.split('-').map(Number);
  const monthName = new Date(year, monthNum - 1).toLocaleString('en-US', { month: 'long' });
  const name = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username;
  const title = `${name} — ${monthName} ${year}`;
  const filename = `${name} - ${monthName} ${year}.xlsx`;

  try {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Salary Report');
    buildSheet(sheet, entries || [], user, title);

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

  const { data: report, error: reportErr } = await supabase.from('equipment_reports')
    .select('id').eq('user_id', req.userId).eq('week', currentWeek()).maybeSingle();
  if (reportErr) return res.status(500).json({ error: reportErr.message });
  if (!report) return res.status(409).json({ error: 'equipment_report_required' });

  const { data: user, error: userErr } = await supabase.from('profiles')
    .select(PROFILE_SELECT).eq('id', req.userId).single();
  if (userErr) return res.status(500).json({ error: userErr.message });

  const { start, end } = monthRange(month);
  const { data: entries, error: entriesErr } = await supabase.from('entries').select('*')
    .eq('user_id', req.userId).gte('date', start).lte('date', end).order('date', { ascending: true });
  if (entriesErr) return res.status(500).json({ error: entriesErr.message });

  const [year, monthNum] = month.split('-').map(Number);
  const monthName = new Date(year, monthNum - 1).toLocaleString('en-US', { month: 'long' });
  const name = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username;
  const title = `${name} — ${monthName} ${year}`;

  try {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Salary Report');
    buildSheet(sheet, entries || [], user, title);
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
