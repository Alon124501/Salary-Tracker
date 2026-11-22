const webPush = require('web-push');
const supabase = require('../supabase');

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webPush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// Broadcasts to every stored subscription, mirroring the notifications table's
// broadcast-to-all model (see routes/notifications.js). Fire-and-forget: a push
// failure should never block the notification's own create/activate response.
async function sendPushToAll({ title, body }) {
  return sendPush({ title, body });
}

// Same as sendPushToAll, limited to the given profile ids (e.g. ADMIN_PROFILE_ID for admin alerts).
async function sendPushToUsers(userIds, { title, body }) {
  if (!userIds?.length) return;
  return sendPush({ title, body }, userIds);
}

async function sendPush({ title, body }, userIds) {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;

  let query = supabase.from('push_subscriptions').select('*');
  if (userIds) query = query.in('user_id', userIds);
  const { data: subs, error } = await query;
  if (error || !subs?.length) return;

  const payload = JSON.stringify({ title, body });

  await Promise.allSettled(subs.map(async sub => {
    const subscription = {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh, auth: sub.auth_key },
    };
    try {
      await webPush.sendNotification(subscription, payload);
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id);
      } else {
        console.error('push send failed for', sub.endpoint, err.message);
      }
    }
  }));
}

module.exports = { sendPushToAll, sendPushToUsers };
