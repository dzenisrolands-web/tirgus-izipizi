import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendInvitationEmail } from "@/lib/email";

/**
 * POST /api/admin/invite
 * Send a branded platform invitation email.
 * Auth: Authorization: Bearer <admin user token>
 * Body: { email: string, name?: string }
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
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: invitations } = await supabase
    .from("invitations")
    .select("id, email, name, sent_at, opened_at, opened_count, status")
    .order("sent_at", { ascending: false })
    .limit(100);

  return NextResponse.json({ invitations: invitations ?? [] });
}
