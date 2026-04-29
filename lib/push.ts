import webpush from 'web-push';

webpush.setVapidDetails(
  'mailto:dzenis.rolands@gmail.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

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

export async function sendPushToSubscriptions(subs: PushSub[], payload: PushPayload) {
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
