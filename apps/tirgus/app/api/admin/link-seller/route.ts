import { NextResponse } from "next/server";
import { assertSuperAdmin } from "@/lib/admin-auth";
import { sendEmail, brandedEmailLayout } from "@/lib/email";

/**
 * Admin-only: attach an email address to a seller row, then either link the
 * existing auth user or send a branded invite via Resend.
 *
 * Auth: Authorization: Bearer <admin user token>
 * Body: { sellerId: string, email: string }
 */
export async function POST(req: Request) {
  const ctx = await assertSuperAdmin(req);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const { supabase } = ctx;

  const { sellerId, email } = (await req.json().catch(() => ({}))) as { sellerId?: string; email?: string };
  if (!sellerId) return NextResponse.json({ error: "Missing sellerId" }, { status: 400 });
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const normalized = email.trim().toLowerCase();

  // 1. Fetch seller name for personalized email
  const { data: seller } = await supabase
    .from("sellers").select("name, farm_name").eq("id", sellerId).single();
  const sellerName = seller?.farm_name || seller?.name || "";

  // 2. Update sellers.email
  const { error: updateErr } = await supabase
    .from("sellers")
    .update({ email: normalized, updated_at: new Date().toISOString() })
    .eq("id", sellerId);
  if (updateErr) {
    return NextResponse.json({ error: `Email update failed: ${updateErr.message}` }, { status: 500 });
  }

  // 3. Check if an auth user with that email already exists
  const { data: usersList, error: listErr } = await supabase.auth.admin.listUsers({
    page: 1, perPage: 200,
  });
  if (listErr) {
    return NextResponse.json({ error: `Auth lookup failed: ${listErr.message}` }, { status: 500 });
  }
  const existing = usersList?.users.find((u) => u.email?.toLowerCase() === normalized);

  if (existing) {
    // 4a. Link directly — auth user already exists
    const { error: linkErr } = await supabase
      .from("sellers")
      .update({ user_id: existing.id, updated_at: new Date().toISOString() })
      .eq("id", sellerId);
    if (linkErr) {
      return NextResponse.json({ error: `Link failed: ${linkErr.message}` }, { status: 500 });
    }
    return NextResponse.json({ ok: true, linked: true, mode: "existing-user" });
  }

  // 4b. No auth user yet → send branded invite via Resend (not Supabase Auth)
  // The seller registers via tirgus.izipizi.lv/register/razotajs, and
  // migration 0022 trigger links the seller row on first login.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tirgus.izipizi.lv";
  const registerUrl = `${siteUrl}/register/razotajs?email=${encodeURIComponent(normalized)}`;

  const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const body = `
    <h1 style="margin:0 0 16px;font-size:24px;font-weight:800;">Sveiks${sellerName ? `, ${escapeHtml(sellerName)}` : ""}!</h1>
    <p style="margin:0 0 16px;font-size:16px;color:#555;line-height:1.6;">
      Tavs ražotāja profils <strong>tirgus.izipizi.lv</strong> gaida tevi.
      Reģistrējies un sāc pārdot savus produktus Latvijas pircējiem.
    </p>
    <p style="margin:0 0 16px;font-size:15px;color:#555;line-height:1.6;">
      Mēs jau esam sagatavojuši tavu profilu — tev tikai jāizveido konts
      un jāpapildina informācija.
    </p>
    <div style="margin:24px 0;text-align:center;">
      <a href="${escapeHtml(registerUrl)}" style="display:inline-block;background:linear-gradient(90deg,#53F3A4,#AD47FF);color:#192635;padding:14px 36px;border-radius:9999px;font-weight:700;text-decoration:none;font-size:15px;">
        Reģistrēties un sākt pārdot →
      </a>
    </div>
    <p style="margin:24px 0 0;font-size:13px;color:#888;line-height:1.6;">
      Pēc reģistrācijas tavs ražotāja profils tiks automātiski piesaistīts tavam kontam.
      Ja ir jautājumi — raksti uz <a href="mailto:tirgus@izipizi.lv" style="color:#AD47FF;">tirgus@izipizi.lv</a>
    </p>`;

  const result = await sendEmail({
    to: normalized,
    subject: `${sellerName ? sellerName + " — " : ""}Uzaicinājums pievienoties tirgus.izipizi.lv`,
    html: brandedEmailLayout(body),
  });

  if (!result.ok) {
    return NextResponse.json({ error: `Email failed: ${result.error}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, linked: false, mode: "invited", emailId: result.ok ? (result as { id: string }).id : null });
}
