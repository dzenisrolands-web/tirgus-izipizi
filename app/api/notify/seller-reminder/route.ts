import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";

/**
 * Sūta e-pasta atgādinājumu pārdevējam par trūkstošajiem profila datiem.
 * Auth: Authorization: Bearer <admin user token>
 * Body: { sellerId: string, customMessage?: string }
 */
export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify caller is admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { sellerId, customMessage } = body as { sellerId?: string; customMessage?: string };
  if (!sellerId) return NextResponse.json({ error: "Missing sellerId" }, { status: 400 });

  // Fetch seller info
  const { data: seller } = await supabase
    .from("sellers")
    .select("id, name, user_id, legal_name, registration_number, is_vat_registered, vat_number, legal_address, bank_iban, self_billing_agreed, home_locker_ids, courier_pickup_address, description")
    .eq("id", sellerId)
    .single<{
      id: string;
      name: string;
      user_id: string | null;
      legal_name: string | null;
      registration_number: string | null;
      is_vat_registered: boolean | null;
      vat_number: string | null;
      legal_address: string | null;
      bank_iban: string | null;
      self_billing_agreed: boolean | null;
      home_locker_ids: string[] | null;
      courier_pickup_address: string | null;
      description: string | null;
    }>();

  if (!seller) return NextResponse.json({ error: "Seller not found" }, { status: 404 });
  if (!seller.user_id) return NextResponse.json({ error: "Seller has no user" }, { status: 400 });

  // Get user email
  const { data: { user: sellerUser } } = await supabase.auth.admin.getUserById(seller.user_id);
  const sellerEmail = sellerUser?.email;
  if (!sellerEmail) return NextResponse.json({ error: "Seller email not found" }, { status: 404 });

  // Compute missing fields
  const missing: string[] = [];
  if (!seller.description || seller.description.length < 20) missing.push("Profila apraksts");
  if (!seller.legal_name || !seller.registration_number) missing.push("Juridiskā informācija (nosaukums + reģ. nr.)");
  if (seller.is_vat_registered && !seller.vat_number) missing.push("PVN reģistrācijas numurs");
  if (!seller.bank_iban) missing.push("Bankas konts (IBAN)");
  if (!seller.legal_address) missing.push("Juridiskā adrese");
  if (!seller.self_billing_agreed) missing.push("Self-billing piekrišana");
  const hasLocker = seller.home_locker_ids && seller.home_locker_ids.length > 0;
  const hasPickup = !!seller.courier_pickup_address?.trim();
  if (!hasLocker && !hasPickup) missing.push("Nodošanas vietas (pakomāts vai kurjera adrese)");

  if (missing.length === 0) {
    return NextResponse.json({ ok: true, message: "Nothing missing", sent: false });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tirgus.izipizi.lv";
  const itemsHtml = missing.map((m) => `<li style="padding:6px 0;border-bottom:1px solid #f0f0f0;">${escape(m)}</li>`).join("");

  const html = `<!doctype html>
<html lang="lv">
<body style="margin:0;padding:0;background:#f6f7f8;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#192635;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f8;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;">
        <tr>
          <td style="background:#192635;color:#53F3A4;padding:24px 28px;font-size:22px;font-weight:800;letter-spacing:-0.02em;">
            tirgus.izipizi.lv
          </td>
        </tr>
        <tr>
          <td style="padding:28px;">
            <h1 style="margin:0 0 12px 0;font-size:22px;font-weight:800;">Sveiks, ${escape(seller.name)}!</h1>
            <p style="margin:0 0 16px 0;color:#555;font-size:14px;line-height:1.6;">
              Lai mēs varētu apstiprināt tavu profilu un sākt nogādāt pircējiem tavus produktus,
              lūdzu, papildini sekojošo informāciju savā tirgotāja profilā:
            </p>
            ${customMessage ? `<div style="margin:0 0 16px 0;padding:12px;background:#fef3c7;border-radius:8px;color:#92400e;font-size:14px;">${escape(customMessage)}</div>` : ""}
            <ol style="margin:16px 0;padding-left:20px;color:#192635;font-size:14px;line-height:1.7;">
              ${itemsHtml}
            </ol>
            <a href="${siteUrl}/dashboard/profils" style="display:inline-block;margin-top:16px;padding:12px 24px;background:linear-gradient(90deg,#53F3A4,#AD47FF);color:#192635;text-decoration:none;font-weight:700;border-radius:9999px;">
              Aizpildīt profilu →
            </a>
            <p style="margin:24px 0 0 0;color:#888;font-size:12px;">
              Ja ir jautājumi, atbildi uz šo e-pastu vai raksti uz info@izipizi.lv.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#fafafa;padding:16px 28px;color:#888;font-size:12px;border-top:1px solid #f0f0f0;">
            SIA Svaigi · tirgus.izipizi.lv
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const result = await sendEmail({
    to: sellerEmail,
    subject: "Aizpildi trūkstošo informāciju — tirgus.izipizi.lv",
    html,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error, sent: false }, { status: 500 });
  }

  return NextResponse.json({ ok: true, sent: true, missing, emailId: result.id });
}

function escape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
