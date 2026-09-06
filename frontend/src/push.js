import api from './api.js';

function isSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

async function subscribeAndSend(registration) {
  const { data } = await api.get('/push/vapid-public-key');
  if (!data.publicKey) return;

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(data.publicKey),
  });

  await api.post('/push/subscribe', subscription.toJSON());
}

// Silent restore: re-subscribe if permission is already granted but no active
// subscription exists (e.g. after clearing site data). Never prompts.
export async function registerAndSubscribe() {
  if (!isSupported()) return;
  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    if (Notification.permission !== 'granted') return;
    const existing = await registration.pushManager.getSubscription();
    if (existing) return;
    await subscribeAndSend(registration);
  } catch { /* silent — push is a nice-to-have, never block the app */ }
}

// Explicit opt-in: called from a user gesture (banner button).
export async function requestPermissionAndSubscribe() {
  if (!isSupported()) return false;
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;
    const registration = await navigator.serviceWorker.ready;
    await subscribeAndSend(registration);
    return true;
  } catch {
    return false;
  }
}

export async function unsubscribePush() {
  if (!isSupported()) return;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;
    await api.delete('/push/subscribe', { params: { endpoint: subscription.endpoint } });
    await subscription.unsubscribe();
  } catch { /* silent */ }
}

export function pushSupported() {
  return isSupported();
}
