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
import { loadAndRender } from "@/lib/email-templates";

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

  const itemsTable = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;font-size:14px;">${itemsRows}<tr><td colspan="2" style="padding:12px 0 0 0;font-weight:700;">Kopā</td><td style="padding:12px 0 0 0;text-align:right;font-weight:800;font-size:16px;font-variant-numeric:tabular-nums;">${total}€</td></tr></table>`;

  // Try DB template first
  const dbResult = await loadAndRender("order-buyer", {
    buyerName: escapeHtml(o.buyerName),
    orderNumber: escapeHtml(o.orderNumber),
    itemsTable,
    total,
    deliveryLabel: escapeHtml(deliveryLabel),
    deliveryDetails: deliveryDetails || "",
    siteUrl: siteUrl(),
  });
  if (dbResult) {
    return sendEmail({
      to: o.buyerEmail,
      subject: dbResult.subject,
      html: brandedEmailLayout(dbResult.html),
    });
  }

  const body = `
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
    </p>`;

  return sendEmail({
    to: o.buyerEmail,
    subject: `Pasūtījums ${o.orderNumber} apmaksāts — tirgus.izipizi.lv`,
    html: brandedEmailLayout(body),
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

/**
 * Notify a seller (by email) about a new paid order.
 */
export async function sendSellerNewOrderEmail(p: {
  sellerEmail: string;
  sellerName: string;
  orderNumber: string;
  buyerName: string;
  items: OrderItem[];
  totalCents: number;
  deliveryType: string;
  deliveryInfo: Record<string, unknown> | null;
}): Promise<SendEmailResult> {
  const total = (p.totalCents / 100).toFixed(2);
  const deliveryLabel =
    p.deliveryType === "locker"  ? "Pakomāts" :
    p.deliveryType === "courier" ? "Kurjers" :
    p.deliveryType === "express" ? "Ekspres piegāde" :
    p.deliveryType;
  const deliveryDetails = formatDeliveryInfo(p.deliveryType, p.deliveryInfo);

  const itemsRows = p.items.map((it) => {
    const lineTotal = (it.price * it.quantity).toFixed(2);
    return `<tr>
      <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;">${escapeHtml(it.title)}</td>
      <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;text-align:right;color:#555;">${it.quantity}${it.unit ? " " + escapeHtml(it.unit) : ""}</td>
      <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;text-align:right;font-variant-numeric:tabular-nums;">${lineTotal}€</td>
    </tr>`;
  }).join("");

  const itemsTable = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;font-size:14px;">${itemsRows}<tr><td colspan="2" style="padding:12px 0 0 0;font-weight:700;">Kopā</td><td style="padding:12px 0 0 0;text-align:right;font-weight:800;font-size:16px;font-variant-numeric:tabular-nums;">${total}€</td></tr></table>`;

  // Try DB template first
  const dbResult = await loadAndRender("order-seller", {
    sellerName: escapeHtml(p.sellerName),
    buyerName: escapeHtml(p.buyerName),
    orderNumber: escapeHtml(p.orderNumber),
    itemsTable,
    total,
    deliveryLabel: escapeHtml(deliveryLabel),
    deliveryDetails: deliveryDetails || "",
    siteUrl: siteUrl(),
  });
  if (dbResult) {
    return sendEmail({
      to: p.sellerEmail,
      subject: dbResult.subject,
      html: brandedEmailLayout(dbResult.html),
    });
  }

  const body = `
    <h1 style="margin:0 0 8px 0;font-size:22px;font-weight:800;">🛒 Jauns apmaksāts pasūtījums!</h1>
    <p style="margin:0 0 20px 0;color:#555;font-size:14px;line-height:1.6;">
      Sveiki, <strong>${escapeHtml(p.sellerName)}</strong>!<br>
      Pircējs <strong>${escapeHtml(p.buyerName)}</strong> ir apmaksājis pasūtījumu <strong>${escapeHtml(p.orderNumber)}</strong>.
      Lūdzu apstipriniet un sagatavojiet to nosūtīšanai.
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
    <div style="text-align:center;margin:24px 0 0 0;">
      <a href="${escapeHtml(siteUrl())}/dashboard/pasutijumi" style="display:inline-block;background:linear-gradient(90deg,#53F3A4,#AD47FF);color:#192635;padding:12px 32px;border-radius:9999px;font-weight:700;text-decoration:none;font-size:14px;">Apskatīt pasūtījumus →</a>
    </div>`;

  return sendEmail({
    to: p.sellerEmail,
    subject: `Jauns pasūtījums ${p.orderNumber} — tirgus.izipizi.lv`,
    html: brandedEmailLayout(body),
  });
}

/**
 * Send admin copy of every paid order to tirgus@izipizi.lv.
 */
export async function sendAdminOrderCopy(o: OrderEmailData): Promise<SendEmailResult> {
  const total = (o.totalCents / 100).toFixed(2);
  const deliveryLabel =
    o.deliveryType === "locker"  ? "Pakomāts" :
    o.deliveryType === "courier" ? "Kurjers" :
    o.deliveryType === "express" ? "Ekspres piegāde" :
    o.deliveryType;
  const deliveryDetails = formatDeliveryInfo(o.deliveryType, o.deliveryInfo);

  const itemsList = o.items.map((it) =>
    `${escapeHtml(it.title)} × ${it.quantity} = ${(it.price * it.quantity).toFixed(2)}€`
  ).join("<br>");

  // Try DB template first
  const dbResult = await loadAndRender("order-admin", {
    buyerName: escapeHtml(o.buyerName),
    buyerEmail: escapeHtml(o.buyerEmail),
    orderNumber: escapeHtml(o.orderNumber),
    itemsList,
    total,
    deliveryLabel: escapeHtml(deliveryLabel),
    deliveryDetails: deliveryDetails || "",
  });
  if (dbResult) {
    return sendEmail({
      to: "tirgus@izipizi.lv",
      subject: dbResult.subject,
      html: brandedEmailLayout(dbResult.html, { admin: true }),
    });
  }

  const body = `
    <h1 style="margin:0 0 8px 0;font-size:18px;font-weight:800;">Jauns pasūtījums ${escapeHtml(o.orderNumber)}</h1>
    <p style="margin:0 0 12px 0;color:#555;font-size:14px;line-height:1.6;">
      <strong>Pircējs:</strong> ${escapeHtml(o.buyerName)} (${escapeHtml(o.buyerEmail)})<br>
      <strong>Piegāde:</strong> ${escapeHtml(deliveryLabel)} ${deliveryDetails ? "— " + deliveryDetails : ""}<br>
      <strong>Summa:</strong> ${total}€
    </p>
    <p style="margin:0;color:#555;font-size:13px;line-height:1.8;">
      <strong>Preces:</strong><br>${itemsList}
    </p>`;

  return sendEmail({
    to: "tirgus@izipizi.lv",
    subject: `[Admin] Jauns pasūtījums ${o.orderNumber} · ${total}€`,
    html: brandedEmailLayout(body, { admin: true }),
  });
}

/**
 * Send all emails for a paid order: buyer confirmation, seller notification, admin copy.
 * Looks up order + seller data from DB. Used by Paysera webhook.
 */
export async function sendAllOrderEmails(orderId: string): Promise<{
  buyer: SendEmailResult;
  sellers: SendEmailResult[];
  admin: SendEmailResult;
}> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );

  const { data: order } = await supabase
    .from("orders")
    .select("order_number, buyer_name, buyer_email, items, total_cents, delivery_type, delivery_info, seller_ids")
    .eq("id", orderId)
    .single<{
      order_number: string;
      buyer_name: string | null;
      buyer_email: string | null;
      items: OrderItem[] | null;
      total_cents: number | null;
      delivery_type: string | null;
      delivery_info: Record<string, unknown> | null;
      seller_ids: string[] | null;
    }>();

  if (!order) {
    const err: SendEmailResult = { ok: false, error: "order not found" };
    return { buyer: err, sellers: [], admin: err };
  }

  const emailData: OrderEmailData = {
    orderNumber: order.order_number,
    buyerName: order.buyer_name ?? "Pircējs",
    buyerEmail: order.buyer_email ?? "",
    items: order.items ?? [],
    totalCents: order.total_cents ?? 0,
    deliveryType: order.delivery_type ?? "locker",
    deliveryInfo: order.delivery_info,
  };

  // 1. Buyer confirmation
  const buyer = order.buyer_email
    ? await sendOrderConfirmationEmail(emailData)
    : { ok: false, error: "no buyer_email" } as SendEmailResult;

  // 2. Seller emails
  const sellerResults: SendEmailResult[] = [];
  if (order.seller_ids?.length) {
    const { data: sellers } = await supabase
      .from("sellers")
      .select("id, name, email")
      .in("id", order.seller_ids);

    for (const seller of sellers ?? []) {
      if (!seller.email) continue;
      // Filter items for this seller
      const sellerItems = (order.items ?? []).filter(
        (it: OrderItem & { seller_id?: string }) => it.seller_id === seller.id
      );
      const r = await sendSellerNewOrderEmail({
        sellerEmail: seller.email,
        sellerName: seller.name ?? "Ražotāj",
        orderNumber: order.order_number,
        buyerName: order.buyer_name ?? "Pircējs",
        items: sellerItems.length > 0 ? sellerItems : (order.items ?? []),
        totalCents: order.total_cents ?? 0,
        deliveryType: order.delivery_type ?? "locker",
        deliveryInfo: order.delivery_info,
      });
      sellerResults.push(r);
    }
  }

  // 3. Admin copy
  const admin = await sendAdminOrderCopy(emailData);

  return { buyer, sellers: sellerResults, admin };
}

// ─── Invitation email ───────────────────────────────────────────────────────

export type InvitationEmailParams = {
  to: string;
  name?: string;
  invitationId: string; // for tracking pixel
};

/**
 * Send a branded platform invitation email to a potential producer.
 * Includes a tracking pixel for open detection.
 */
export async function sendInvitationEmail(p: InvitationEmailParams): Promise<SendEmailResult> {
  const site = siteUrl();
  const registerUrl = `${site}/register/razotajs?ref=invite&iid=${encodeURIComponent(p.invitationId)}`;
  const trackingPixelUrl = `${site}/api/track/open/${encodeURIComponent(p.invitationId)}`;

  const html = `<!DOCTYPE html>
<html lang="lv">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Uzaicinājums pievienoties tirgus.izipizi.lv</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f4f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#1a1a2e; line-height:1.6;">

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f4f4f7; padding:24px 0;">
  <tr>
    <td align="center">

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px; width:100%; background-color:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,0.06);">

        <!-- HEADER -->
        <tr>
          <td style="background-color:#192635; padding:36px 28px 32px; text-align:center;">

            <!-- Logo centered -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 14px;">
              <tr>
                <td style="vertical-align:middle; padding-right:10px;">
                  <img src="${escapeHtml(site)}/izipizi-logo.png" alt="IziPizi" width="72" height="72" style="display:block; width:72px; height:72px; border-radius:14px; border:0;">
                </td>
                <td style="vertical-align:middle; text-align:left;">
                  <div style="color:#ffffff; font-size:22px; font-weight:800; line-height:1.1;">tirgus.izipizi.lv</div>
                  <div style="color:#53F3A4; font-size:12px; font-weight:600; margin-top:3px;">Pārtikas ražotāju marketplace</div>
                </td>
              </tr>
            </table>

            <!-- Unified image banner strip -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
              style="border-radius:12px; overflow:hidden; border:2px solid #2d3f52; margin-bottom:14px;">
              <tr>
                <td width="34%" style="padding:0; vertical-align:middle; border-right:2px solid #2d3f52;">
                  <img src="${escapeHtml(site)}/email-slide-marketplace.png" alt="Platforma" style="display:block; width:100%; height:130px; object-fit:cover; border:0;">
                  <div style="background-color:#0f1e2d; color:#53F3A4; font-size:9px; font-weight:700; text-align:center; padding:5px 0; letter-spacing:1.5px; text-transform:uppercase;">Tirdzniecības platforma</div>
                </td>
                <td width="34%" style="padding:0; vertical-align:middle; border-right:2px solid #2d3f52;">
                  <img src="${escapeHtml(site)}/email-slide-locker.png" alt="Pakomāts" style="display:block; width:100%; height:130px; object-fit:cover; border:0;">
                  <div style="background-color:#0f1e2d; color:#AD47FF; font-size:9px; font-weight:700; text-align:center; padding:5px 0; letter-spacing:1.5px; text-transform:uppercase;">Pakomāts</div>
                </td>
                <td width="32%" style="padding:0; vertical-align:middle; background-color:#ffffff;">
                  <img src="${escapeHtml(site)}/email-slide-van.png" alt="Piegāde" style="display:block; width:100%; height:130px; object-fit:contain; border:0;">
                  <div style="background-color:#0f1e2d; color:#ffffff; font-size:9px; font-weight:700; text-align:center; padding:5px 0; letter-spacing:1.5px; text-transform:uppercase;">Piegāde</div>
                </td>
              </tr>
            </table>

            <!-- Gradient line -->
            <div style="height:3px; background:linear-gradient(90deg,#53F3A4,#AD47FF); border-radius:2px;"></div>
          </td>
        </tr>

        <!-- BODY -->
        <tr>
          <td style="padding:40px 40px 32px;">

            <h1 style="margin:0 0 24px; font-size:26px; font-weight:700; color:#1a1a2e; line-height:1.3;">
              Tu esi uzaicināts pievienoties
            </h1>

            <p style="margin:0 0 20px; font-size:16px; color:#2d2d3f;">${p.name ? `Sveiks, ${escapeHtml(p.name)}!` : "Sveiks!"}</p>

            <p style="margin:0 0 20px; font-size:16px; color:#2d2d3f;">
              <strong>Temperatūras režīma pakomāti, piegāde un tirgotāju mārketplace</strong> — šie ir rīki, ko mēs būvējam tieši priekš Tevis!
            </p>

            <p style="margin:0 0 20px; font-size:16px; color:#2d2d3f;">
              Piedāvā savu produktu <strong>tirgus.izipizi.lv</strong> — Latvijas ražotāju tirdzniecības platformā, kur svaiga pārtika no ražotāja nonāk līdz pircējam pakomātā vai mājās.
            </p>

            <p style="margin:0 0 32px; font-size:17px; color:#1a1a2e; font-weight:600;">
              Mūsu pircēji gaida Tevi! 🌱
            </p>

            <!-- DIVIDER -->
            <div style="height:1px; background:#eaeaef; margin:0 0 28px;"></div>

            <!-- PRICING SECTION -->
            <h2 style="margin:0 0 16px; font-size:18px; font-weight:700; color:#1a1a2e;">
              Godīgi un caurspīdīgi nosacījumi
            </h2>

            <p style="margin:0 0 16px; font-size:16px; color:#2d2d3f;">
              Par platformas izmantošanu mēs ieturam:
            </p>

            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 24px;">
              <tr>
                <td style="background:#f8f8fb; border-radius:12px; padding:20px 24px;">
                  <div style="margin-bottom:14px;">
                    <span style="display:inline-block; background:#1a1a2e; color:#53F3A4; font-weight:800; font-size:18px; padding:6px 16px; border-radius:20px; letter-spacing:0.5px;">15%</span>
                    <span style="color:#2d2d3f; font-size:15px; margin-left:10px;">komisija par plūsmas vadību, sūtījumu rezervēšanas sistēmu un maksājumu apkalpošanu</span>
                  </div>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 32px; font-size:15px; color:#5a5a6e; font-style:italic;">
              Reģistrācija ir bez maksas — komisijas maksa tiek ieturēta tikai pēc veiksmīga pirkuma.
            </p>

            <!-- DIVIDER -->
            <div style="height:1px; background:#eaeaef; margin:0 0 28px;"></div>

            <!-- BENEFITS -->
            <h2 style="margin:0 0 18px; font-size:18px; font-weight:700; color:#1a1a2e;">
              Ko Tu iegūsti?
            </h2>

            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 32px;">
              <tr>
                <td style="padding:8px 0; font-size:15px; color:#2d2d3f;">
                  <span style="color:#00d4aa; font-weight:700; margin-right:10px;">✓</span>
                  Pats ievieto savus produktus — ātri un vienkārši
                </td>
              </tr>
              <tr>
                <td style="padding:8px 0; font-size:15px; color:#2d2d3f;">
                  <span style="color:#00d4aa; font-weight:700; margin-right:10px;">✓</span>
                  Apskati pasūtījumus reālajā laikā
                </td>
              </tr>
              <tr>
                <td style="padding:8px 0; font-size:15px; color:#2d2d3f;">
                  <span style="color:#00d4aa; font-weight:700; margin-right:10px;">✓</span>
                  Sagatavo sūtījuma pavaddokumentus vienā klikšķī
                </td>
              </tr>
              <tr>
                <td style="padding:8px 0; font-size:15px; color:#2d2d3f;">
                  <span style="color:#00d4aa; font-weight:700; margin-right:10px;">✓</span>
                  Temperatūras režīma pakomāti — svaiga produkcija droši nonāk pie pircēja
                </td>
              </tr>
              <tr>
                <td style="padding:8px 0; font-size:15px; color:#2d2d3f;">
                  <span style="color:#00d4aa; font-weight:700; margin-right:10px;">✓</span>
                  Temperatūras režīma un ekspres piegāde
                </td>
              </tr>
            </table>

            <p style="margin:0 0 32px; font-size:16px; color:#2d2d3f; font-weight:600; text-align:center;">
              Tas viss <span style="background:linear-gradient(90deg, #00d4aa, #b14aed); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;">IziPizi</span> ar tirgus.izipizi.lv
            </p>

            <!-- CTA BUTTON -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td align="center" style="padding:8px 0 24px;">
                  <a href="${escapeHtml(registerUrl)}" style="display:inline-block; background:linear-gradient(90deg, #53F3A4, #AD47FF); color:#1a1a2e; text-decoration:none; font-size:16px; font-weight:800; padding:16px 40px; border-radius:99px; letter-spacing:0.3px;">
                    Pieņemt uzaicinājumu →
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:24px 0 8px; font-size:13px; color:#7a7a8c;">
              Vai poga nestrādā? Iekopē šo saiti pārlūkā:
            </p>
            <p style="margin:0; font-size:13px; color:#5a5a6e; word-break:break-all;">
              ${escapeHtml(registerUrl)}
            </p>

          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="background:#f8f8fb; padding:24px 40px; text-align:center; border-top:1px solid #eaeaef;">
            <p style="margin:0 0 8px; font-size:13px; color:#7a7a8c;">
              Ja šī vēstule Tev nešķiet aktuāla, vienkārši ignorē to.
            </p>
            <p style="margin:0; font-size:12px; color:#9a9aae;">
              © 2026 tirgus.izipizi.lv — Latvijas ražotāju tirgus
            </p>
          </td>
        </tr>

      </table>

    </td>
  </tr>
</table>

<!-- Tracking pixel -->
<img src="${escapeHtml(trackingPixelUrl)}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;" />
</body>
</html>`;

  return sendEmail({
    to: p.to,
    subject: "Uzaicinājums pievienoties tirgus.izipizi.lv",
    html,
  });
}

// ─── Branded layout ──────────────────────────────────────────────────────────

type BrandedLayoutOptions = {
  /** Override header subtitle text (default: none) */
  subtitle?: string;
  /** Show "Admin" badge in header */
  admin?: boolean;
};

/**
 * Wraps email body HTML in the branded izipizi layout:
 * gradient header with logo, white body, branded footer.
 */
export function brandedEmailLayout(body: string, options?: BrandedLayoutOptions): string {
  const logoUrl = `${siteUrl()}/izipizi-logo.png`;
  const adminBadge = options?.admin
    ? `<span style="display:inline-block;background:rgba(255,255,255,0.2);color:#fff;padding:2px 8px;border-radius:6px;font-size:10px;font-weight:700;letter-spacing:0.04em;margin-left:8px;vertical-align:middle;">Admin</span>`
    : "";

  return `<!doctype html>
<html lang="lv">
<head><meta charset="utf-8"><meta name="color-scheme" content="light"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f7f8;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#192635;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f8;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
        <!-- Header with gradient + logo -->
        <tr>
          <td style="background:linear-gradient(135deg,#192635 0%,#1e3048 50%,#2a1f3d 100%);padding:28px 28px 24px;text-align:center;">
            <img src="${escapeHtml(logoUrl)}" alt="izipizi.lv" width="64" height="64" style="display:block;margin:0 auto 12px;width:64px;height:64px;border-radius:16px;" />
            <p style="margin:0;font-size:18px;font-weight:800;color:#ffffff;letter-spacing:-0.01em;">tirgus.izipizi.lv${adminBadge}</p>
            ${options?.subtitle ? `<p style="margin:6px 0 0 0;font-size:13px;color:rgba(255,255,255,0.85);font-weight:400;">${escapeHtml(options.subtitle)}</p>` : ""}
            <div style="margin:16px auto 0;width:80px;height:3px;border-radius:2px;background:linear-gradient(90deg,#53F3A4,#AD47FF);"></div>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:28px;">
            ${body}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:16px 28px 24px;border-top:1px solid #f0f1f3;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="color:#888;font-size:11px;line-height:1.6;">
                  Šis ir automātisks e-pasts no <a href="${escapeHtml(siteUrl())}" style="color:#AD47FF;text-decoration:none;font-weight:600;">tirgus.izipizi.lv</a><br>
                  SIA &quot;Svaigi&quot; · Reģ. nr. 40103915568 · Margrietas iela 7, Rīga, LV-1046<br>
                  <a href="mailto:tirgus@izipizi.lv" style="color:#888;">tirgus@izipizi.lv</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
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
