import { NextResponse } from 'next/server';
import { createClient, type User } from '@supabase/supabase-js';
import { sendPushToSubscriptions } from '@/lib/push';
import { lockers } from '@/lib/mock-data';
import { bearerToken, isCronRequest } from '@/lib/security-api';

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
  const token = bearerToken(req);
  const isCron = isCronRequest(req);
  let caller: User | null = null;
  if (!isCron) {
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    caller = user;
  }

  const body = (await req.json().catch(() => null)) ?? {};
  const dropId = body.dropId;
  if (typeof dropId !== 'string' || !dropId) return NextResponse.json({ error: 'Missing dropId' }, { status: 400 });

  const { data: drop, error: dropError } = await supabase
    .from('hot_drops')
    .select('id, title, seller_id, pickup_locker_id')
    .eq('id', dropId)
    .single();
  if (dropError) return NextResponse.json({ error: 'Drop query failed' }, { status: 500 });
  if (!drop) return NextResponse.json({ error: 'Drop not found' }, { status: 404 });

  const { data: seller, error: sellerError } = await supabase
    .from('sellers')
    .select('name, farm_name, user_id')
    .eq('id', drop.seller_id)
    .single();
  if (sellerError || !seller) return NextResponse.json({ error: 'Seller query failed' }, { status: 500 });
  if (!isCron && caller?.app_metadata?.is_super_admin !== true && seller.user_id !== caller?.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const sellerName = seller?.farm_name ?? seller?.name ?? 'Ražotājs';
  const lockerName = lockers.find((l) => l.id === drop.pickup_locker_id)?.name ?? '';

  // Find audience: seller followers + locker subscribers, deduped
  const [followersRes, subsRes] = await Promise.all([
    supabase.from('seller_followers').select('user_id').eq('seller_id', drop.seller_id),
    supabase.from('locker_subscriptions').select('user_id').eq('locker_id', drop.pickup_locker_id).eq('push_enabled', true),
  ]);

  if (followersRes.error || subsRes.error) return NextResponse.json({ error: 'Audience query failed' }, { status: 500 });
  const userIds = [
    ...new Set([
      ...(followersRes.data ?? []).map((f: { user_id: string }) => f.user_id),
      ...(subsRes.data ?? []).map((s: { user_id: string }) => s.user_id),
    ]),
  ];

  if (userIds.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, reason: 'no audience' });
  }

  const { data: pushSubs, error: pushError } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .in('user_id', userIds);

  if (pushError) return NextResponse.json({ error: 'Subscription query failed' }, { status: 500 });
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
