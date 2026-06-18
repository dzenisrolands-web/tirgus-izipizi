import { NextResponse } from "next/server";
import { sendInvitationEmail } from "@/lib/email";
import { assertSuperAdmin } from "@/lib/admin-auth";

/**
 * POST /api/admin/invite
 * Send a branded platform invitation email.
 * Auth: Authorization: Bearer <admin user token>
 * Body: { email: string, name?: string }
 */
export async function POST(req: Request) {
  const ctx = await assertSuperAdmin(req);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const { supabase, user } = ctx;

  const body = await req.json().catch(() => ({}));
  const { email, name } = body as { email?: string; name?: string };

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  // Check if already invited recently (within 24h)
  const { data: recent } = await supabase
    .from("invitations")
    .select("id, sent_at")
    .eq("email", email.toLowerCase())
    .gte("sent_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .limit(1);

  if (recent && recent.length > 0) {
    return NextResponse.json({
      error: `Uzaicinājums uz ${email} jau nosūtīts pēdējo 24h laikā`,
    }, { status: 409 });
  }

  // Create invitation record
  const { data: invitation, error: insertErr } = await supabase
    .from("invitations")
    .insert({
      email: email.toLowerCase(),
      name: name?.trim() || null,
      sent_by: user.id,
    })
    .select("id")
    .single();

  if (insertErr || !invitation) {
    return NextResponse.json({
      error: insertErr?.message ?? "Failed to create invitation",
    }, { status: 500 });
  }

  // Send the email
  const result = await sendInvitationEmail({
    to: email,
    name: name?.trim(),
    invitationId: invitation.id,
  });

  if (!result.ok) {
    // Clean up the invitation record if email failed
    await supabase.from("invitations").delete().eq("id", invitation.id);
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  // Store resend email ID
  await supabase
    .from("invitations")
    .update({ resend_id: result.id })
    .eq("id", invitation.id);

  return NextResponse.json({
    ok: true,
    invitationId: invitation.id,
    resendId: result.id,
  });
}

/**
 * GET /api/admin/invite
 * List all invitations for the admin panel.
 */
export async function GET(req: Request) {
  const ctx = await assertSuperAdmin(req);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const { supabase } = ctx;

  const { data: invitations } = await supabase
    .from("invitations")
    .select("id, email, name, sent_at, opened_at, opened_count, clicked_at, registered_at, status")
    .order("sent_at", { ascending: false })
    .limit(100);

  return NextResponse.json({ invitations: invitations ?? [] });
}
