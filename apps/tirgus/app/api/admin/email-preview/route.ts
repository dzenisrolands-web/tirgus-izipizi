import { NextResponse } from "next/server";
import { assertSuperAdmin } from "@/lib/admin-auth";
import {
  brandedEmailLayout,
  sendEmail,
} from "@/lib/email";

// Sample data for template previews
const SAMPLE_ORDER = {
  orderNumber: "TRG-20260606-1234",
  buyerName: "Jānis Bērziņš",
  buyerEmail: "janis@example.com",
  items: [
    { title: "Pelmeņi vegānie (400g)", quantity: 2, price: 4.0, unit: "gab." },
    { title: "Brieža steiks Fileja (500g)", quantity: 1, price: 27.5, unit: "gab." },
    { title: "Paipalu olas (30 gab.)", quantity: 1, price: 5.5, unit: "gab." },
  ],
  totalCents: 4100,
  deliveryType: "locker",
  deliveryLabel: "Pakomāts",
  deliveryDetails: "Brīvības iela 253, NESTE, Rīga",
};

const SAMPLE_MISSING = [
  "Juridiskā informācija (nosaukums + reģ. nr.)",
  "Bankas konts (IBAN)",
  "Self-billing piekrišana",
];

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://tirgus.izipizi.lv";
}

function generatePreview(templateId: string): string {
  const site = siteUrl();
  const o = SAMPLE_ORDER;
  const total = (o.totalCents / 100).toFixed(2);

  const itemsRows = o.items.map((it) => {
    const lineTotal = (it.price * it.quantity).toFixed(2);
    return `<tr>
      <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;">${escapeHtml(it.title)}</td>
      <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;text-align:right;color:#555;">${it.quantity} ${escapeHtml(it.unit ?? "")}</td>
      <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;text-align:right;font-variant-numeric:tabular-nums;">${lineTotal}€</td>
    </tr>`;
  }).join("");

  switch (templateId) {
    case "order-buyer":
      return brandedEmailLayout(`
        <h1 style="margin:0 0 8px 0;font-size:22px;font-weight:800;">Paldies par pasūtījumu, ${escapeHtml(o.buyerName)}!</h1>
        <p style="margin:0 0 20px 0;color:#555;font-size:14px;line-height:1.6;">
          Pasūtījums <strong>${escapeHtml(o.orderNumber)}</strong> ir saņemts un apmaksāts.
          Drīzumā saņemsi paziņojumu, kad ražotājs to apstiprinās un sagatavos.
        </p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;font-size:14px;">
          ${itemsRows}
          <tr>
            <td colspan="2" style="padding:12px 0 0 0;font-weight:700;">Kopā</td>
            <td style="padding:12px 0 0 0;text-align:right;font-weight:800;font-size:16px;">${total}€</td>
          </tr>
        </table>
        <div style="background:#f6f7f8;border-radius:12px;padding:16px;margin:16px 0;">
          <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#888;margin-bottom:6px;">Piegāde</div>
          <div style="font-weight:600;">${escapeHtml(o.deliveryLabel)}</div>
          <div style="margin-top:4px;color:#555;font-size:13px;">${escapeHtml(o.deliveryDetails)}</div>
        </div>
        <p style="margin:24px 0 0 0;color:#555;font-size:13px;line-height:1.6;">
          Statusu vari sekot <a href="${site}/profils/pasutijumi" style="color:#AD47FF;font-weight:600;">savā pasūtījumu sadaļā</a>.
        </p>`);

    case "order-seller":
      return brandedEmailLayout(`
        <h1 style="margin:0 0 8px 0;font-size:22px;font-weight:800;">🛒 Jauns apmaksāts pasūtījums!</h1>
        <p style="margin:0 0 20px 0;color:#555;font-size:14px;line-height:1.6;">
          Sveiki, <strong>Bujums</strong>!<br>
          Pircējs <strong>${escapeHtml(o.buyerName)}</strong> ir apmaksājis pasūtījumu <strong>${escapeHtml(o.orderNumber)}</strong>.
          Lūdzu apstipriniet un sagatavojiet to nosūtīšanai.
        </p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;font-size:14px;">
          ${itemsRows}
          <tr>
            <td colspan="2" style="padding:12px 0 0 0;font-weight:700;">Kopā</td>
            <td style="padding:12px 0 0 0;text-align:right;font-weight:800;font-size:16px;">${total}€</td>
          </tr>
        </table>
        <div style="background:#f6f7f8;border-radius:12px;padding:16px;margin:16px 0;">
          <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#888;margin-bottom:6px;">Piegāde</div>
          <div style="font-weight:600;">${escapeHtml(o.deliveryLabel)}</div>
          <div style="margin-top:4px;color:#555;font-size:13px;">${escapeHtml(o.deliveryDetails)}</div>
        </div>
        <div style="text-align:center;margin:24px 0 0 0;">
          <a href="${site}/dashboard/pasutijumi" style="display:inline-block;background:linear-gradient(90deg,#53F3A4,#AD47FF);color:#192635;padding:12px 32px;border-radius:9999px;font-weight:700;text-decoration:none;font-size:14px;">Apskatīt pasūtījumus →</a>
        </div>`);

    case "order-admin":
      return brandedEmailLayout(`
        <h1 style="margin:0 0 8px 0;font-size:18px;font-weight:800;">Jauns pasūtījums ${escapeHtml(o.orderNumber)}</h1>
        <p style="margin:0 0 12px 0;color:#555;font-size:14px;line-height:1.6;">
          <strong>Pircējs:</strong> ${escapeHtml(o.buyerName)} (${escapeHtml(o.buyerEmail)})<br>
          <strong>Piegāde:</strong> ${escapeHtml(o.deliveryLabel)} — ${escapeHtml(o.deliveryDetails)}<br>
          <strong>Summa:</strong> ${total}€
        </p>
        <p style="margin:0;color:#555;font-size:13px;line-height:1.8;">
          <strong>Preces:</strong><br>${o.items.map(it => `${escapeHtml(it.title)} × ${it.quantity} = ${(it.price * it.quantity).toFixed(2)}€`).join("<br>")}
        </p>`, { admin: true });

    case "seller-reminder": {
      const itemsHtml = SAMPLE_MISSING.map(m => `<li style="padding:6px 0;border-bottom:1px solid #f0f0f0;">${escapeHtml(m)}</li>`).join("");
      return brandedEmailLayout(`
        <h1 style="margin:0 0 12px 0;font-size:22px;font-weight:800;">Sveiks, Antra Bukava!</h1>
        <p style="margin:0 0 16px 0;color:#555;font-size:14px;line-height:1.6;">
          Lai mēs varētu apstiprināt tavu profilu un sākt nogādāt pircējiem tavus produktus,
          lūdzu, papildini sekojošo informāciju savā tirgotāja profilā:
        </p>
        <ol style="margin:16px 0;padding-left:20px;color:#192635;font-size:14px;line-height:1.7;">
          ${itemsHtml}
        </ol>
        <div style="text-align:center;margin:24px 0 0 0;">
          <a href="${site}/dashboard/profils" style="display:inline-block;padding:12px 24px;background:linear-gradient(90deg,#53F3A4,#AD47FF);color:#192635;text-decoration:none;font-weight:700;border-radius:9999px;">
            Aizpildīt profilu →
          </a>
        </div>
        <p style="margin:24px 0 0 0;color:#888;font-size:12px;">
          Ja ir jautājumi, atbildi uz šo e-pastu vai raksti uz info@izipizi.lv.
        </p>`);
    }

    case "invitation":
      // The invitation template is self-contained (not using brandedEmailLayout)
      // Return a simplified version for preview
      return brandedEmailLayout(`
        <h1 style="margin:0 0 24px;font-size:26px;font-weight:700;">Tu esi uzaicināts pievienoties</h1>
        <p style="margin:0 0 20px;font-size:16px;">Sveiks, Jānis!</p>
        <p style="margin:0 0 20px;font-size:16px;">
          <strong>Temperatūras režīma pakomāti, piegāde un tirgotāju mārketplace</strong> — šie ir rīki, ko mēs būvējam tieši priekš Tevis!
        </p>
        <p style="margin:0 0 20px;font-size:16px;">
          Piedāvā savu produktu <strong>tirgus.izipizi.lv</strong> — Latvijas ražotāju tirdzniecības platformā.
        </p>
        <div style="background:#f8f8fb;border-radius:12px;padding:20px 24px;margin:24px 0;">
          <span style="display:inline-block;background:#1a1a2e;color:#53F3A4;font-weight:800;font-size:18px;padding:6px 16px;border-radius:20px;">15%</span>
          <span style="color:#2d2d3f;font-size:15px;margin-left:10px;">komisija par plūsmas vadību un maksājumu apkalpošanu</span>
        </div>
        <p style="margin:0 0 24px;font-size:15px;color:#5a5a6e;font-style:italic;">
          Reģistrācija ir bez maksas — komisijas maksa tiek ieturēta tikai pēc veiksmīga pirkuma.
        </p>
        <div style="margin:16px 0;font-size:15px;color:#2d2d3f;">
          <p>✓ Pats ievieto savus produktus — ātri un vienkārši</p>
          <p>✓ Apskati pasūtījumus reālajā laikā</p>
          <p>✓ Temperatūras režīma pakomāti</p>
          <p>✓ Temperatūras režīma un ekspres piegāde</p>
        </div>
        <div style="text-align:center;margin:32px 0;">
          <a href="${site}/register/razotajs" style="display:inline-block;background:linear-gradient(90deg,#53F3A4,#AD47FF);color:#1a1a2e;padding:16px 40px;border-radius:99px;font-weight:800;text-decoration:none;font-size:16px;">
            Pieņemt uzaicinājumu →
          </a>
        </div>`);

    case "order-processing":
      return brandedEmailLayout(`
        <h1 style="margin:0 0 8px 0;font-size:22px;font-weight:800;">👨‍🍳 Tavs pasūtījums tiek gatavots!</h1>
        <p style="margin:0 0 20px 0;color:#555;font-size:14px;line-height:1.6;">
          Sveiks, <strong>${escapeHtml(o.buyerName)}</strong>!<br>
          Ražotājs ir apstiprinājis pasūtījumu <strong>${escapeHtml(o.orderNumber)}</strong> un sāk to sagatavot.
        </p>
        <div style="background:#f0f7ff;border-radius:12px;padding:16px;margin:16px 0;border-left:4px solid #3b82f6;">
          <p style="margin:0;font-size:14px;color:#1e40af;font-weight:600;">Statuss: Apstrādē</p>
          <p style="margin:4px 0 0;font-size:13px;color:#555;">Ražotājs gatavo tavu pasūtījumu nosūtīšanai.</p>
        </div>
        <div style="text-align:center;margin:24px 0;">
          <a href="${site}/profils/pasutijumi" style="display:inline-block;background:linear-gradient(90deg,#53F3A4,#AD47FF);color:#192635;padding:12px 32px;border-radius:9999px;font-weight:700;text-decoration:none;font-size:14px;">Skatīt pasūtījumu →</a>
        </div>`);

    case "order-shipped":
      return brandedEmailLayout(`
        <h1 style="margin:0 0 8px 0;font-size:22px;font-weight:800;">📦 Tavs pasūtījums gaida tevi!</h1>
        <p style="margin:0 0 20px 0;color:#555;font-size:14px;line-height:1.6;">
          Sveiks, <strong>${escapeHtml(o.buyerName)}</strong>!<br>
          Pasūtījums <strong>${escapeHtml(o.orderNumber)}</strong> ir ievietots pakomātā un gatavs saņemšanai.
        </p>
        <div style="background:#f0fdf4;border-radius:12px;padding:16px;margin:16px 0;border-left:4px solid #22c55e;">
          <p style="margin:0;font-size:14px;color:#166534;font-weight:600;">${escapeHtml(o.deliveryLabel)}</p>
          <p style="margin:4px 0 0;font-size:13px;color:#555;">${escapeHtml(o.deliveryDetails)}</p>
          <p style="margin:8px 0 0;font-size:20px;font-weight:800;color:#166534;letter-spacing:2px;">PIN: 4827</p>
        </div>
        <div style="text-align:center;margin:24px 0;">
          <a href="${site}/profils/pasutijumi" style="display:inline-block;background:linear-gradient(90deg,#53F3A4,#AD47FF);color:#192635;padding:12px 32px;border-radius:9999px;font-weight:700;text-decoration:none;font-size:14px;">Skatīt pasūtījumu →</a>
        </div>`);

    case "order-delivered":
      return brandedEmailLayout(`
        <h1 style="margin:0 0 8px 0;font-size:22px;font-weight:800;">✅ Pasūtījums saņemts!</h1>
        <p style="margin:0 0 20px 0;color:#555;font-size:14px;line-height:1.6;">
          Sveiks, <strong>${escapeHtml(o.buyerName)}</strong>!<br>
          Pasūtījums <strong>${escapeHtml(o.orderNumber)}</strong> ir veiksmīgi saņemts. Paldies, ka ieprrcies no vietējiem ražotājiem!
        </p>
        <div style="background:#fefce8;border-radius:12px;padding:16px;margin:16px 0;border-left:4px solid #eab308;">
          <p style="margin:0;font-size:14px;color:#854d0e;font-weight:600;">⭐ Kā Tev patika?</p>
          <p style="margin:4px 0 0;font-size:13px;color:#555;">Atstāj atsauksmi — palīdzi citiem pircējiem izvēlēties!</p>
        </div>
        <div style="text-align:center;margin:24px 0;">
          <a href="${site}/profils/pasutijumi" style="display:inline-block;background:linear-gradient(90deg,#53F3A4,#AD47FF);color:#192635;padding:12px 32px;border-radius:9999px;font-weight:700;text-decoration:none;font-size:14px;">Atstāt atsauksmi →</a>
        </div>`);

    default:
      return "<p>Nezināms šablons</p>";
  }
}

/**
 * GET /api/admin/email-preview?template=order-buyer
 * Returns rendered HTML preview with sample data.
 */
export async function GET(req: Request) {
  const ctx = await assertSuperAdmin(req);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const url = new URL(req.url);
  const template = url.searchParams.get("template") ?? "";
  const html = generatePreview(template);

  return NextResponse.json({ html });
}

/**
 * POST /api/admin/email-preview
 * Send a test email with sample data.
 * Body: { template: string, to: string }
 */
export async function POST(req: Request) {
  const ctx = await assertSuperAdmin(req);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const { template, to } = (await req.json().catch(() => ({}))) as { template?: string; to?: string };
  if (!template || !to || !to.includes("@")) {
    return NextResponse.json({ error: "Missing template or valid email" }, { status: 400 });
  }

  const html = generatePreview(template);
  const subjectMap: Record<string, string> = {
    "order-buyer": "[TEST] Pasūtījums apmaksāts",
    "order-seller": "[TEST] Jauns pasūtījums",
    "order-admin": "[TEST] Admin kopija",
    "order-processing": "[TEST] Ražotājs apstiprināja",
    "order-shipped": "[TEST] Pasūtījums gatavs saņemšanai",
    "order-delivered": "[TEST] Pasūtījums saņemts",
    "seller-reminder": "[TEST] Aizpildi trūkstošo info",
    "invitation": "[TEST] Uzaicinājums pievienoties",
  };

  const result = await sendEmail({
    to,
    subject: subjectMap[template] ?? `[TEST] ${template}`,
    html,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, emailId: result.id });
}
