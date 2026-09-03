import { NextResponse } from "next/server";
import { assertUser } from "@/lib/user-auth";

/**
 * POST /api/account/delete
 * Self-service: permanently deletes the logged-in user's own account —
 * their seller profile + listings (if any), their profile row, and the
 * underlying Supabase Auth account itself.
 *
 * Order history (`orders`) is intentionally NOT deleted — it's keyed by
 * buyer_email / snapshot fields rather than user_id, and invoices already
 * issued must be preserved for legal/accounting reasons (see
 * lib/legal/self-billing.ts). Only the account and seller listing data are
 * removed.
 *
 * Auth: Authorization: Bearer <user token> — always acts on the caller's
 * OWN account, never on an arbitrary user.
 */
export async function POST(req: Request) {
  const ctx = await assertUser(req);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const { supabase, user } = ctx;

  // Remove seller profile + listings, if any.
  const { data: seller } = await supabase
    .from("sellers")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (seller) {
    await supabase.from("listings").delete().eq("seller_id", seller.id);
    await supabase.from("sellers").delete().eq("id", seller.id);
  }

  // Remove the profile row.
  await supabase.from("profiles").delete().eq("id", user.id);

  // Remove the auth account itself — must be last, since it invalidates
  // the caller's own token.
  const { error } = await supabase.auth.admin.deleteUser(user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
