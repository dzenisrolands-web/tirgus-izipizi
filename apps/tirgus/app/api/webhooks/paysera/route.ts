import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyPayseraCallback } from "@/lib/paysera";
import { notifySellersNewOrder } from "@/lib/order-notifications";
import { redeemPromoCode } from "@/lib/promo";
import { sendAllOrderEmails } from "@/lib/email";

export async function POST(req: Request) { return handle(req); }
export async function GET(req: Request) { return handle(req); }

const reply = (body: string, status = 200) => new NextResponse(body, {
  status, headers: { "Cache-Control": "no-store" },
});

type Order = {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  paid_at: string | null;
  total_cents: number;
  items: Array<{ drop_id?: string; quantity?: number }> | null;
  buyer_id: string | null;
  promo_code: string | null;
  promo_discount_cents: number | null;
};

async function handle(req: Request) {
  try {
    // Do not log the callback URL, signed payload, buyer data or provider secrets.
    const query = new URL(req.url).searchParams;
    let form = new URLSearchParams();
    if (req.method === "POST") {
      if ((req.headers.get("content-length") && Number(req.headers.get("content-length")) > 32768)
        || !(req.headers.get("content-type") ?? "").toLowerCase().startsWith("application/x-www-form-urlencoded")) {
        return reply("INVALID_FORM", 400);
      }
      const body = await req.text();
      if (body.length > 32768) return reply("INVALID_FORM", 400);
      form = new URLSearchParams(body);
    }
    const outer = new URLSearchParams([...query, ...form]);
    for (const key of ["data", "ss1", "sign"]) {
      if (outer.getAll(key).length > 1) return reply("DUPLICATE_PARAMETER", 400);
    }
    const data = outer.get("data") ?? "";
    const ss1 = outer.get("ss1");
    const legacy = outer.get("sign");
    // If both are supplied, neither may be an invalid/conflicting signature.
    const result = verifyPayseraCallback(data, ss1 ?? legacy ?? "");
    if (!result.valid || (ss1 !== null && legacy !== null && !verifyPayseraCallback(data, legacy).valid)) {
      console.warn("[paysera] invalid callback");
      return reply("INVALID", 400);
    }
    if (result.status !== "1") return reply("OK");

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
    const { data: order, error: readError } = await supabase.from("orders")
      .select("id, order_number, status, payment_status, paid_at, total_cents, items, buyer_id, promo_code, promo_discount_cents")
      .eq("order_number", result.orderNumber).single<Order>();
    if (readError || !order) return reply("ORDER_UNAVAILABLE", 503);

    // Paysera's library integration specifies payamount/paycurrency when present.
    // This EUR-only checkout cannot verify another currency's settlement equivalence;
    // discrepant/converted amounts stay unfulfilled for operator reconciliation.
    const payamount = result.params.payamount === undefined ? result.amountCents : Number(result.params.payamount);
    if (!Number.isSafeInteger(order.total_cents) || order.total_cents < 0
      || result.amountCents !== order.total_cents || payamount !== order.total_cents
      || (result.params.paycurrency !== undefined && result.params.paycurrency !== "EUR")) {
      console.error("[paysera] amount mismatch; operator review required", {
        order: order.order_number, expectedCents: order.total_cents,
        amountCents: result.amountCents, payamountCents: payamount,
        currency: result.params.currency, paycurrency: result.params.paycurrency ?? result.params.currency,
      });
      return reply("AMOUNT_MISMATCH", 400);
    }

    const dropItems = (order.items ?? []).filter((item) => item.drop_id);
    // Existing schema cannot atomically commit a payment + the unknown stock RPC.
    // A paid drop order without paid_at is an incomplete finalization: never replay
    // an uncertain stock mutation, notify or acknowledge completion automatically.
    if (order.payment_status === "paid") {
      return dropItems.length && !order.paid_at ? reply("FINALIZATION_REQUIRES_REVIEW", 503) : reply("OK");
    }
    if (order.status !== "pending" || !["awaiting", "failed"].includes(order.payment_status)) {
      return reply("ORDER_STATE_CONFLICT", 409);
    }
    if (dropItems.some((item) => !Number.isSafeInteger(item.quantity) || (item.quantity ?? 0) < 1)) {
      return reply("INVALID_DROP_ITEMS", 409);
    }

    const paidAt = new Date().toISOString();
    // Only the winner may run stock/promo/notification side effects.
    const { data: claimed, error: updateError } = await supabase.from("orders").update({
      payment_status: "paid", status: dropItems.length ? "pending" : "paid", paid_at: dropItems.length ? null : paidAt,
    }).eq("id", order.id).eq("total_cents", order.total_cents).eq("status", "pending").eq("payment_status", order.payment_status)
      .is("paid_at", null).select("id");
    if (updateError) return reply("UPDATE_FAILED", 503);
    if (!claimed?.length) {
      const { data: current, error } = await supabase.from("orders")
        .select("payment_status, paid_at").eq("id", order.id).single();
      if (error || !current) return reply("UPDATE_UNCONFIRMED", 503);
      return current.payment_status === "paid" && (!dropItems.length || current.paid_at)
        ? reply("OK") : reply("UPDATE_UNCONFIRMED", 503);
    }

    for (const item of dropItems) {
      const { error: rpcError } = await supabase.rpc("confirm_hot_drop_payment", {
        p_drop_id: item.drop_id, p_quantity: item.quantity,
      });
      let stockFailed = !!rpcError;
      // Preserve the pre-existing RPC-optional mechanism only when PostgREST
      // explicitly says the function does not exist (no unknown-outcome replay).
      if (rpcError?.code === "PGRST202") {
        const { data: drop, error: readError } = await supabase.from("hot_drops")
          .select("reserved_quantity, sold_quantity").eq("id", item.drop_id).single();
        if (!readError && drop && Number.isSafeInteger(drop.reserved_quantity)
          && Number.isSafeInteger(drop.sold_quantity) && drop.sold_quantity >= 0
          && drop.reserved_quantity >= item.quantity!) {
          const { data: updated, error } = await supabase.from("hot_drops").update({
            reserved_quantity: drop.reserved_quantity - item.quantity!,
            sold_quantity: drop.sold_quantity + item.quantity!,
            updated_at: new Date().toISOString(),
          }).eq("id", item.drop_id).eq("reserved_quantity", drop.reserved_quantity)
            .eq("sold_quantity", drop.sold_quantity).select("id");
          stockFailed = !!error || !updated?.length;
        }
      }
      if (stockFailed) {
        console.error("[paysera] hot-drop finalization requires operator review", {
          order: order.order_number, code: rpcError?.code,
        });
        // Never repeat uncertain mutations, including a lost conditional-update race.
        return reply("FINALIZATION_REQUIRES_REVIEW", 503);
      }
    }
    if (dropItems.length) {
      const { data: finalized, error } = await supabase.from("orders").update({ status: "paid", paid_at: paidAt })
        .eq("id", order.id).eq("payment_status", "paid").eq("status", "pending")
        .is("paid_at", null).select("id");
      if (error || !finalized?.length) return reply("FINALIZATION_REQUIRES_REVIEW", 503);
    }

    // Existing best-effort side effects, only after a successful winning transition.
    // No schema/outbox change: a process crash here can still lose a notification.
    if (order.promo_code && order.promo_discount_cents && order.promo_discount_cents > 0) {
      await redeemPromoCode(order.promo_code, order.buyer_id, order.id, order.order_number, order.promo_discount_cents)
        .catch(() => console.error("[paysera] promo redemption failed"));
    }
    await Promise.all([
      notifySellersNewOrder(order.id).catch(() => console.error("[paysera] seller notification failed")),
      sendAllOrderEmails(order.id).catch(() => console.error("[paysera] order email failed")),
    ]);
    return reply("OK");
  } catch {
    console.error("[paysera] callback processing failed");
    return reply("PROCESSING_FAILED", 503);
  }
}
