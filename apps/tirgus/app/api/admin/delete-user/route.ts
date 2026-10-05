import { NextResponse } from "next/server";
import { assertSuperAdmin } from "@/lib/admin-auth";

/**
 * POST /api/admin/delete-user
 * Admin-only: permanently deletes a user's account — their seller profile +
 * listings (if any), their profile row, and the underlying Supabase Auth
 * account itself.
 *
 * Order history is intentionally left untouched (see /api/account/delete
 * for the same rationale — orders and invoices are snapshot-based).
 *
 * Auth: Authorization: Bearer <admin user token>
 * Body: { userId: string }
 */
export async function POST(req: Request) {
  const ctx = await assertSuperAdmin(req);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const { supabase } = ctx;

  const { userId } = (await req.json().catch(() => ({}))) as { userId?: string };
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  const { data: seller } = await supabase
    .from("sellers")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (seller) {
    await supabase.from("listings").delete().eq("seller_id", seller.id);
    await supabase.from("sellers").delete().eq("id", seller.id);
  }

  await supabase.from("profiles").delete().eq("id", userId);

  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
