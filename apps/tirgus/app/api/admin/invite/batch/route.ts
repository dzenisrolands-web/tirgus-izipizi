import { NextResponse } from "next/server";
import { assertSuperAdmin } from "@/lib/admin-auth";

/**
 * POST /api/admin/invite/batch
 * Body: { contacts: [{ email, name }] }
 * Inserts into invitations with status='rinda' (queued for auto-send).
 * Skips duplicates (same email already in invitations).
 */
export async function POST(req: Request) {
  const ctx = await assertSuperAdmin(req);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const { supabase, user } = ctx;

  const body = await req.json().catch(() => ({}));
  const contacts = body.contacts as Array<{ email: string; name?: string }> | undefined;

  if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
    return NextResponse.json({ error: "Missing contacts array" }, { status: 400 });
  }

  // Get existing emails to skip duplicates
  const { data: existing } = await supabase
    .from("invitations")
    .select("email")
    .in("email", contacts.map(c => c.email.toLowerCase()));

  const existingEmails = new Set((existing ?? []).map((e: { email: string }) => e.email.toLowerCase()));

  const toInsert = contacts
    .filter(c => c.email && !existingEmails.has(c.email.toLowerCase()))
    .map(c => ({
      email: c.email.toLowerCase().trim(),
      name: c.name?.trim() || null,
      status: "rinda",
      sent_by: user.id,
    }));

  if (toInsert.length === 0) {
    return NextResponse.json({
      ok: true,
      imported: 0,
      skipped: contacts.length,
      message: "Visi kontakti jau eksistē",
    });
  }

  const { error } = await supabase
    .from("invitations")
    .insert(toInsert);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    imported: toInsert.length,
    skipped: contacts.length - toInsert.length,
  });
}
