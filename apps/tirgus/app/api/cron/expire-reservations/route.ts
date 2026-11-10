import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
  const { data, error } = await sb.rpc("expire_marketplace_reservations");
  if (error) return NextResponse.json({ error: "Reservation expiry failed" }, { status: 503 });
  return NextResponse.json({ ok: true, expired: data });
}
