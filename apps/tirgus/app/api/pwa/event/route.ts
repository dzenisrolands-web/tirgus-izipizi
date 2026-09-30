import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const VALID_TYPES = new Set([
  "prompt_shown",
  "prompt_accepted",
  "prompt_dismissed",
  "standalone_visit",
]);

function summarizeUA(raw: string | null): string {
  if (!raw) return "unknown";
  const ua = raw.toLowerCase();
  const os =
    /iphone|ipad|ipod/.test(ua) ? "iOS" :
    ua.includes("android") ? "Android" :
    ua.includes("mac os") ? "macOS" :
    ua.includes("windows") ? "Windows" :
    ua.includes("linux") ? "Linux" : "Other";
  const browser =
    ua.includes("edg/") ? "Edge" :
    ua.includes("chrome") && !ua.includes("edg/") ? "Chrome" :
    ua.includes("firefox") ? "Firefox" :
    ua.includes("safari") && !ua.includes("chrome") ? "Safari" : "Other";
  return `${browser}/${os}`;
}

export async function POST(req: Request) {
  let body: { type?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
  const type = body.type;
  if (!type || !VALID_TYPES.has(type)) {
    return NextResponse.json({ ok: false, error: "invalid type" }, { status: 400 });
  }
  const ua = summarizeUA(req.headers.get("user-agent"));
  const { error } = await supabase.from("pwa_events").insert({ event_type: type, ua_summary: ua });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
