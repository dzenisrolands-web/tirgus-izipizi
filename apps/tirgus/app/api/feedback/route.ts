import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );
}

export async function POST(req: Request) {
  try {
    const { message, email, page_url } = await req.json();

    if (!message || typeof message !== "string" || message.trim().length < 3) {
      return NextResponse.json({ error: "message too short" }, { status: 400 });
    }
    if (message.trim().length > 2000) {
      return NextResponse.json({ error: "message too long" }, { status: 400 });
    }

    const userAgent = req.headers.get("user-agent") ?? null;

    const supabase = svc();
    const { error } = await supabase.from("feedback").insert({
      message: message.trim(),
      email: email ?? null,
      page_url: page_url ?? null,
      user_agent: userAgent,
      status: "new",
    });

    if (error) {
      console.error("[feedback] insert error:", error.code, error.message);
      // Surface the error code so Vercel logs show the root cause (e.g. 42P01 = table not found)
      return NextResponse.json({ error: "db error", code: error.code }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[feedback] unexpected:", err);
    return NextResponse.json({ error: "unexpected" }, { status: 500 });
  }
}
