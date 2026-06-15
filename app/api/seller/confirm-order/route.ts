import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/seller/confirm-order
 * Seller confirms they've seen and accepted their part of an order.
 * Auth: Bearer token (seller's own session)
 * Body: { orderId: string }
 *
 * Updates orders.seller_confirmations JSONB:
 *   { "seller-uuid": { "confirmed_at": "2026-06-15T..." } }
 *
 * If ALL sellers in the order have confirmed, auto-transitions status to "processing".
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

  // Find seller record for this user
  const { data: seller } = await supabase
    .from("sellers").select("id").eq("user_id", user.id).single();
  if (!seller) return NextResponse.json({ error: "Not a seller" }, { status: 403 });

  const { orderId } = (await req.json().catch(() => ({}))) as { orderId?: string };
  if (!orderId) return NextResponse.json({ error: "Missing orderId" }, { status: 400 });

  // Fetch order
  const { data: order } = await supabase
    .from("orders")
    .select("id, status, seller_ids, seller_confirmations")
    .eq("id", orderId)
    .single();
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  // Verify this seller is part of the order
  const sellerIds = order.seller_ids ?? [];
  // Also check items for seller_id (fallback if seller_ids is null)
  const isInOrder = sellerIds.includes(seller.id);
  if (!isInOrder) {
    // Check items
    const { data: fullOrder } = await supabase
      .from("orders").select("items").eq("id", orderId).single();
    const items = (fullOrder?.items ?? []) as Array<{ seller_id?: string; sellerId?: string }>;
    const itemSellerId = items.some(it => (it.seller_id ?? it.sellerId) === seller.id);
    if (!itemSellerId) {
      return NextResponse.json({ error: "Not your order" }, { status: 403 });
    }
  }

  // Update seller_confirmations JSONB
  const confirmations = (order.seller_confirmations as Record<string, unknown>) ?? {};
  confirmations[seller.id] = {
    confirmed_at: new Date().toISOString(),
  };

  const updates: Record<string, unknown> = {
    seller_confirmations: confirmations,
  };

  // Check if ALL sellers have confirmed → auto-transition to "processing"
  const allSellerIds = new Set(sellerIds);
  // Also gather from items if seller_ids is empty
  if (allSellerIds.size === 0) {
    const { data: fullOrder } = await supabase
      .from("orders").select("items").eq("id", orderId).single();
    const items = (fullOrder?.items ?? []) as Array<{ seller_id?: string; sellerId?: string }>;
    for (const it of items) {
      const sid = it.seller_id ?? it.sellerId;
      if (sid) allSellerIds.add(sid);
    }
  }

  const allConfirmed = [...allSellerIds].every(sid => confirmations[sid as string]);
  if (allConfirmed && order.status === "paid") {
    updates.status = "processing";
  }

  await supabase.from("orders").update(updates).eq("id", orderId);

  return NextResponse.json({
    ok: true,
    confirmed: true,
    allConfirmed,
    newStatus: allConfirmed && order.status === "paid" ? "processing" : order.status,
  });
}
