import webpush from 'web-push';

export type PushPayload = {
  title: string;
  body: string;
  url: string;
};

export type PushSub = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

let vapidConfigured = false;

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
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
      )
    )
  );
  const failed = results.filter((r) => r.status === 'rejected').length;
  return { sent: results.length - failed, failed };
}
