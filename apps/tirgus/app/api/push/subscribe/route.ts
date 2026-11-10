import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAllowedPushEndpoint } from '@/lib/push';
import { bearerToken } from '@/lib/security-api';

export async function POST(req: Request) {
  const token = bearerToken(req);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { endpoint, p256dh, auth } = (await req.json().catch(() => null)) ?? {};
  if (!isAllowedPushEndpoint(endpoint) || typeof p256dh !== 'string' || !/^[A-Za-z0-9_-]{87,88}={0,2}$/.test(p256dh) ||
      typeof auth !== 'string' || !/^[A-Za-z0-9_-]{22}={0,2}$/.test(auth)) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      { user_id: user.id, endpoint, p256dh, auth },
      { onConflict: 'user_id,endpoint' }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const token = bearerToken(req);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { endpoint } = (await req.json().catch(() => null)) ?? {};
  if (typeof endpoint !== 'string' || !endpoint) return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 });
  const { error } = await supabase.from('push_subscriptions').delete()
    .eq('user_id', user.id).eq('endpoint', endpoint);
  if (error) return NextResponse.json({ error: 'Subscription deletion failed' }, { status: 500 });

  return NextResponse.json({ ok: true });
}
