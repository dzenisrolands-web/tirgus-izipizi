import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Locker subscriptions API.
 *
 * GET    /api/locker-subscriptions          — list current user's subscriptions
 * POST   /api/locker-subscriptions          — { lockerId, pushEnabled?, smsEnabled?, phone? } upsert
 * DELETE /api/locker-subscriptions?lockerId=X — remove
 *
 * All endpoints require Authorization: Bearer <token>.
 */

async function getUser(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace("Bearer ", "");
  if (!token) return null;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );
  const { data: { user } } = await supabase.auth.getUser(token);
  return user;
}

export async function GET(req: Request) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );
  const { data, error } = await supabase
    .from("locker_subscriptions")
    .select("locker_id, push_enabled, sms_enabled, phone, created_at")
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ subscriptions: data ?? [] });
}

export async function POST(req: Request) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { lockerId, pushEnabled, smsEnabled, phone } = body;
  if (!lockerId) return NextResponse.json({ error: "Missing lockerId" }, { status: 400 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );

  const { error } = await supabase.from("locker_subscriptions").upsert(
    {
      user_id: user.id,
      locker_id: lockerId,
      push_enabled: pushEnabled ?? true,
      sms_enabled: smsEnabled ?? false,
      phone: phone ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,locker_id" },
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const lockerId = new URL(req.url).searchParams.get("lockerId");
  if (!lockerId) return NextResponse.json({ error: "Missing lockerId" }, { status: 400 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );

  const { error } = await supabase
    .from("locker_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("locker_id", lockerId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
