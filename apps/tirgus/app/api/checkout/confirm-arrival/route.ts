import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { notifySellersNewOrder } from "@/lib/order-notifications";
import { sendAllOrderEmails } from "@/lib/email";

/**
 * POST /api/checkout/confirm-arrival
 * Body: { orderNumber: string }
 *
 * Fallback for when Paysera webhook doesn't arrive but the user
 * landed on the success page (= Paysera confirmed payment and redirected).
 *
 * Safety: the order number is random (TRG-YYYYMMDD-XXXX) and only known
 * to the user who created the checkout + Paysera. The success page URL
 * is only given to users who completed payment.
 *
 * This endpoint is idempotent — calling it on an already-paid order is a no-op.
 */
export async function POST(req: Request) {
  let body: { orderNumber?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }

  const orderNumber = body.orderNumber;
  if (!orderNumber) {
    return NextResponse.json({ ok: false, error: "orderNumber required" }, { status: 400 });
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );

  const { data: order } = await sb
    .from("orders")
    .select("id, order_number, payment_status, status, created_at")
    .eq("order_number", orderNumber)
    .single();

  if (!order) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  // Already paid — idempotent
  if (order.payment_status === "paid") {
    return NextResponse.json({ ok: true, already: true });
  }

  // Only confirm if the order is in awaiting/pending state
  if (order.payment_status !== "awaiting" && order.status !== "pending") {
    return NextResponse.json({ ok: false, error: "unexpected_status" }, { status: 400 });
  }

  // Safety: don't confirm orders older than 1 hour (stale checkout attempts)
  const ageMs = Date.now() - new Date(order.created_at).getTime();
  if (ageMs > 60 * 60 * 1000) {
    return NextResponse.json({ ok: false, error: "order_too_old" }, { status: 400 });
  }

  console.log(`[confirm-arrival] Marking ${orderNumber} as paid (webhook fallback)`);

  // Mark as paid
  const { error: updateErr } = await sb
    .from("orders")
    .update({
      payment_status: "paid",
      status: "paid",
      paid_at: new Date().toISOString(),
    })
    .eq("id", order.id)
    .eq("payment_status", "awaiting"); // optimistic lock

  if (updateErr) {
    return NextResponse.json({ ok: false, error: updateErr.message }, { status: 500 });
  }

  // Trigger full paid flow (same as webhook): notifications + emails
  notifySellersNewOrder(order.id).catch((e) =>
    console.error("[confirm-arrival] push failed:", e)
  );
  sendAllOrderEmails(order.id).catch((e) =>
    console.error("[confirm-arrival] emails failed:", e)
  );

  return NextResponse.json({ ok: true, confirmed: true });
}
