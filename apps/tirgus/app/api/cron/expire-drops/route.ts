import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Called by Vercel Cron every 5 minutes.
// Protected by CRON_SECRET so only Vercel (or you) can trigger it.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Use service-role key so RLS doesn't block the update
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );

  const { error } = await supabase.rpc("expire_stale_data");

  if (error) {
    console.error("[cron/expire-drops]", error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, ran_at: new Date().toISOString() });
}
