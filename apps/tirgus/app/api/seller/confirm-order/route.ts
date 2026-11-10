import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { bearerToken, orderSellerIds } from "@/lib/security-api";

/**
 * Seller accepts their part of a paid order. Existing JSONB is updated using
 * compare-and-swap so simultaneous confirmations cannot overwrite each other.
 * Processing begins only after all sellers accept. Shipment fulfillment
 * remains admin-coordinated for multi-seller orders.
 */
export async function POST(req: Request) {
  const token = bearerToken(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { orderId } = (await req.json().catch(() => null)) ?? {};
  if (typeof orderId !== "string" || !orderId.trim()) {
    return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
  }
  const { data: seller, error: sellerError } = await supabase.from("sellers")
    .select("id").eq("user_id", user.id).single();
  if (sellerError) return NextResponse.json({ error: "Seller query failed" }, { status: 500 });
  if (!seller) return NextResponse.json({ error: "Not a seller" }, { status: 403 });

  const { data: order, error: orderError } = await supabase.from("orders")
    .select("id, status, payment_status, seller_ids, items, seller_confirmations")
    .eq("id", orderId).single();
  if (orderError) return NextResponse.json({ error: "Order query failed" }, { status: 500 });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  const sellerIds = orderSellerIds(order);
  if (!sellerIds.includes(seller.id)) return NextResponse.json({ error: "Not your order" }, { status: 403 });
  if (order.payment_status !== "paid" || !["paid", "processing"].includes(order.status)) {
    return NextResponse.json({ error: "Order is not awaiting paid confirmation" }, { status: 409 });
  }

  const previous = order.seller_confirmations;
  if (previous != null && (typeof previous !== "object" || Array.isArray(previous))) {
    return NextResponse.json({ error: "Invalid existing confirmations" }, { status: 409 });
  }
  const confirmations: Record<string, unknown> = {
    ...(previous ?? {}),
    [seller.id]: previous?.[seller.id] ?? { confirmed_at: new Date().toISOString() },
  };
  const allConfirmed = sellerIds.every(id => !!confirmations[id]);
  const newStatus = allConfirmed ? "processing" : order.status;
  let update = supabase.from("orders")
    .update({ seller_confirmations: confirmations, status: newStatus })
    .eq("id", orderId).eq("status", order.status).eq("payment_status", "paid");
  update = previous == null
    ? update.is("seller_confirmations", null)
    : update.eq("seller_confirmations", JSON.stringify(previous));
  const { data: changed, error: updateError } = await update.select("id").maybeSingle();
  if (updateError) return NextResponse.json({ error: "Confirmation update failed" }, { status: 500 });
  if (!changed) return NextResponse.json({ error: "Order changed; reload and retry" }, { status: 409 });
  return NextResponse.json({
    ok: true, confirmed: true, allConfirmed, newStatus,
    adminCoordinationRequired: sellerIds.length > 1,
  });
}
