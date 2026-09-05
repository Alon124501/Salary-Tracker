const express = require('express');
const archiver = require('archiver');
const nodemailer = require('nodemailer');
const supabase = require('../supabase');
const { computeNextOccurrence } = require('../utils/scheduling');

const router = express.Router();

const ADMIN_EMAIL = 'davida@mpcheck.co.il';

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
    return res.json({ success: true, message: 'לא נמצאו קבלות, לא נשלח מייל.' });
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
    return res.status(500).json({ error: 'GMAIL_USER או GMAIL_APP_PASSWORD אינם מוגדרים' });
  }

  const monthName = new Date(year, month - 1, 1).toLocaleString('he-IL', { month: 'long' });
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: gmailUser, pass: gmailPass },
  });

  await transporter.sendMail({
    from: `Medical Pay <${gmailUser}>`,
    to: ADMIN_EMAIL,
    subject: `קבלות חודשיות — ${monthName} ${year}`,
    text: `כל קבלות האוכל עבור ${monthName} ${year} מצורפות כקובץ ZIP.\n\nסך הכל קבלות: ${entries.length}`,
    attachments: [{
      filename: `receipts-${monthStr}.zip`,
      content: zipBuffer,
      contentType: 'application/zip',
    }],
  });

  res.json({ success: true, receiptsCount: entries.length, month: monthStr });
});

// Runs every hour. Activates pending notifications whose scheduled_for has passed.
// For recurring ones, inserts the next occurrence after activation.
router.get('/process-notifications', async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const now = new Date().toISOString();

  const { data: due, error: dueErr } = await supabase
    .from('notifications')
    .select('*')
    .eq('is_active', false)
    .not('scheduled_for', 'is', null)
    .lte('scheduled_for', now);

  if (dueErr) return res.status(500).json({ error: dueErr.message });
  if (!due?.length) return res.json({ success: true, activated: 0 });

  const dueIds = due.map(n => n.id);
  // eq('is_active', false) makes this idempotent against concurrent cron/lazy-activation races
  await supabase.from('notifications').update({ is_active: true }).in('id', dueIds).eq('is_active', false);

  for (const n of due) {
    if (!n.recurrence_days?.length || !n.recurrence_time) continue;

    // Use both contains + containedBy for exact array equality (not a superset check)
    const { data: existing } = await supabase
      .from('notifications')
      .select('id')
      .eq('is_active', false)
      .eq('recurrence_time', n.recurrence_time)
      .contains('recurrence_days', n.recurrence_days)
      .containedBy('recurrence_days', n.recurrence_days)
      .limit(1);

    if (existing?.length) continue;

    const nextTime = computeNextOccurrence(n.recurrence_days, n.recurrence_time);
    if (!nextTime) continue;

    await supabase.from('notifications').insert({
      title:             n.title,
      content:           n.content,
      type:              n.type,
      requires_approval: n.requires_approval,
      created_by:        n.created_by,
      is_active:         false,
      scheduled_for:     nextTime,
      recurrence_days:   n.recurrence_days,
      recurrence_time:   n.recurrence_time,
    });
  }

  res.json({ success: true, activated: dueIds.length });
});

module.exports = router;
