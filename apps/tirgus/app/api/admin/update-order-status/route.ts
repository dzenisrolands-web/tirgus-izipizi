import { NextResponse } from "next/server";
import { assertSuperAdmin } from "@/lib/admin-auth";
import { notifyBuyerOrderStatus } from "@/lib/order-notifications";
import { sendEmail, brandedEmailLayout } from "@/lib/email";
import { loadAndRender } from "@/lib/email-templates";

const NEXT_STATUS: Record<string, string> = { paid: "processing", processing: "shipped", shipped: "delivered" };

/**
 * Admin-only fulfillment. Payment confirmation belongs exclusively to the
 * verified payment/reservation transaction, never to a status dropdown.
 */
export async function POST(req: Request) {
  const ctx = await assertSuperAdmin(req);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const { supabase } = ctx;

  const { orderId, status, reason } = await req.json().catch(() => ({})) as {
    orderId?: string; status?: string; reason?: string;
  };
  if (!orderId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId) || !status) {
    return NextResponse.json({ error: "Missing orderId or status" }, { status: 400 });
  }
  // Fetch current order
  const { data: order } = await supabase
    .from("orders")
    .select("id, status, payment_status, paid_at, payment_review_reason")
    .eq("id", orderId)
    .single();

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const previousStatus = order.status;
  if (status === "cancelled") {
    if (typeof reason !== "string" || reason.trim().length < 10 || reason.length > 4000) {
      return NextResponse.json({ error: "Cancellation requires a documented reason (10+ characters)" }, { status: 400 });
    }
    if (["shipped", "delivered"].includes(order.status)) {
      return NextResponse.json({ error: "Dispatched orders require a documented returns reconciliation" }, { status: 409 });
    }
    const { data, error } = await supabase.rpc("cancel_order_with_review", {
      p_order_id: orderId, p_reason: `admin_cancel:${reason.trim()}`, p_actor_id: ctx.user.id,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 409 });
    if (data !== true && order.status !== "cancelled") return NextResponse.json({ error: "Order changed concurrently; cancellation not applied" }, { status: 409 });
    return NextResponse.json({ ok: true, result: data, refund: "Paid cancellations require external refund review; no money was refunded." });
  }
  if (NEXT_STATUS[order.status] !== status || order.payment_status !== "paid" || !order.paid_at || order.payment_review_reason) {
    return NextResponse.json({ error: "Invalid fulfillment transition or unresolved payment review; payment cannot be changed by admin status" }, { status: 409 });
  }
  // Guard against a concurrent cancellation/refund. Never modify payment fields.
  const updates = { status };
  const { data: changed, error: updateErr } = await supabase
    .from("orders")
    .update(updates)
    .eq("id", orderId).eq("status", previousStatus).eq("payment_status", "paid")
    .is("payment_review_reason", null).select("id");

  if (updateErr) {
    console.error("[admin/update-order-status] update failed:", updateErr);
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // ── Side effects: trigger notifications + emails on status transitions ────
  if (!changed?.length) return NextResponse.json({ error: "Order changed concurrently" }, { status: 409 });
  const sideEffects: string[] = [];

  // Status transitions that should notify the buyer (push + email)
  if (
    status !== previousStatus &&
    ["processing", "shipped", "delivered"].includes(status)
  ) {
    // Push notification
    notifyBuyerOrderStatus(orderId, status).catch((e) =>
      console.error("[admin] notifyBuyerOrderStatus failed:", e)
    );
    sideEffects.push(`buyer_push_${status}`);

    // Status change email to buyer
    (async () => {
      try {
        const { data: fullOrder } = await supabase
          .from("orders")
          .select("order_number, buyer_name, buyer_email, delivery_type, delivery_info, locker_code")
          .eq("id", orderId)
          .single();
        if (!fullOrder?.buyer_email) return;

        const templateId = `order-${status}`;
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tirgus.izipizi.lv";
        const di = fullOrder.delivery_info as Record<string, unknown> | null;
        const deliveryLabel =
          fullOrder.delivery_type === "locker" ? "Pakomāts" :
          fullOrder.delivery_type === "courier" ? "Kurjers" :
          fullOrder.delivery_type === "express" ? "Ekspres piegāde" :
          fullOrder.delivery_type ?? "";
        const deliveryDetails = di
          ? [di.locker_name ?? di.address, di.locker_city ?? di.city].filter(Boolean).join(", ")
          : "";
        const lockerCode = fullOrder.locker_code
          ? `<p style="margin:8px 0 0;font-size:20px;font-weight:800;color:#166534;letter-spacing:2px;">PIN: ${fullOrder.locker_code}</p>`
          : "";

        const dbResult = await loadAndRender(templateId, {
          buyerName: fullOrder.buyer_name ?? "Pircēj",
          orderNumber: fullOrder.order_number,
          deliveryLabel,
          deliveryDetails,
          lockerCode,
          siteUrl,
        });

        if (dbResult) {
          await sendEmail({
            to: fullOrder.buyer_email,
            subject: dbResult.subject,
            html: brandedEmailLayout(dbResult.html),
          });
          sideEffects.push(`buyer_email_${status}`);
        }
      } catch (e) {
        console.error(`[admin] status email (${status}) failed:`, e);
      }
    })();
  }

  return NextResponse.json({ ok: true, updates, sideEffects });
}
