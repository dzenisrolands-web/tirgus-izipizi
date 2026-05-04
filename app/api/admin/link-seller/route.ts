import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Admin-only: attach an email address to a seller row, then either link the
 * existing auth user (if there's already a Supabase Auth account with that
 * email) or send a magic-link invitation.
 *
 * Auth: Authorization: Bearer <admin user token>
 * Body: { sellerId: string, email: string }
 * Response:
 *   { ok: true, linked: true, mode: "existing-user" }   — already had an auth account
 *   { ok: true, linked: false, mode: "invited" }        — invite email sent
 *   { ok: true, linked: true, mode: "trigger-on-signup" } — no account yet, trigger will link
 */
export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { sellerId, email } = (await req.json().catch(() => ({}))) as { sellerId?: string; email?: string };
  if (!sellerId) return NextResponse.json({ error: "Missing sellerId" }, { status: 400 });
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const normalized = email.trim().toLowerCase();

  // 1. Update sellers.email
  const { error: updateErr } = await supabase
    .from("sellers")
    .update({ email: normalized, updated_at: new Date().toISOString() })
    .eq("id", sellerId);
  if (updateErr) {
    return NextResponse.json({ error: `Email update failed: ${updateErr.message}` }, { status: 500 });
  }

  // 2. Check if an auth user with that email already exists
  // Supabase admin API: list users and filter by email (no direct getByEmail).
  const { data: usersList, error: listErr } = await supabase.auth.admin.listUsers({
    page: 1, perPage: 200,
  });
  if (listErr) {
    return NextResponse.json({ error: `Auth lookup failed: ${listErr.message}` }, { status: 500 });
  }
  const existing = usersList?.users.find((u) => u.email?.toLowerCase() === normalized);

  if (existing) {
    // 3a. Link directly — auth user already exists
    const { error: linkErr } = await supabase
      .from("sellers")
      .update({ user_id: existing.id, updated_at: new Date().toISOString() })
      .eq("id", sellerId);
    if (linkErr) {
      return NextResponse.json({ error: `Link failed: ${linkErr.message}` }, { status: 500 });
    }
    return NextResponse.json({ ok: true, linked: true, mode: "existing-user" });
  }

  // 3b. No auth user yet → send invite. The trigger from migration 0022 will
  //     link the seller row automatically when they accept and the auth.users
  //     row is created.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tirgus.izipizi.lv";
  const { error: inviteErr } = await supabase.auth.admin.inviteUserByEmail(normalized, {
    redirectTo: `${siteUrl}/dashboard`,
  });
  if (inviteErr) {
    return NextResponse.json({ error: `Invite failed: ${inviteErr.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, linked: false, mode: "invited" });
}
