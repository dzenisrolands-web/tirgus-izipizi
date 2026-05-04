import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";

/**
 * Admin-only: send a test email to the supplied address using the live Resend
 * config so we can verify domain verification + DNS propagation worked
 * without firing real seller/order emails.
 *
 * Auth: Authorization: Bearer <admin user token>
 * Body: { to: string }
 * Response: { ok, env: { resendKey, emailFrom, emailReplyTo, siteUrl }, sent?, error? }
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

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { to } = (await req.json().catch(() => ({}))) as { to?: string };
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return NextResponse.json({ error: "Invalid recipient email" }, { status: 400 });
  }

  // Surface env status so admin can see at a glance what's missing
  const env = {
    resendKey: !!process.env.RESEND_API_KEY,
    emailFrom: process.env.EMAIL_FROM ?? null,
    emailReplyTo: process.env.EMAIL_REPLY_TO ?? null,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? null,
  };

  if (!env.resendKey || !env.emailFrom) {
    return NextResponse.json({
      ok: false,
      env,
      error: "RESEND_API_KEY or EMAIL_FROM is not configured on Vercel.",
    }, { status: 500 });
  }

  const html = `<!doctype html>
<html lang="lv"><body style="margin:0;padding:32px 16px;background:#f6f7f8;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#192635;">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;">
  <div style="background:#192635;color:#53F3A4;padding:24px 28px;font-size:22px;font-weight:800;">tirgus.izipizi.lv</div>
  <div style="padding:28px;">
    <h1 style="margin:0 0 12px 0;font-size:20px;">Resend test e-pasts ✓</h1>
    <p style="margin:0 0 12px 0;font-size:14px;line-height:1.6;color:#555;">
      Šis e-pasts apstiprina, ka Resend integrācija strādā. Domēns ir verificēts un DNS ieraksti ir aktīvi.
    </p>
    <ul style="margin:16px 0;padding:12px 16px 12px 32px;background:#f6f7f8;border-radius:8px;font-size:13px;color:#192635;">
      <li>From: ${escape(env.emailFrom ?? "")}</li>
      <li>Reply-To: ${escape(env.emailReplyTo ?? "(nav)")}</li>
      <li>Site: ${escape(env.siteUrl ?? "(nav)")}</li>
      <li>Laiks: ${new Date().toISOString()}</li>
    </ul>
    <p style="margin:0;font-size:12px;color:#888;">
      Ja saņēmi šo, droši vari pieslēgt Supabase Auth SMTP uz to pašu Resend kontu,
      lai magic-link e-pasti arī iet caur verificēto domēnu.
    </p>
  </div>
</div>
</body></html>`;

  const result = await sendEmail({
    to,
    subject: "[tirgus.izipizi.lv] Resend test",
    html,
  });

  return NextResponse.json({
    ok: result.ok,
    env,
    sent: result.ok ? { id: result.id } : undefined,
    error: result.ok ? undefined : result.error,
  });
}

function escape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
