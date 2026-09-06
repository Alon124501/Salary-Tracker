const express = require('express');
const multer  = require('multer');
const auth      = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const supabase  = require('../supabase');
const { computeNextOccurrence } = require('../utils/scheduling');
const { sendPushToAll } = require('../lib/webPush');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// GET /api/notifications — active notifications for the current tester
// Returns only notifications the user still needs to see:
//   - requires_approval=false (always visible while active)
//   - requires_approval=true AND not yet approved by this user
// Also lazily activates any scheduled notifications whose time has passed,
// so notifications fire the moment a tester opens the app (no cron dependency).
router.get('/', auth, async (req, res) => {
  try {
    // Lazy activation: find and activate any due scheduled notifications
    const now = new Date().toISOString();
    const { data: due } = await supabase
      .from('notifications')
      .select('*')
      .eq('is_active', false)
      .not('scheduled_for', 'is', null)
      .lte('scheduled_for', now);

    if (due?.length) {
      const dueIds = due.map(n => n.id);
      // eq('is_active', false) makes this idempotent against concurrent activations
      await supabase.from('notifications').update({ is_active: true }).in('id', dueIds).eq('is_active', false);

      for (const n of due) {
        sendPushToAll({ title: n.title, body: n.content?.slice(0, 120) });
        if (!n.recurrence_days?.length || !n.recurrence_time) continue;
        // Use both contains + containedBy to get exact array equality (not a superset check)
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
          title: n.title, content: n.content, type: n.type,
          requires_approval: n.requires_approval, created_by: n.created_by,
          is_active: false, scheduled_for: nextTime,
          recurrence_days: n.recurrence_days, recurrence_time: n.recurrence_time,
          document_storage_path: n.document_storage_path || null,
          document_external_url: n.document_external_url || null,
          document_file_name:    n.document_file_name    || null,
          force_view_document:   n.force_view_document   || false,
        });
      }
    }

    // Fetch active notifications and filter by user approval status
    const { data: notifs, error: nErr } = await supabase
      .from('notifications')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    if (nErr) return res.status(500).json({ error: nErr.message });
    if (!notifs?.length) return res.json([]);

    const notifIds = notifs.map(n => n.id);
    const { data: reads } = await supabase
      .from('notification_reads')
      .select('notification_id, approved_at, document_opened_at, dismissed_at')
      .eq('user_id', req.userId)
      .in('notification_id', notifIds);

    const readMap = Object.fromEntries(
      (reads || []).map(r => [r.notification_id, { approved_at: r.approved_at, document_opened_at: r.document_opened_at, dismissed_at: r.dismissed_at }])
    );

    const visible = notifs
      .filter(n => !readMap[n.id]?.dismissed_at && (!n.requires_approval || !readMap[n.id]?.approved_at))
      .map(n => ({
        ...n,
        approved_at: readMap[n.id]?.approved_at || null,
        document_opened_at: readMap[n.id]?.document_opened_at || null,
        document_url: null,
      }));

    // Generate signed URLs for uploaded documents (parallel)
    await Promise.all(visible.map(async notif => {
      if (notif.document_storage_path) {
        const { data: urlData } = await supabase.storage
          .from('notification-documents')
          .createSignedUrl(notif.document_storage_path, 3600);
        notif.document_url = urlData?.signedUrl || null;
      } else if (notif.document_external_url) {
        notif.document_url = notif.document_external_url;
      }
    }));

    res.json(visible);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notifications — create a notification (admin only)
// Accepts multipart/form-data so a document file can be attached alongside text fields.
router.post('/', auth, adminAuth, upload.single('document'), async (req, res) => {
  try {
    const title             = req.body.title;
    const content           = req.body.content;
    const type              = req.body.type || 'manual';
    const requires_approval = req.body.requires_approval === 'true';
    const force_view_document = req.body.force_view_document === 'true';
    const scheduled_for     = req.body.scheduled_for;
    const document_external_url = req.body.document_external_url?.trim() || null;

    // recurrence_days may arrive as a JSON string from FormData
    let recurrence_days = req.body.recurrence_days;
    if (typeof recurrence_days === 'string') {
      try { recurrence_days = JSON.parse(recurrence_days); } catch { recurrence_days = []; }
    }
    const recurrence_time = req.body.recurrence_time || null;

    if (!title?.trim() || !content?.trim()) {
      return res.status(400).json({ error: 'יש למלא כותרת ותוכן' });
    }
    if (!['manual', 'recurring'].includes(type)) {
      return res.status(400).json({ error: 'הסוג חייב להיות חד-פעמי או חוזר' });
    }
    if (force_view_document && !req.file && !document_external_url) {
      return res.status(400).json({ error: 'נדרש קובץ מסמך או קישור כאשר נדרשת פתיחת מסמך' });
    }

    let isActive     = true;
    let scheduledFor = null;

    if (type === 'recurring') {
      if (!recurrence_days?.length || !recurrence_time) {
        return res.status(400).json({ error: 'נדרשים ימי חזרה ושעה עבור התראה חוזרת' });
      }
      scheduledFor = computeNextOccurrence(recurrence_days, recurrence_time);
      if (!scheduledFor) return res.status(400).json({ error: 'לא ניתן היה לחשב את המועד הבא' });
      isActive = false;
    } else if (scheduled_for) {
      const d = new Date(scheduled_for);
      if (isNaN(d.getTime())) return res.status(400).json({ error: 'תאריך התזמון אינו תקין' });
      scheduledFor = d.toISOString();
      isActive = false;
    }

    const { data, error } = await supabase
      .from('notifications')
      .insert({
        title: title.trim(),
        content: content.trim(),
        type,
        requires_approval,
        force_view_document,
        created_by: req.userId,
        is_active: isActive,
        scheduled_for: scheduledFor,
        recurrence_days: recurrence_days || null,
        recurrence_time: recurrence_time || null,
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    if (isActive) {
      sendPushToAll({ title: data.title, body: data.content?.slice(0, 120) });
    }

    // Upload document file if provided, then patch the row with the storage path.
    // On upload failure we delete the just-created row to avoid a notification
    // with force_view_document=true but no reachable document.
    if (req.file) {
      const ext      = req.file.originalname.split('.').pop();
      const filePath = `${data.id}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('notification-documents')
        .upload(filePath, req.file.buffer, { contentType: req.file.mimetype });

      if (uploadErr) {
        await supabase.from('notifications').delete().eq('id', data.id);
        return res.status(500).json({ error: 'העלאת המסמך נכשלה; ההתראה לא נוצרה.' });
      }

      await supabase
        .from('notifications')
        .update({ document_storage_path: filePath, document_file_name: req.file.originalname })
        .eq('id', data.id);
      data.document_storage_path = filePath;
      data.document_file_name    = req.file.originalname;
    } else if (document_external_url) {
      let displayName = document_external_url;
      try { displayName = new URL(document_external_url).hostname; } catch { /* keep full URL */ }
      await supabase
        .from('notifications')
        .update({ document_external_url, document_file_name: displayName })
        .eq('id', data.id);
      data.document_external_url = document_external_url;
      data.document_file_name    = displayName;
    }

    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/notifications/:id — soft-deactivate (admin only)
router.delete('/:id', auth, adminAuth, async (req, res) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_active: false })
      .eq('id', req.params.id);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notifications/:id/approve — tester marks notification as approved
router.post('/:id/approve', auth, async (req, res) => {
  try {
    // Explicitly set approved_at so the upsert works correctly even when a
    // notification_reads row already exists (inserted by the open-document endpoint).
    const { error } = await supabase
      .from('notification_reads')
      .upsert(
        { notification_id: req.params.id, user_id: req.userId, approved_at: new Date().toISOString() },
        { onConflict: 'notification_id,user_id' }
      );

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notifications/:id/dismiss — tester hides a non-approval notification
// from their own feed only; other users and the notification itself are untouched.
router.post('/:id/dismiss', auth, async (req, res) => {
  try {
    const { data: notif, error: fetchErr } = await supabase
      .from('notifications').select('requires_approval').eq('id', req.params.id).single();
    if (fetchErr || !notif) return res.status(404).json({ error: 'ההתראה לא נמצאה' });
    if (notif.requires_approval) {
      return res.status(400).json({ error: 'לא ניתן להסתיר התראה הדורשת אישור' });
    }

    const { error } = await supabase
      .from('notification_reads')
      .upsert(
        { notification_id: req.params.id, user_id: req.userId, dismissed_at: new Date().toISOString() },
        { onConflict: 'notification_id,user_id' }
      );

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notifications/:id/open-document — tester opened the attached document
// Records the first-open timestamp; subsequent calls preserve the original time.
router.post('/:id/open-document', auth, async (req, res) => {
  try {
    const { data: existing } = await supabase
      .from('notification_reads')
      .select('document_opened_at')
      .eq('notification_id', req.params.id)
      .eq('user_id', req.userId)
      .maybeSingle();

    const openedAt = existing?.document_opened_at || new Date().toISOString();

    const { error } = await supabase
      .from('notification_reads')
      .upsert(
        { notification_id: req.params.id, user_id: req.userId, document_opened_at: openedAt },
        { onConflict: 'notification_id,user_id' }
      );

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, document_opened_at: openedAt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/notifications/admin/all — all notifications for admin list view
router.get('/admin/all', auth, adminAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/notifications/admin/:id/compliance — per-tester approval + document-open status
router.get('/admin/:id/compliance', auth, adminAuth, async (req, res) => {
  try {
    const notifId = req.params.id;

    const [notifRes, testersRes, readsRes] = await Promise.all([
      supabase.from('notifications').select('*').eq('id', notifId).single(),
      supabase.from('profiles').select('id, username, first_name, last_name').eq('is_admin', false),
      supabase.from('notification_reads').select('user_id, approved_at, document_opened_at').eq('notification_id', notifId),
    ]);

    if (notifRes.error) return res.status(404).json({ error: 'ההתראה לא נמצאה' });
    if (testersRes.error) return res.status(500).json({ error: testersRes.error.message });

    const readMap = Object.fromEntries(
      (readsRes.data || []).map(r => [r.user_id, { approved_at: r.approved_at, document_opened_at: r.document_opened_at }])
    );

    const compliance = (testersRes.data || []).map(u => ({
      user_id: u.id,
      username: u.username,
      first_name: u.first_name,
      last_name: u.last_name,
      approved_at: readMap[u.id]?.approved_at || null,
      document_opened_at: readMap[u.id]?.document_opened_at || null,
    }));

    res.json({ notification: notifRes.data, compliance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
