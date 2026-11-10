import { NextResponse } from "next/server";
import { adminClient, assertSuperAdmin } from "@/lib/admin-auth";
import { sendInvitationEmail } from "@/lib/email";

/**
 * GET /api/cron/send-invites
 * Picks the oldest invitation with status='rinda', sends email, updates to 'sent'.
 * Called by Vercel Cron every 20 minutes, or manually.
 *
 * Security: CRON_SECRET header check (Vercel cron sends this automatically).
 * Manual runs require verified super-admin authentication.
 */
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const isCron = !!cronSecret && req.headers.get("authorization") === `Bearer ${cronSecret}`;
  if (!isCron) {
    const auth = await assertSuperAdmin(req);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
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

  if (fetchErr) return NextResponse.json({ ok: false, error: "Invitation query failed" }, { status: 500 });
  if (!queue || queue.length === 0) {
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
      const { data: changed, error } = await supabase
        .from("invitations")
        .update({ status: "sent", notes: `Email failed: ${result.error}` })
        .eq("id", inv.id).select("id").maybeSingle();
      if (error || !changed) return NextResponse.json({ ok: false, error: "Invitation update failed" }, { status: 500 });
      results.push({ email: inv.email, ok: false, error: result.error });
    } else {
      const { data: changed, error } = await supabase
        .from("invitations")
        .update({ status: "sent", sent_at: new Date().toISOString(), resend_id: result.id })
        .eq("id", inv.id).select("id").maybeSingle();
      if (error || !changed) return NextResponse.json({ ok: false, error: "Invitation update failed" }, { status: 500 });
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
