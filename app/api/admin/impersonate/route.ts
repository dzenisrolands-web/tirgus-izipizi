import { NextResponse } from "next/server";
import { assertSuperAdmin } from "@/lib/admin-auth";

/**
 * Admin-only: generate a magic-link URL that lets the super_admin sign in
 * as a different user (impersonation).
 *
 * Auth: Authorization: Bearer <admin user token>
 * Body: { email: string }
 * Response: { ok: true, url: string }
 *
 * The returned URL is a one-time link. The admin opens it in an
 * incognito/private window to act as the target user.
 */
export async function POST(req: Request) {
  const ctx = await assertSuperAdmin(req);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const { supabase } = ctx;

  const { email } = (await req.json().catch(() => ({}))) as { email?: string };
  if (!email) return NextResponse.json({ error: "Missing email" }, { status: 400 });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tirgus.izipizi.lv";

  const { data, error } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${siteUrl}/auth/callback?next=/dashboard` },
  });

  if (error || !data?.properties?.action_link) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to generate link" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, url: data.properties.action_link });
}
