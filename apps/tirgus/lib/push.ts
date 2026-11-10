import webpush from 'web-push';

export type PushPayload = {
  title: string;
  body: string;
  url: string;
  /** SW uses this to dedupe re-sent notifications (same tag replaces previous). */
  tag?: string;
  /** When true, notification stays on screen until the user clicks it. */
  requireInteraction?: boolean;
};

export type PushSub = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

let vapidConfigured = false;

/** Web Push providers only; never send to a client-selected arbitrary host. */
export function isAllowedPushEndpoint(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 4096) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash) return false;
    const host = url.hostname.toLowerCase();
    return host === 'fcm.googleapis.com' || host === 'updates.push.services.mozilla.com' ||
      host === 'push.services.mozilla.com' || host === 'web.push.apple.com' ||
      host === 'notify.windows.com' || host.endsWith('.notify.windows.com');
  } catch {
    return false;
  }
}

function ensureVapidConfigured(): boolean {
  if (vapidConfigured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? 'mailto:dzenis.rolands@gmail.com',
    pub,
    priv,
  );
  vapidConfigured = true;
  return true;
}

export async function sendPushToSubscriptions(subs: PushSub[], payload: PushPayload) {
  if (!ensureVapidConfigured()) {
    console.warn('[push] VAPID keys not configured — skipping send');
    return { sent: 0, failed: subs.length };
  }
  const results = await Promise.allSettled(
    subs.map((sub) =>
      !isAllowedPushEndpoint(sub.endpoint) ? Promise.reject(new Error('Untrusted push endpoint')) : webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
      )
    )
  );
  const failed = results.filter((r) => r.status === 'rejected').length;
  return { sent: results.length - failed, failed };
}
