import { NextResponse } from "next/server";
import { assertSuperAdmin } from "@/lib/admin-auth";
import { invalidateCache } from "@/lib/email-templates";

/**
 * GET /api/admin/email-templates
 * List all email templates from DB.
 */
export async function GET(req: Request) {
  const ctx = await assertSuperAdmin(req);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const { data, error } = await ctx.supabase
    .from("email_templates")
    .select("id, subject, body_html, variables, updated_at")
    .order("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ templates: data ?? [] });
}

/**
 * PUT /api/admin/email-templates
 * Update a single template by ID.
 * Body: { id: string, subject: string, body_html: string }
 */
export async function PUT(req: Request) {
  const ctx = await assertSuperAdmin(req);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const { id, subject, body_html } = (await req.json().catch(() => ({}))) as {
    id?: string;
    subject?: string;
    body_html?: string;
  };

  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  if (!subject || !body_html) {
    return NextResponse.json({ error: "Missing subject or body_html" }, { status: 400 });
  }

  const { error } = await ctx.supabase
    .from("email_templates")
    .update({
      subject,
      body_html,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Invalidate in-memory cache so next email send uses the updated template
  invalidateCache(id);

  return NextResponse.json({ ok: true });
}
