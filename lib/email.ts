/**
 * Email adapter — Resend transactional email.
 *
 * Required env:
 *   RESEND_API_KEY     — from resend.com → API Keys
 *   EMAIL_FROM         — verified sender, e.g. 'tirgus.izipizi.lv <noreply@izipizi.lv>'
 *   EMAIL_REPLY_TO     — optional, e.g. info@izipizi.lv
 *
 * If RESEND_API_KEY is unset, send() becomes a no-op that logs to console
 * (so dev/test environments don't fail).
 */

import { createClient } from "@supabase/supabase-js";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export type SendEmailParams = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
};

export type SendEmailResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function sendEmail(p: SendEmailParams): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    console.warn("[email] RESEND_API_KEY or EMAIL_FROM not set — skipping send", { to: p.to, subject: p.subject });
    return { ok: false, error: "RESEND_API_KEY or EMAIL_FROM not set" };
  }

  if (!p.to || !p.to.includes("@")) {
    return { ok: false, error: "invalid recipient" };
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [p.to],
        subject: p.subject,
        html: p.html,
        text: p.text ?? stripHtml(p.html),
        reply_to: p.replyTo ?? process.env.EMAIL_REPLY_TO ?? undefined,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `HTTP ${res.status}: ${body.slice(0, 200)}` };
    }

    const data = (await res.json()) as { id: string };
    return { ok: true, id: data.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "unknown error" };
  }
}

// ─── Templates ───────────────────────────────────────────────────────────────

type OrderItem = {
  title: string;
  quantity: number;
  price: number;
  unit?: string;
};

type OrderEmailData = {
  orderNumber: string;
  buyerName: string;
  buyerEmail: string;
  items: OrderItem[];
  totalCents: number;
  deliveryType: "locker" | "courier" | "express" | string;
  deliveryInfo: Record<string, unknown> | null;
};

export async function sendOrderConfirmationEmail(o: OrderEmailData): Promise<SendEmailResult> {
  const total = (o.totalCents / 100).toFixed(2);
  const deliveryLabel =
    o.deliveryType === "locker"  ? "Pakomāts" :
    o.deliveryType === "courier" ? "Kurjers" :
    o.deliveryType === "express" ? "Ekspres piegāde" :
    o.deliveryType;

  const deliveryDetails = formatDeliveryInfo(o.deliveryType, o.deliveryInfo);

  const itemsRows = o.items.map((it) => {
    const lineTotal = (it.price * it.quantity).toFixed(2);
    return `<tr>
      <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;">${escapeHtml(it.title)}</td>
      <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;text-align:right;color:#555;">${it.quantity}${it.unit ? " " + escapeHtml(it.unit) : ""}</td>
      <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;text-align:right;font-variant-numeric:tabular-nums;">${lineTotal}€</td>
    </tr>`;
  }).join("");

  const html = `<!doctype html>
<html lang="lv">
<body style="margin:0;padding:0;background:#f6f7f8;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#192635;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f8;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
        <tr>
          <td style="background:#192635;color:#53F3A4;padding:24px 28px;font-size:22px;font-weight:800;letter-spacing:-0.02em;">
            tirgus.izipizi.lv
          </td>
        </tr>
        <tr>
          <td style="padding:28px;">
            <h1 style="margin:0 0 8px 0;font-size:22px;font-weight:800;">Paldies par pasūtījumu, ${escapeHtml(o.buyerName)}!</h1>
            <p style="margin:0 0 20px 0;color:#555;font-size:14px;line-height:1.6;">
              Pasūtījums <strong>${escapeHtml(o.orderNumber)}</strong> ir saņemts un apmaksāts.
              Drīzumā saņemsi paziņojumu, kad ražotājs to apstiprinās un sagatavos.
            </p>

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;font-size:14px;">
              ${itemsRows}
              <tr>
                <td colspan="2" style="padding:12px 0 0 0;font-weight:700;">Kopā</td>
                <td style="padding:12px 0 0 0;text-align:right;font-weight:800;font-size:16px;font-variant-numeric:tabular-nums;">${total}€</td>
              </tr>
            </table>

            <div style="background:#f6f7f8;border-radius:12px;padding:16px;margin:16px 0;">
              <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#888;margin-bottom:6px;">Piegāde</div>
              <div style="font-weight:600;">${escapeHtml(deliveryLabel)}</div>
              ${deliveryDetails ? `<div style="margin-top:4px;color:#555;font-size:13px;">${deliveryDetails}</div>` : ""}
            </div>

            <p style="margin:24px 0 0 0;color:#555;font-size:13px;line-height:1.6;">
              Statusu vari sekot <a href="${escapeHtml(siteUrl())}/cart/success?order=${encodeURIComponent(o.orderNumber)}" style="color:#AD47FF;font-weight:600;">savā pasūtījumu sadaļā</a>.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#fafafa;padding:16px 28px;color:#888;font-size:12px;border-top:1px solid #f0f0f0;">
            SIA Svaigi · Reģ. nr. 40103915568 · tirgus.izipizi.lv
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return sendEmail({
    to: o.buyerEmail,
    subject: `Pasūtījums ${o.orderNumber} apmaksāts — tirgus.izipizi.lv`,
    html,
  });
}

/**
 * Send order confirmation by looking up the order in DB. Used by the Paysera
 * webhook so we don't have to pass all the fields around.
 */
export async function sendOrderConfirmationByOrderId(orderId: string): Promise<SendEmailResult> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );
  const { data: order } = await supabase
    .from("orders")
    .select("order_number, buyer_name, buyer_email, items, total_cents, delivery_type, delivery_info")
    .eq("id", orderId)
    .single<{
      order_number: string;
      buyer_name: string | null;
      buyer_email: string | null;
      items: OrderItem[] | null;
      total_cents: number | null;
      delivery_type: string | null;
      delivery_info: Record<string, unknown> | null;
    }>();

  if (!order) return { ok: false, error: "order not found" };
  if (!order.buyer_email) return { ok: false, error: "no buyer_email" };

  return sendOrderConfirmationEmail({
    orderNumber: order.order_number,
    buyerName: order.buyer_name ?? "Pircēj",
    buyerEmail: order.buyer_email,
    items: order.items ?? [],
    totalCents: order.total_cents ?? 0,
    deliveryType: order.delivery_type ?? "locker",
    deliveryInfo: order.delivery_info,
  });
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://tirgus.izipizi.lv";
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function formatDeliveryInfo(type: string, info: Record<string, unknown> | null): string {
  if (!info) return "";
  const v = (k: string) => (typeof info[k] === "string" ? (info[k] as string) : "");
  if (type === "locker") {
    const parts = [v("locker_name"), v("locker_address"), v("locker_city")].filter(Boolean);
    return escapeHtml(parts.join(", "));
  }
  const parts = [v("address"), v("city"), v("postal_code")].filter(Boolean);
  return escapeHtml(parts.join(", "));
}
