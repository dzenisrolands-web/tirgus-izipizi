import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getMode } from "@/lib/paysera";

/**
 * Admin-only: Paysera webhook diagnostics.
 *
 * GET  → reports env config and recent order webhook status
 * POST → simulates a webhook callback for a specific order (marks as paid + triggers flow)
 */
export async function GET(req: Request) {
  const authResult = await verifyAdmin(req);
  if (!authResult.ok) return authResult.response!;

  const mode = getMode();
  const hasProjectId = !!process.env.PAYSERA_PROJECT_ID;
  const hasSignPassword = !!process.env.PAYSERA_SIGN_PASSWORD;
  const hasSiteUrl = !!process.env.NEXT_PUBLIC_SITE_URL;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "(not set — falls back to request host)";
  const callbackUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://tirgus.izipizi.lv"}/api/webhooks/paysera`;

  // Check recent orders — how many are stuck in pending
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );
  const { data: recentOrders } = await supabase
    .from("orders")
    .select("id, order_number, status, payment_status, paid_at, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  const orders = recentOrders ?? [];
  const pending = orders.filter((o) => o.payment_status === "awaiting" || o.status === "pending");
  const paid = orders.filter((o) => o.payment_status === "paid");

  return NextResponse.json({
    config: {
      mode,
      PAYSERA_PROJECT_ID: hasProjectId ? "✓ set" : "✗ MISSING",
      PAYSERA_SIGN_PASSWORD: hasSignPassword ? "✓ set" : "✗ MISSING — webhook will always fail!",
      NEXT_PUBLIC_SITE_URL: hasSiteUrl ? siteUrl : "✗ NOT SET — callback URL uses request host",
      callback_url: callbackUrl,
    },
    diagnosis: {
      total_recent: orders.length,
      stuck_pending: pending.length,
      paid: paid.length,
      likely_issue: !hasSignPassword
        ? "PAYSERA_SIGN_PASSWORD is not set — signature verification always fails"
        : pending.length > 0 && paid.length === 0
          ? "All orders stuck in pending — webhook callback is likely not reaching the server. Check: 1) callback_url in Paysera project settings, 2) Vercel Function Logs for /api/webhooks/paysera"
          : pending.length > paid.length
            ? "Some orders stuck — possible intermittent webhook failures. Check Vercel Function Logs."
            : "Webhook appears to be working (some orders are paid).",
    },
    recent_orders: orders.map((o) => ({
      order_number: o.order_number,
      status: o.status,
      payment_status: o.payment_status,
      paid_at: o.paid_at,
      created_at: o.created_at,
      webhook_received: o.payment_status === "paid" ? "✓" : "✗",
    })),
    help: {
      check_vercel_logs: "Vercel Dashboard → Project → Logs → filter 'api/webhooks/paysera'",
      check_paysera_dashboard: "Paysera → Projects → tirgus.izipizi.lv → Callbacks/Notifications",
      manual_fix: "POST to this endpoint with { orderNumber: 'TRG-...' } to manually mark as paid + trigger full flow",
    },
  });
}

/**
 * POST — manually trigger the "paid" flow for a specific order.
 * This is the emergency workaround when the webhook isn't working.
 */
export async function POST(req: Request) {
  const authResult = await verifyAdmin(req);
  if (!authResult.ok) return authResult.response!;

  const { orderNumber } = await req.json().catch(() => ({}));
  if (!orderNumber) {
    return NextResponse.json({ error: "Norādi orderNumber" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );

  const { data: order } = await supabase
    .from("orders")
    .select("id, order_number, payment_status, total_cents")
    .eq("order_number", orderNumber)
    .single();

  if (!order) {
    return NextResponse.json({ error: `Pasūtījums ${orderNumber} nav atrasts` }, { status: 404 });
  }

  if (order.payment_status === "paid") {
    return NextResponse.json({ ok: true, message: "Jau apmaksāts", order_number: order.order_number });
  }

  // Mark as paid
  const { error: updateErr } = await supabase
    .from("orders")
    .update({
      payment_status: "paid",
      status: "paid",
      paid_at: new Date().toISOString(),
    })
    .eq("id", order.id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // Trigger notifications + emails (same as webhook)
  const { notifySellersNewOrder } = await import("@/lib/order-notifications");
  const { sendAllOrderEmails } = await import("@/lib/email");

  const [pushResult, emailResult] = await Promise.allSettled([
    notifySellersNewOrder(order.id),
    sendAllOrderEmails(order.id),
  ]);

  return NextResponse.json({
    ok: true,
    order_number: order.order_number,
    status: "paid",
    push: pushResult.status === "fulfilled" ? pushResult.value : { error: String(pushResult) },
    emails: emailResult.status === "fulfilled" ? emailResult.value : { error: String(emailResult) },
  });
}

// ── Auth helper ──────────────────────────────────────────────────────────────

async function verifyAdmin(req: Request): Promise<{ ok: boolean; response?: NextResponse }> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace("Bearer ", "");
  if (!token) return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  return { ok: true };
}
