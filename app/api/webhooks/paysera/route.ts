import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyPayseraCallback, getMode } from "@/lib/paysera";
import { notifySellersNewOrder } from "@/lib/order-notifications";
import { redeemPromoCode } from "@/lib/promo";
import { sendAllOrderEmails } from "@/lib/email";

/**
 * Paysera callback endpoint.
 *
 * Paysera POSTs (or sometimes GETs) to this URL after a payment attempt.
 * We must respond with body "OK" if the payment was successfully recorded.
 *
 * Status codes from Paysera:
 *   0 = payment not executed
 *   1 = payment successful
 *   2 = payment order accepted, will be executed soon (rare)
 */
export async function POST(req: Request) {
  return handle(req);
}

export async function GET(req: Request) {
  return handle(req);
}

async function handle(req: Request) {
  const ts = new Date().toISOString();
  const method = req.method;

  console.log(`[paysera][${ts}] callback received: ${method} ${req.url}`);

  // Paysera sends data either as URL params or as form body
  const url = new URL(req.url);
  let data = url.searchParams.get("data") ?? "";
  let sign = url.searchParams.get("sign") ?? "";
  let source = data ? "url_params" : "none";

  if (!data) {
    try {
      const text = await req.text();
      const form = new URLSearchParams(text);
      data = form.get("data") ?? "";
      sign = form.get("sign") ?? "";
      source = data ? "form_body" : "empty";
    } catch (e) {
      console.error(`[paysera][${ts}] failed to parse body:`, e);
    }
  }

  console.log(`[paysera][${ts}] data source=${source}, data_length=${data.length}, sign_length=${sign.length}`);

  if (!data) {
    console.error(`[paysera][${ts}] no data received — Paysera might be sending to wrong URL or format`);
    return new NextResponse("NO_DATA", { status: 400 });
  }

  const result = verifyPayseraCallback(data, sign);
  if (!result.valid) {
    console.error(`[paysera][${ts}] VERIFICATION FAILED: ${result.reason}`);
    console.error(`[paysera][${ts}] sign_password_set=${!!process.env.PAYSERA_SIGN_PASSWORD}, mode=${getMode()}`);
    return new NextResponse("INVALID", { status: 400 });
  }

  console.log(`[paysera][${ts}] ✓ verified: order=${result.orderNumber} status=${result.status} amount=${result.amountCents} mode=${getMode()}`);

  // Only mark as paid on status=1
  if (result.status !== "1") {
    console.log(`[paysera][${ts}] status=${result.status} (not 1) — acknowledging without processing`);
    return new NextResponse("OK", { status: 200 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );

  // Find order; ignore if already paid (idempotency)
  const { data: order } = await supabase
    .from("orders")
    .select("id, payment_status, total_cents, seller_ids, items, buyer_name, buyer_id, order_number, promo_code, promo_discount_cents")
    .eq("order_number", result.orderNumber)
    .single<{
      id: string;
      payment_status: string;
      total_cents: number;
      seller_ids: string[] | null;
      items: Array<{ drop_id?: string; quantity?: number; reservation_id?: string }> | null;
      buyer_name: string | null;
      buyer_id: string | null;
      order_number: string;
      promo_code: string | null;
      promo_discount_cents: number | null;
    }>();

  if (!order) {
    console.error("[paysera] order not found:", result.orderNumber);
    return new NextResponse("OK", { status: 200 }); // still respond OK to stop retries
  }

  if (order.payment_status === "paid") {
    return new NextResponse("OK", { status: 200 });
  }

  // Validate amount matches (defense against tampering — although signature already covers this)
  if (result.amountCents !== order.total_cents) {
    console.error("[paysera] amount mismatch:", { expected: order.total_cents, got: result.amountCents });
    return new NextResponse("AMOUNT_MISMATCH", { status: 400 });
  }

  // Mark as paid
  await supabase
    .from("orders")
    .update({
      payment_status: "paid",
      status: "paid",
      paid_at: new Date().toISOString(),
    })
    .eq("id", order.id);

  // If this order contains drop items, transition reserved → sold
  const dropItems = (order.items ?? []).filter((it) => it.drop_id);
  for (const item of dropItems) {
    const qty = item.quantity ?? 1;
    // Atomic via RPC if available, else manual: decrement reserved, increment sold
    const { error } = await supabase.rpc("confirm_hot_drop_payment", {
      p_drop_id: item.drop_id,
      p_quantity: qty,
    });
    if (error) {
      // Fallback: manual UPDATE if RPC doesn't exist yet
      console.warn("[paysera] confirm_hot_drop_payment RPC failed, falling back to direct UPDATE:", error.message);
      const { data: drop } = await supabase
        .from("hot_drops")
        .select("reserved_quantity, sold_quantity")
        .eq("id", item.drop_id)
        .single();
      if (drop) {
        await supabase
          .from("hot_drops")
          .update({
            reserved_quantity: Math.max(0, drop.reserved_quantity - qty),
            sold_quantity: drop.sold_quantity + qty,
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.drop_id);
      }
    }
  }

  // Record promo code redemption (only after confirmed payment)
  if (order.promo_code && order.promo_discount_cents && order.promo_discount_cents > 0) {
    redeemPromoCode(
      order.promo_code,
      order.buyer_id,
      order.id,
      order.order_number,
      order.promo_discount_cents,
    ).catch((e) => console.error("[paysera] promo redemption failed:", e));
  }

  // Notify sellers about new paid order via push (best-effort)
  notifySellersNewOrder(order.id).catch((e) =>
    console.error("[paysera] notifySellersNewOrder failed:", e)
  );

  // Email buyer + sellers + admin copy (best-effort)
  sendAllOrderEmails(order.id)
    .then((r) => {
      if (!r.buyer.ok) console.warn("[paysera] buyer email skipped:", r.buyer.error);
      for (const s of r.sellers) {
        if (!s.ok) console.warn("[paysera] seller email failed:", s.error);
      }
      if (!r.admin.ok) console.warn("[paysera] admin email skipped:", r.admin.error);
    })
    .catch((e) => console.error("[paysera] sendAllOrderEmails failed:", e));

  return new NextResponse("OK", { status: 200 });
}
