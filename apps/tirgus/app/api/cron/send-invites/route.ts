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
  const BATCH_SIZE = 10; // send up to 10 per cron run (daily cron on Hobby)

  // Pick oldest queued invitations
  const { data: queue, error: fetchErr } = await supabase
    .from("invitations")
    .select("id, email, name")
    .eq("status", "rinda")
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (fetchErr || !queue || queue.length === 0) {
    return NextResponse.json({
      ok: true,
      sent: 0,
      message: "Nav rind\u0101 gaido\u0161u uzaicin\u0101jumu",
      remaining: 0,
    });
  }

  const results: Array<{ email: string; ok: boolean; error?: string }> = [];

  for (const inv of queue) {
    const result = await sendInvitationEmail({
      to: inv.email,
      name: inv.name ?? undefined,
      invitationId: inv.id,
    });

    if (!result.ok) {
      await supabase
        .from("invitations")
        .update({ status: "sent", notes: `Email failed: ${result.error}` })
        .eq("id", inv.id);
      results.push({ email: inv.email, ok: false, error: result.error });
    } else {
      await supabase
        .from("invitations")
        .update({ status: "sent", sent_at: new Date().toISOString(), resend_id: result.id })
        .eq("id", inv.id);
      results.push({ email: inv.email, ok: true });
    }

    // Small delay between sends to avoid rate limits
    await new Promise(r => setTimeout(r, 2000));
  }

  const { count } = await supabase
    .from("invitations")
    .select("*", { count: "exact", head: true })
    .eq("status", "rinda");

  return NextResponse.json({
    ok: true,
    sent: results.filter(r => r.ok).length,
    failed: results.filter(r => !r.ok).length,
    results,
    remaining: count ?? 0,
  });
}
