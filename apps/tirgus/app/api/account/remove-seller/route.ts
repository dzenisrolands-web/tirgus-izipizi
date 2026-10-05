import { NextResponse } from "next/server";
import { assertUser } from "@/lib/user-auth";

/**
 * POST /api/account/remove-seller
 * Self-service: the logged-in user stops being a seller — deletes their own
 * `sellers` row and listings, but keeps their buyer account intact. This is
 * the "undo" counterpart to /dashboard/onboarding and the admin
 * "Padarīt par ražotāju" action.
 *
 * Auth: Authorization: Bearer <user token> — always acts on the caller's
 * OWN seller record, never on an arbitrary user.
 */
export async function POST(req: Request) {
  const ctx = await assertUser(req);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const { supabase, user } = ctx;

  const { data: seller } = await supabase
    .from("sellers")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!seller) {
    return NextResponse.json({ ok: true, hadSeller: false });
  }

  const { error: listingsErr } = await supabase
    .from("listings")
    .delete()
    .eq("seller_id", seller.id);
  if (listingsErr) {
    return NextResponse.json({ error: `Failed to delete listings: ${listingsErr.message}` }, { status: 500 });
  }

  const { error: sellerErr } = await supabase
    .from("sellers")
    .delete()
    .eq("id", seller.id);
  if (sellerErr) {
    return NextResponse.json({ error: `Failed to delete seller: ${sellerErr.message}` }, { status: 500 });
  }

  await supabase.from("profiles").update({ role: "buyer" }).eq("id", user.id);

  return NextResponse.json({ ok: true, hadSeller: true });
}
