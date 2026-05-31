const express = require('express');
const archiver = require('archiver');
const nodemailer = require('nodemailer');
const supabase = require('../supabase');

const router = express.Router();

const ADMIN_EMAIL = 'davida@mpcheck.co.il';
const MONTH_NAMES = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];

router.get('/monthly-receipts', async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Compute last month range
  const now = new Date();
  const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const month = now.getMonth() === 0 ? 12 : now.getMonth(); // 1-based
  const monthStr = `${year}-${String(month).padStart(2, '0')}`;
  const start = `${monthStr}-01`;
  const end = new Date(year, month, 0).toISOString().slice(0, 10);

  // Query entries with receipts for last month (all users)
  const { data: entries, error: entriesErr } = await supabase
    .from('entries')
    .select('id, date, receipt_url, user_id')
    .not('receipt_url', 'is', null)
    .gte('date', start)
    .lte('date', end);

  if (entriesErr) return res.status(500).json({ error: entriesErr.message });
  if (!entries || entries.length === 0) {
    return res.json({ success: true, message: 'No receipts found, no email sent.' });
  }

  // Fetch usernames for each unique user_id
  const userIds = [...new Set(entries.map(e => e.user_id))];
  const { data: profiles, error: profilesErr } = await supabase
    .from('profiles')
    .select('id, username')
    .in('id', userIds);
  if (profilesErr) return res.status(500).json({ error: profilesErr.message });

  const usernameMap = Object.fromEntries(profiles.map(p => [p.id, p.username]));

  // Build ZIP: one subfolder per user, files named by date
  const zipBuffer = await new Promise((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 6 } });
    const chunks = [];
    archive.on('data', chunk => chunks.push(chunk));
    archive.on('end', () => resolve(Buffer.concat(chunks)));
    archive.on('error', reject);

    (async () => {
      for (const entry of entries) {
        const { data: fileData, error: dlErr } = await supabase.storage
          .from('receipts')
          .download(entry.receipt_url);
        if (dlErr || !fileData) continue;

        const buf = Buffer.from(await fileData.arrayBuffer());
        const ext = entry.receipt_url.split('.').pop();
        const username = usernameMap[entry.user_id] || entry.user_id;
        archive.append(buf, { name: `${username}/${entry.date}-receipt.${ext}` });
      }
      archive.finalize();
    })().catch(reject);
  });

  // Send email via global Gmail credentials
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;
  if (!gmailUser || !gmailPass) {
    return res.status(500).json({ error: 'GMAIL_USER or GMAIL_APP_PASSWORD not configured' });
  }

  const monthName = MONTH_NAMES[month - 1];
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: gmailUser, pass: gmailPass },
  });

  await transporter.sendMail({
    from: `Salary Tracker <${gmailUser}>`,
    to: ADMIN_EMAIL,
    subject: `Monthly Receipts — ${monthName} ${year}`,
    text: `All food receipts for ${monthName} ${year} are attached as a ZIP.\n\nTotal receipts: ${entries.length}`,
    attachments: [{
      filename: `receipts-${monthStr}.zip`,
      content: zipBuffer,
      contentType: 'application/zip',
    }],
  });

  res.json({ success: true, receiptsCount: entries.length, month: monthStr });
});

module.exports = router;
