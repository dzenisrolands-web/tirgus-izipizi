/**
 * Order-status push notification helpers — server-side only.
 *
 * These run in API routes / webhooks (with SUPABASE_SECRET_KEY), not in the browser.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { sendPushToSubscriptions } from "@/lib/push";
import { sendSms } from "@/lib/sms";

type OrderRow = {
  id: string;
  order_number: string;
  buyer_id: string | null;
  buyer_name: string | null;
  buyer_email: string | null;
  buyer_phone: string | null;
  delivery_info: { locker_name?: string; locker_city?: string; locker_address?: string } | null;
  locker_code: string | null;
  items: Array<{ title: string; quantity: number }> | null;
  seller_ids: string[] | null;
  total_cents: number | null;
};

const STATUS_TEMPLATES: Record<string, (o: OrderRow) => { title: string; body: string }> = {
  paid: (o) => ({
    title: "💚 Pasūtījums apmaksāts",
    body: `${o.order_number} — gaidi paziņojumu, kad ražotājs to apstiprinās.`,
  }),
  processing: (o) => ({
    title: "👨‍🍳 Ražotājs apstiprināja pasūtījumu",
    body: `${o.order_number} tiek sagatavots. Drīz pa ceļam uz pakomātu!`,
  }),
  shipped: (o) => ({
    title: "📦 Tavs pasūtījums ir gatavs!",
    body: o.locker_code
      ? `Pakomāts ${o.delivery_info?.locker_name ?? ""} · Kods: ${o.locker_code}`
      : `${o.order_number} ir pakomātā ${o.delivery_info?.locker_name ?? ""}.`,
  }),
  delivered: (o) => ({
    title: "✅ Pasūtījums saņemts",
    body: `Paldies par ${o.order_number}! Atstāj atsauksmi, ja patika.`,
  }),
};

function svc(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );
}

/**
 * Notify the buyer about a status change.
 * - PUSH: works for logged-in buyers with push subscription
 * - SMS:  for status="shipped" with locker_code + buyer_phone, sends SMS too
 *         (works for both registered and guest buyers)
 */
export async function notifyBuyerOrderStatus(
  orderId: string,
  status: string,
): Promise<{ pushSent: number; smsSent: boolean; reasons: string[] }> {
  const supabase = svc();
  const reasons: string[] = [];
  const { data: order } = await supabase
    .from("orders")
    .select("id, order_number, buyer_id, buyer_name, buyer_email, buyer_phone, delivery_info, locker_code, items, seller_ids, total_cents")
    .eq("id", orderId)
    .single<OrderRow>();

  if (!order) return { pushSent: 0, smsSent: false, reasons: ["order not found"] };

  const tmpl = STATUS_TEMPLATES[status];
  if (!tmpl) return { pushSent: 0, smsSent: false, reasons: [`no template for status '${status}'`] };

  const { title, body } = tmpl(order);

  // ── PUSH (logged-in buyers only) ───────────────────────────────────────────
  let pushSent = 0;
  if (order.buyer_id) {
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", order.buyer_id);

    if (subs && subs.length > 0) {
      const result = await sendPushToSubscriptions(subs, {
        title,
        body,
        url: `/cart/success?order=${encodeURIComponent(order.order_number)}`,
      });
      pushSent = result.sent;
      if (result.failed > 0) reasons.push(`push: ${result.failed} failed`);
    } else {
      reasons.push("push: no subscriptions");
    }
  } else {
    reasons.push("push: guest checkout");
  }

  // ── SMS (for "shipped" with locker code; works for guests too) ─────────────
  let smsSent = false;
  if (status === "shipped" && order.locker_code && order.buyer_phone) {
    const lockerName = order.delivery_info?.locker_name ?? "";
    const smsText = `Pasutijums ${order.order_number} ievietots pakomata ${lockerName}. PIN kods: ${order.locker_code}. Saglaba 48h.`;
    const r = await sendSms(order.buyer_phone, smsText);
    smsSent = r.ok;
    if (!r.ok) reasons.push(`sms: ${r.error}`);
    else reasons.push(`sms ok (${r.messageId})`);
  } else if (status === "shipped") {
    if (!order.locker_code) reasons.push("sms: no locker_code");
    if (!order.buyer_phone) reasons.push("sms: no buyer_phone");
  }

  return { pushSent, smsSent, reasons };
}

/**
 * Push all sellers in an order about new paid order.
 * Used by Paysera webhook when payment_status -> paid.
 */
export async function notifySellersNewOrder(
  orderId: string,
): Promise<{ sent: number; reason?: string }> {
  const supabase = svc();
  const { data: order } = await supabase
    .from("orders")
    .select("id, order_number, buyer_id, buyer_name, buyer_email, delivery_info, locker_code, items, seller_ids, total_cents")
    .eq("id", orderId)
    .single<OrderRow>();

  if (!order) return { sent: 0, reason: "order not found" };
  if (!order.seller_ids?.length) return { sent: 0, reason: "no seller_ids" };

  // Map seller -> user_id
  const { data: sellers } = await supabase
    .from("sellers")
    .select("id, user_id")
    .in("id", order.seller_ids);

  const userIds = (sellers ?? []).map((s) => s.user_id).filter(Boolean);
  if (userIds.length === 0) return { sent: 0, reason: "no seller user_ids" };

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .in("user_id", userIds);

  if (!subs || subs.length === 0) return { sent: 0, reason: "no push subscriptions" };

  const itemSummary = (order.items ?? [])
    .map((i) => `${i.title} ×${i.quantity}`)
    .slice(0, 2)
    .join(", ");
  const more = (order.items?.length ?? 0) > 2 ? ` +${order.items!.length - 2}` : "";

  const result = await sendPushToSubscriptions(subs, {
    title: "🛒 Jauns apmaksāts pasūtījums!",
    body: `${order.order_number} · ${itemSummary}${more} · ${(order.total_cents! / 100).toFixed(2)}€`,
    url: "/dashboard/pasutijumi",
    tag: `order_new_${order.id}`,
    requireInteraction: true,
  });
  return { sent: result.sent, reason: result.failed > 0 ? `${result.failed} failed` : undefined };
}

/**
 * Reminder push for sellers who haven't moved a paid order to `processing`.
 * Tone escalates with the reminder count (1 = friendly, 2 = urgent, 3 = last call).
 */
export async function notifySellerReminder(
  orderId: string,
  reminderCount: number,
): Promise<{ sent: number; reason?: string }> {
  const supabase = svc();
  const { data: order } = await supabase
    .from("orders")
    .select("id, order_number, items, seller_ids, total_cents, paid_at")
    .eq("id", orderId)
    .single<{
      id: string; order_number: string; items: Array<{ title: string; quantity: number }> | null;
      seller_ids: string[] | null; total_cents: number | null; paid_at: string | null;
    }>();

  if (!order) return { sent: 0, reason: "order not found" };
  if (!order.seller_ids?.length) return { sent: 0, reason: "no seller_ids" };

  const { data: sellers } = await supabase
    .from("sellers").select("id, user_id").in("id", order.seller_ids);
  const userIds = (sellers ?? []).map((s) => s.user_id).filter(Boolean);
  if (userIds.length === 0) return { sent: 0, reason: "no seller user_ids" };

  const { data: subs } = await supabase
    .from("push_subscriptions").select("endpoint, p256dh, auth").in("user_id", userIds);
  if (!subs || subs.length === 0) return { sent: 0, reason: "no push subscriptions" };

  const elapsedH = order.paid_at
    ? Math.floor((Date.now() - new Date(order.paid_at).getTime()) / 3_600_000)
    : 0;
  const itemCount = order.items?.length ?? 0;

  const tone =
    reminderCount === 1
      ? { title: "⏰ Pasūtījums gaida apstiprinājumu", body: `${order.order_number} · ${itemCount} prece(s) · gaida ~30 min. Apstiprini, lai pircējs nezaudē uzticību.` }
      : reminderCount === 2
        ? { title: "🚨 Pasūtījums joprojām nav apstiprināts", body: `${order.order_number} gaida ${elapsedH}h. Lūdzu apstiprini vai sazinies ar mums.` }
        : { title: "❗ Pēdējais brīdinājums — pasūtījums tiks atcelts", body: `${order.order_number} tiks automātiski atcelts, ja nepastiprināsi tuvākajās stundās.` };

  const result = await sendPushToSubscriptions(subs, {
    ...tone,
    url: "/dashboard/pasutijumi",
    tag: `order_reminder_${order.id}`,
    requireInteraction: true,
  });
  return { sent: result.sent, reason: result.failed > 0 ? `${result.failed} failed` : undefined };
}

/**
 * Notify both buyer and sellers that an order was auto-cancelled (24 h passed
 * with no seller confirmation).
 */
export async function notifyOrderAutoCancelled(
  orderId: string,
): Promise<{ buyerSent: number; sellerSent: number; reasons: string[] }> {
  const supabase = svc();
  const reasons: string[] = [];
  const { data: order } = await supabase
    .from("orders")
    .select("id, order_number, buyer_id, seller_ids")
    .eq("id", orderId)
    .single<{ id: string; order_number: string; buyer_id: string | null; seller_ids: string[] | null }>();

  if (!order) return { buyerSent: 0, sellerSent: 0, reasons: ["order not found"] };

  let buyerSent = 0;
  if (order.buyer_id) {
    const { data: subs } = await supabase
      .from("push_subscriptions").select("endpoint, p256dh, auth").eq("user_id", order.buyer_id);
    if (subs && subs.length > 0) {
      const r = await sendPushToSubscriptions(subs, {
        title: "❌ Pasūtījums atcelts",
        body: `${order.order_number} tika atcelts, jo ražotājs neapstiprināja 24h laikā. Nauda tiks atgriezta.`,
        url: `/cart/success?order=${encodeURIComponent(order.order_number)}`,
        tag: `order_cancelled_${order.id}`,
        requireInteraction: true,
      });
      buyerSent = r.sent;
    } else {
      reasons.push("buyer: no subscriptions");
    }
  } else {
    reasons.push("buyer: guest checkout");
  }

  let sellerSent = 0;
  if (order.seller_ids?.length) {
    const { data: sellers } = await supabase
      .from("sellers").select("id, user_id").in("id", order.seller_ids);
    const userIds = (sellers ?? []).map((s) => s.user_id).filter(Boolean);
    if (userIds.length > 0) {
      const { data: subs } = await supabase
        .from("push_subscriptions").select("endpoint, p256dh, auth").in("user_id", userIds);
      if (subs && subs.length > 0) {
        const r = await sendPushToSubscriptions(subs, {
          title: "❌ Pasūtījums atcelts (neapstiprināts 24h)",
          body: `${order.order_number} tika auto-atcelts. Pievērs uzmanību nākamajiem pasūtījumiem.`,
          url: "/dashboard/pasutijumi",
          tag: `order_cancelled_${order.id}`,
          requireInteraction: true,
        });
        sellerSent = r.sent;
      } else {
        reasons.push("seller: no subscriptions");
      }
    }
  }

  return { buyerSent, sellerSent, reasons };
}
