import { NextResponse } from "next/server";
import { assertSuperAdmin } from "@/lib/admin-auth";
import { notifySellersNewOrder, notifyBuyerOrderStatus } from "@/lib/order-notifications";
import { sendAllOrderEmails, sendEmail, brandedEmailLayout } from "@/lib/email";
import { loadAndRender } from "@/lib/email-templates";

const PAID_FLOW_STATUSES = new Set(["paid", "processing", "shipped", "delivered"]);

/**
 * Admin-only: update order status + sync payment_status/paid_at.
 * When changing to "paid", triggers the full flow (notifications + emails)
 * — same as the Paysera webhook would.
 */
export async function POST(req: Request) {
  const ctx = await assertSuperAdmin(req);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const { supabase } = ctx;

  const { orderId, status, resendNotifications } = await req.json().catch(() => ({})) as {
    orderId?: string; status?: string; resendNotifications?: boolean;
  };
  if (!orderId || !status) {
    return NextResponse.json({ error: "Missing orderId or status" }, { status: 400 });
  }

  // Fetch current order
  const { data: order } = await supabase
    .from("orders")
    .select("id, status, payment_status, paid_at")
    .eq("id", orderId)
    .single();

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const previousStatus = order.status;
  const wasPaid = order.payment_status === "paid";
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

  // ── Side effects: trigger notifications + emails on status transitions ────
  const sideEffects: string[] = [];

  // Newly marked as paid OR resend requested → full "paid" flow
  if (status === "paid" && (!wasPaid || resendNotifications)) {
    notifySellersNewOrder(orderId).catch((e) =>
      console.error("[admin] notifySellersNewOrder failed:", e)
    );
    sendAllOrderEmails(orderId)
      .then((r) => {
        if (!r.buyer.ok) console.warn("[admin] buyer email skipped:", r.buyer.error);
        for (const s of r.sellers) {
          if (!s.ok) console.warn("[admin] seller email failed:", s.error);
        }
      })
      .catch((e) => console.error("[admin] sendAllOrderEmails failed:", e));
    sideEffects.push("seller_push", "order_emails");
  }

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
