import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { notifyBuyerOrderStatus } from "@/lib/order-notifications";
import { bearerToken, isCronRequest, orderSellerIds } from "@/lib/security-api";

/**
 * Trigger a buyer push notification for an order status change.
 * Called by the seller dashboard after advancing order status.
 *
 * Auth: requires a Supabase session token of the seller (or admin).
 */
export async function POST(req: Request) {
  const token = bearerToken(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );
  const cron = isCronRequest(req);
  const { data: { user }, error: authErr } = cron
    ? { data: { user: null }, error: null }
    : await supabase.auth.getUser(token);
  if (!cron && (authErr || !user)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orderId, status } = (await req.json().catch(() => null)) ?? {};
  if (typeof orderId !== "string" || !["processing", "shipped", "delivered"].includes(status)) {
    return NextResponse.json({ error: "Invalid orderId or status" }, { status: 400 });
  }

  const { data: order, error } = await supabase.from("orders")
    .select("id, seller_ids, items, status, payment_status").eq("id", orderId).single();
  if (error) return NextResponse.json({ error: "Order query failed" }, { status: 500 });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!cron && user?.app_metadata?.is_super_admin !== true) {
    const { data: seller, error: sellerError } = await supabase.from("sellers")
      .select("id").eq("user_id", user!.id).single();
    if (sellerError || !seller || !orderSellerIds(order).includes(seller.id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (orderSellerIds(order).length !== 1) return NextResponse.json({ error: "Admin coordination required" }, { status: 409 });
  }
  if (order.payment_status !== "paid" || order.status !== status) {
    return NextResponse.json({ error: "Status does not match persisted paid order" }, { status: 409 });
  }

  try {
    const result = await notifyBuyerOrderStatus(orderId, order.status);
    return NextResponse.json({ ok: true, ...result });
  } catch {
    return NextResponse.json({ error: "Notification could not be sent" }, { status: 500 });
  }
}
