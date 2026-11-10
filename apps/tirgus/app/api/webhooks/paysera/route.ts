import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyPayseraCallback, getMode } from "@/lib/paysera";
import { notifySellersNewOrder } from "@/lib/order-notifications";
import { redeemPromoCode } from "@/lib/promo";
import { sendAllOrderEmails } from "@/lib/email";
import { settleReservedOrder } from "@/lib/stock-reservations";

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

  console.log(`[paysera][${ts}] callback received: ${method}`);

  // Paysera sends data either as URL params or as form body
  const url = new URL(req.url);
  let data = url.searchParams.get("data") ?? "";
  // Classic callbacks use ss1; sign is retained for existing internal/test integrations.
  let sign = url.searchParams.get("ss1") ?? url.searchParams.get("sign") ?? "";
  let source = data ? "url_params" : "none";

  if (!data) {
    try {
      const text = await req.text();
      const form = new URLSearchParams(text);
      data = form.get("data") ?? "";
      sign = form.get("ss1") ?? form.get("sign") ?? "";
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

  // Order lookup supplies notification metadata only. The RPC owns the payment
  // state, amount check, reservation consumption and duplicate-callback claim.
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, status, payment_status, total_cents, seller_ids, items, buyer_name, buyer_id, order_number, promo_code, promo_discount_cents")
    .eq("order_number", result.orderNumber)
    .single<{
      id: string;
      status: string;
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
    return new NextResponse(orderError ? "ORDER_LOOKUP_FAILED" : "ORDER_NOT_FOUND", { status: 503 });
  }

  try {
    const settlement = await settleReservedOrder(supabase, result.orderNumber, result.amountCents);
    if (settlement.outcome !== "paid") return new NextResponse("OK", { status: 200 });
  } catch {
    // Do not acknowledge a crash-critical stock failure; Paysera must retry.
    return new NextResponse("SETTLEMENT_FAILED", { status: 503 });
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
