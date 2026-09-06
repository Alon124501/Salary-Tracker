const express = require('express');
const supabase = require('../supabase');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();
router.use(auth);

// GET /api/push/vapid-public-key
router.get('/vapid-public-key', asyncHandler(async (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || null });
}));

// POST /api/push/subscribe — upsert by endpoint (last login on a device owns it)
router.post('/subscribe', asyncHandler(async (req, res) => {
  const { endpoint, keys } = req.body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ error: 'מנוי דחיפה לא תקין' });
  }

  const { error } = await supabase.from('push_subscriptions').upsert({
    user_id: req.userId,
    endpoint,
    p256dh: keys.p256dh,
    auth_key: keys.auth,
  }, { onConflict: 'endpoint' });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
}));

// DELETE /api/push/subscribe
router.delete('/subscribe', asyncHandler(async (req, res) => {
  const endpoint = req.query.endpoint || req.body?.endpoint;
  if (!endpoint) return res.status(400).json({ error: 'נדרש endpoint' });

  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
}));

module.exports = router;
