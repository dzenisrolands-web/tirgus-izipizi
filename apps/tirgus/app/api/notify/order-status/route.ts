import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { notifyBuyerOrderStatus } from "@/lib/order-notifications";

/**
 * Trigger a buyer push notification for an order status change.
 * Called by the seller dashboard after advancing order status.
 *
 * Auth: requires a Supabase session token of the seller (or admin).
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

  const { orderId, status } = await req.json().catch(() => ({}));
  if (!orderId || !status) return NextResponse.json({ error: "Missing orderId or status" }, { status: 400 });

  const { data: order } = await supabase.from("orders")
    .select("status, payment_status, seller_ids").eq("id", orderId).single();
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (user.app_metadata?.is_super_admin !== true) {
    const { data: seller } = await supabase.from("sellers").select("id").eq("user_id", user.id).single();
    if (!seller || !order.seller_ids?.includes(seller.id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }
  // A caller cannot invent a status or send PINs for an unpaid/unshipped order.
  if (order.payment_status !== "paid" || status !== order.status ||
      !["processing", "shipped", "delivered"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 409 });
  }

  const result = await notifyBuyerOrderStatus(orderId, status);
  return NextResponse.json({ ok: true, ...result });
}
