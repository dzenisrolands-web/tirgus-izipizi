import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Super-admin team management.
 *
 * - GET    → list all super_admin users (id, email, created_at)
 * - POST   → invite a new super admin by email; if auth user exists, just
 *            promote profile.role; otherwise send Supabase Auth invite + set
 *            role on first signup
 * - DELETE → demote a user (role: 'super_admin' → 'buyer'). Auth user is
 *            kept; we never destroy accounts here.
 *
 * All operations require the caller to already be a super_admin.
 */

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );
}

async function assertSuperAdmin(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace("Bearer ", "");
  if (!token) return { error: "Unauthorized", status: 401 as const };

  const supabase = adminClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return { error: "Unauthorized", status: 401 as const };

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "super_admin") {
    return { error: "Forbidden", status: 403 as const };
  }
  return { supabase, callerId: user.id };
}

export async function GET(req: Request) {
  const ctx = await assertSuperAdmin(req);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const { supabase } = ctx;

  // 1. Find profile rows with super_admin role
  const { data: profiles, error: profErr } = await supabase
    .from("profiles").select("id, role, created_at").eq("role", "super_admin");
  if (profErr) {
    return NextResponse.json({ error: `Profiles read failed: ${profErr.message}` }, { status: 500 });
  }

  // 2. Enrich with email from auth.users (admin API, paginated)
  const { data: usersList, error: listErr } = await supabase.auth.admin.listUsers({
    page: 1, perPage: 200,
  });
  if (listErr) {
    return NextResponse.json({ error: `Auth lookup failed: ${listErr.message}` }, { status: 500 });
  }
  const emailById = new Map(usersList.users.map((u) => [u.id, u.email ?? ""]));

  const team = (profiles ?? []).map((p) => ({
    id: p.id,
    email: emailById.get(p.id) ?? "(nezināms)",
    created_at: p.created_at,
    is_self: p.id === ctx.callerId,
  }));

  return NextResponse.json({ ok: true, team });
}

export async function POST(req: Request) {
  const ctx = await assertSuperAdmin(req);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const { supabase } = ctx;

  const { email } = (await req.json().catch(() => ({}))) as { email?: string };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }
  const normalized = email.trim().toLowerCase();

  // 1. Check if auth user already exists
  const { data: usersList, error: listErr } = await supabase.auth.admin.listUsers({
    page: 1, perPage: 200,
  });
  if (listErr) {
    return NextResponse.json({ error: `Auth lookup failed: ${listErr.message}` }, { status: 500 });
  }
  const existing = usersList.users.find((u) => u.email?.toLowerCase() === normalized);

  if (existing) {
    // 2a. Promote existing user
    const { error: upErr } = await supabase
      .from("profiles")
      .upsert({ id: existing.id, role: "super_admin" });
    if (upErr) {
      return NextResponse.json({ error: `Promote failed: ${upErr.message}` }, { status: 500 });
    }
    return NextResponse.json({ ok: true, mode: "promoted-existing", userId: existing.id, email: normalized });
  }

  // 2b. New user → send invite, then set role after they confirm
  // The Supabase Auth invite creates the auth.users row immediately, so we
  // can mark profile.role straight away. The first login fills in the rest.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tirgus.izipizi.lv";
  const { data: invited, error: inviteErr } = await supabase.auth.admin.inviteUserByEmail(normalized, {
    redirectTo: `${siteUrl}/admin`,
  });
  if (inviteErr || !invited?.user) {
    return NextResponse.json({ error: `Invite failed: ${inviteErr?.message ?? "no user returned"}` }, { status: 500 });
  }

  const { error: profErr } = await supabase
    .from("profiles")
    .upsert({ id: invited.user.id, role: "super_admin" });
  if (profErr) {
    return NextResponse.json({ error: `Profile set failed: ${profErr.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, mode: "invited", userId: invited.user.id, email: normalized });
}

export async function DELETE(req: Request) {
  const ctx = await assertSuperAdmin(req);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const { supabase, callerId } = ctx;

  const { userId } = (await req.json().catch(() => ({}))) as { userId?: string };
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  if (userId === callerId) {
    return NextResponse.json({ error: "Tu nevari noņemt savu pašu super_admin piekļuvi" }, { status: 400 });
  }

  const { error: demoteErr } = await supabase
    .from("profiles").update({ role: "buyer" }).eq("id", userId);
  if (demoteErr) {
    return NextResponse.json({ error: `Demote failed: ${demoteErr.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, demoted: userId });
}
