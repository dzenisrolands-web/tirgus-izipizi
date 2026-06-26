import { NextResponse } from "next/server";
import { adminClient } from "@/lib/admin-auth";
import { sendInvitationEmail } from "@/lib/email";

/**
 * GET /api/cron/send-invites
 * Picks the oldest invitation with status='rinda', sends email, updates to 'sent'.
 * Called by Vercel Cron every 20 minutes, or manually.
 *
 * Security: CRON_SECRET header check (Vercel cron sends this automatically).
 * Also works without secret for manual admin testing.
 */
export async function GET(req: Request) {
  // Optional cron secret check
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`;
  const isManual = !cronSecret; // allow if no secret configured

  if (!isCron && !isManual) {
    // Also allow super admin
    const token = authHeader?.replace("Bearer ", "");
    if (token) {
      const sb = adminClient();
      const { data: { user } } = await sb.auth.getUser(token);
      if (!user || user.app_metadata?.is_super_admin !== true) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    } else {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = adminClient();

  // Pick the oldest queued invitation
  const { data: next, error: fetchErr } = await supabase
    .from("invitations")
    .select("id, email, name")
    .eq("status", "rinda")
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (fetchErr || !next) {
    return NextResponse.json({
      ok: true,
      sent: false,
      message: "Nav rindā gaidošu uzaicinājumu",
      remaining: 0,
    });
  }

  // Send the email
  const result = await sendInvitationEmail({
    to: next.email,
    name: next.name ?? undefined,
    invitationId: next.id,
  });

  if (!result.ok) {
    // Mark as failed but don't block the queue
    await supabase
      .from("invitations")
      .update({ status: "sent", notes: `Email failed: ${result.error}` })
      .eq("id", next.id);

    return NextResponse.json({
      ok: false,
      email: next.email,
      error: result.error,
    });
  }

  // Update status to 'sent' and store Resend ID
  await supabase
    .from("invitations")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
      resend_id: result.id,
    })
    .eq("id", next.id);

  // Count remaining
  const { count } = await supabase
    .from("invitations")
    .select("*", { count: "exact", head: true })
    .eq("status", "rinda");

  return NextResponse.json({
    ok: true,
    sent: true,
    email: next.email,
    name: next.name,
    remaining: count ?? 0,
  });
}
