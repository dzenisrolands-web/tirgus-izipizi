import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/admin/invite/track-register
 * Body: { email, invitationId }
 * Marks the invitation as registered (no auth needed — fire-and-forget from client).
 */
export async function POST(req: Request) {
  try {
    const { email, invitationId } = await req.json();
    if (!email && !invitationId) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!
    );

    const now = new Date().toISOString();

    if (invitationId) {
      // Update by invitation ID (most precise)
      await sb
        .from("invitations")
        .update({ registered_at: now, status: "registered" })
        .eq("id", invitationId)
        .is("registered_at", null);
    } else if (email) {
      // Fallback: update most recent invitation for this email
      const { data } = await sb
        .from("invitations")
        .select("id")
        .eq("email", email.toLowerCase())
        .is("registered_at", null)
        .order("sent_at", { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        await sb
          .from("invitations")
          .update({ registered_at: now, status: "registered" })
          .eq("id", data[0].id);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Track register error:", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
