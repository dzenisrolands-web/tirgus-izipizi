import { NextResponse } from "next/server";
import { assertSuperAdmin } from "@/lib/admin-auth";

/**
 * POST /api/admin/make-seller
 * Admin-only: grants seller access to an existing (buyer) account by
 * creating a minimal draft `sellers` row for that user_id.
 *
 * This does NOT create a new auth account — buyer and seller share one
 * identity, gated purely by the presence of a `sellers` row (see
 * docs/role-separation/BRIEF.md). The user then logs in as usual, sees the
 * "Pārdodu" switcher on /profils, and completes their profile via
 * /dashboard/onboarding or /dashboard/profils.
 *
 * Body: { userId: string, email: string, name?: string }
 */
export async function POST(req: Request) {
  const ctx = await assertSuperAdmin(req);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const { supabase } = ctx;

  const { userId, email, name } = (await req.json().catch(() => ({}))) as {
    userId?: string;
    email?: string;
    name?: string;
  };
  if (!userId || !email) {
    return NextResponse.json({ error: "Missing userId or email" }, { status: 400 });
  }

  // Don't create a duplicate — if a sellers row already exists for this user, no-op.
  const { data: existing } = await supabase
    .from("sellers")
    .select("id, status")
    .eq("user_id", userId)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ ok: true, alreadyExists: true, sellerId: existing.id, status: existing.status });
  }

  const fallbackName = name?.trim() || email.split("@")[0];

  const { data: created, error } = await supabase
    .from("sellers")
    .insert({
      user_id: userId,
      email,
      name: fallbackName,
      status: "draft",
    })
    .select("id, status")
    .single();

  if (error || !created) {
    return NextResponse.json({ error: error?.message ?? "Insert failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, alreadyExists: false, sellerId: created.id, status: created.status });
}
