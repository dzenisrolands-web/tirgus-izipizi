import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const PAID_FLOW_STATUSES = new Set(["paid", "processing", "shipped", "delivered"]);

/**
 * Admin-only: update order status + sync payment_status/paid_at.
 * Uses service_role key to bypass RLS.
 */
export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify the caller is authenticated
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // TODO: optionally verify user is super_admin via profiles table

  const { orderId, status } = await req.json().catch(() => ({}));
  if (!orderId || !status) {
    return NextResponse.json({ error: "Missing orderId or status" }, { status: 400 });
  }

  // Fetch current order
  const { data: order } = await supabase
    .from("orders")
    .select("id, paid_at")
    .eq("id", orderId)
    .single();

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const now = new Date().toISOString();
  const updates: Record<string, unknown> = { status };

  if (status === "pending") {
    updates.payment_status = "awaiting";
    updates.paid_at = null;
  } else if (status === "cancelled") {
    updates.payment_status = "cancelled";
  } else if (PAID_FLOW_STATUSES.has(status)) {
    updates.payment_status = "paid";
    updates.paid_at = order.paid_at ?? now;
  }

  const { error: updateErr } = await supabase
    .from("orders")
    .update(updates)
    .eq("id", orderId);

  if (updateErr) {
    console.error("[admin/update-order-status] update failed:", updateErr);
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, updates });
}
