import { NextResponse } from "next/server";
import { assertSuperAdmin } from "@/lib/admin-auth";

/**
 * Admin-only: permanently delete a seller profile and all their listings.
 *
 * Auth: Authorization: Bearer <admin user token>
 * Body: { sellerId: string }
 *
 * Steps:
 * 1. Delete all listings belonging to this seller
 * 2. Delete the seller row
 * 3. Reset the linked user profile role to "buyer" (if user_id exists)
 */
export async function POST(req: Request) {
  const ctx = await assertSuperAdmin(req);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const { supabase } = ctx;

  const { sellerId } = (await req.json().catch(() => ({}))) as { sellerId?: string };
  if (!sellerId) return NextResponse.json({ error: "Missing sellerId" }, { status: 400 });

  // Fetch seller to get user_id
  const { data: seller } = await supabase
    .from("sellers").select("id, user_id, name").eq("id", sellerId).single();
  if (!seller) return NextResponse.json({ error: "Seller not found" }, { status: 404 });

  // 1. Delete all listings for this seller
  const { error: listingsErr } = await supabase
    .from("listings")
    .delete()
    .eq("seller_id", sellerId);
  if (listingsErr) {
    return NextResponse.json(
      { error: `Failed to delete listings: ${listingsErr.message}` },
      { status: 500 },
    );
  }

  // 2. Delete the seller row
  const { error: sellerErr } = await supabase
    .from("sellers")
    .delete()
    .eq("id", sellerId);
  if (sellerErr) {
    return NextResponse.json(
      { error: `Failed to delete seller: ${sellerErr.message}` },
      { status: 500 },
    );
  }

  // 3. Reset linked user profile role to "buyer"
  if (seller.user_id) {
    await supabase
      .from("profiles")
      .update({ role: "buyer" })
      .eq("id", seller.user_id);
  }

  return NextResponse.json({ ok: true, name: seller.name });
}
