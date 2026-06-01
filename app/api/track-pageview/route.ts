import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/track-pageview
 * Lightweight page view tracker. Fire-and-forget from client.
 */
export async function POST(req: Request) {
  try {
    const { path, referrer } = (await req.json()) as {
      path?: string;
      referrer?: string;
    };
    if (!path) return NextResponse.json({ ok: false }, { status: 400 });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!,
    );

    await supabase.from("page_views").insert({
      path,
      referrer: referrer || null,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
