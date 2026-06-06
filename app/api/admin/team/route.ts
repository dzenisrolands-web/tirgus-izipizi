import { NextResponse } from "next/server";
import { assertSuperAdmin } from "@/lib/admin-auth";

/**
 * Super-admin team management.
 *
 * Super admin status lives in `app_metadata.is_super_admin` (JWT claim),
 * NOT in `profiles.role`. This keeps admin privilege out of client-writable tables.
 *
 * - GET    → list all super_admin users (id, email, created_at)
 * - POST   → promote an existing user or invite a new one as super admin
 * - DELETE → demote a user (remove app_metadata flag). Auth user is kept.
 *
 * All operations require the caller to already be a super_admin.
 */

export async function GET(req: Request) {
  const ctx = await assertSuperAdmin(req);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const { supabase, user: caller } = ctx;

  // List all auth users and filter by app_metadata.is_super_admin
  const { data: usersList, error: listErr } = await supabase.auth.admin.listUsers({
    page: 1, perPage: 200,
  });
  if (listErr) {
    return NextResponse.json({ error: `Auth lookup failed: ${listErr.message}` }, { status: 500 });
  }

  const team = usersList.users
    .filter((u) => u.app_metadata?.is_super_admin === true)
    .map((u) => ({
      id: u.id,
      email: u.email ?? "(nezināms)",
      created_at: u.created_at,
      is_self: u.id === caller.id,
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
    // 2a. Promote existing user via app_metadata
    const { error: upErr } = await supabase.auth.admin.updateUserById(existing.id, {
      app_metadata: { is_super_admin: true },
    });
    if (upErr) {
      return NextResponse.json({ error: `Promote failed: ${upErr.message}` }, { status: 500 });
    }
    return NextResponse.json({ ok: true, mode: "promoted-existing", userId: existing.id, email: normalized });
  }

  // 2b. New user → send invite, then set app_metadata
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tirgus.izipizi.lv";
  const { data: invited, error: inviteErr } = await supabase.auth.admin.inviteUserByEmail(normalized, {
    redirectTo: `${siteUrl}/admin`,
  });
  if (inviteErr || !invited?.user) {
    return NextResponse.json({ error: `Invite failed: ${inviteErr?.message ?? "no user returned"}` }, { status: 500 });
  }

  // Set app_metadata on the newly created auth user
  await supabase.auth.admin.updateUserById(invited.user.id, {
    app_metadata: { is_super_admin: true },
  });

  // Ensure profile exists (as buyer — not super_admin)
  await supabase.from("profiles").upsert({ id: invited.user.id, role: "buyer" }, { onConflict: "id" });

  return NextResponse.json({ ok: true, mode: "invited", userId: invited.user.id, email: normalized });
}

export async function DELETE(req: Request) {
  const ctx = await assertSuperAdmin(req);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const { supabase, user: caller } = ctx;

  const { userId } = (await req.json().catch(() => ({}))) as { userId?: string };
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  if (userId === caller.id) {
    return NextResponse.json({ error: "Tu nevari noņemt savu pašu super_admin piekļuvi" }, { status: 400 });
  }

  // Remove admin flag from app_metadata
  const { error: demoteErr } = await supabase.auth.admin.updateUserById(userId, {
    app_metadata: { is_super_admin: false },
  });
  if (demoteErr) {
    return NextResponse.json({ error: `Demote failed: ${demoteErr.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, demoted: userId });
}
