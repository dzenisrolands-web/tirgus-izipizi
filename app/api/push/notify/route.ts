import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendPushToSubscriptions } from '@/lib/push';
import { lockers } from '@/lib/mock-data';

/**
 * Called server-side when a new drop (Sludinājumu dēlis post) is created.
 *
 * Notifies BOTH:
 *   - Seller followers (who follow this farmer)
 *   - Locker subscribers (subscribed to the locker the drop is going to)
 *
 * Body: { dropId } — server loads the rest from DB.
 * Backwards compat: still accepts { sellerId, dropId } from older callers.
 */
export async function POST(req: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );

  // Accept either CRON_SECRET or a valid user session token
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.replace('Bearer ', '');
  const cronSecret = process.env.CRON_SECRET;
  const isCron = cronSecret && token === cronSecret;
  if (!isCron) {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const dropId = body.dropId;
  if (!dropId) return NextResponse.json({ error: 'Missing dropId' }, { status: 400 });

  const { data: drop } = await supabase
    .from('hot_drops')
    .select('id, title, seller_id, pickup_locker_id')
    .eq('id', dropId)
    .single();
  if (!drop) return NextResponse.json({ error: 'Drop not found' }, { status: 404 });

  const { data: seller } = await supabase
    .from('sellers')
    .select('name, farm_name')
    .eq('id', drop.seller_id)
    .single();
  const sellerName = seller?.farm_name ?? seller?.name ?? 'Ražotājs';
  const lockerName = lockers.find((l) => l.id === drop.pickup_locker_id)?.name ?? '';

  // Find audience: seller followers + locker subscribers, deduped
  const [followersRes, subsRes] = await Promise.all([
    supabase.from('seller_followers').select('user_id').eq('seller_id', drop.seller_id),
    supabase.from('locker_subscriptions').select('user_id').eq('locker_id', drop.pickup_locker_id).eq('push_enabled', true),
  ]);

  const userIds = [
    ...new Set([
      ...(followersRes.data ?? []).map((f: { user_id: string }) => f.user_id),
      ...(subsRes.data ?? []).map((s: { user_id: string }) => s.user_id),
    ]),
  ];

  if (userIds.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, reason: 'no audience' });
  }

  const { data: pushSubs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .in('user_id', userIds);

  if (!pushSubs || pushSubs.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, reason: 'no subscriptions' });
  }

  const result = await sendPushToSubscriptions(pushSubs, {
    title: '🌾 Jauns sludinājums!',
    body: lockerName
      ? `${sellerName}: ${drop.title} — ${lockerName}`
      : `${sellerName}: ${drop.title}`,
    url: `/keriens/${drop.id}`,
  });

  return NextResponse.json({
    ok: true,
    ...result,
    audience: {
      followers: followersRes.data?.length ?? 0,
      lockerSubs: subsRes.data?.length ?? 0,
      deduped: userIds.length,
    },
  });
}
