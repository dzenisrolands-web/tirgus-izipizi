import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/track/click/[iid]
 * Marks invitation as clicked (first click only).
 * Called from the seller registration page when ?iid= is present.
 * Uses service role — no auth needed (fire-and-forget from client).
 */
export async function GET(
  _req: Request,
  { params }: { params: { iid: string } }
) {
  const iid = params.iid;
  if (!iid) return NextResponse.json({ ok: false }, { status: 400 });

  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!
    );

    // Only set clicked_at if not already set (first click)
    await sb
      .from("invitations")
      .update({ clicked_at: new Date().toISOString() })
      .eq("id", iid)
      .is("clicked_at", null);
  } catch (e) {
    console.error("Track click error:", e);
  }

  // Always return success (non-blocking tracking)
  return NextResponse.json({ ok: true });
}
