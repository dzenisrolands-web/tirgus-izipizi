import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/** Legacy drop reservations lack a verified atomic order/settlement contract. */
export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
  const { data: { user }, error } = await sb.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // No stock reads, reservations, order writes or payment URLs until supported.
  return NextResponse.json({
    error: "Karsto piedāvājumu apmaksa pagaidām nav pieejama.",
  }, { status: 410 });
}
