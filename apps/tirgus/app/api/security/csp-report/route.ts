import { NextResponse } from "next/server";

const directives = new Set(["default-src", "script-src", "script-src-elem", "script-src-attr",
  "style-src", "style-src-elem", "style-src-attr", "img-src", "connect-src", "font-src",
  "frame-src", "frame-ancestors", "form-action", "base-uri", "object-src"]);
const recent = new Map<string, number>();
const headers = { "Cache-Control": "no-store" };
export async function POST(req: Request) {
  if (Number(req.headers.get("content-length")) > 16384) return new NextResponse(null, { status: 413, headers });
  const reader = req.body?.getReader();
  if (!reader) return new NextResponse(null, { status: 400, headers });
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 16384) { await reader.cancel(); return new NextResponse(null, { status: 413, headers }); }
      chunks.push(value);
    }
    const value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)))?.["csp-report"];
    const directive = value?.["effective-directive"];
    if (typeof directive !== "string" || !directives.has(directive)) return new NextResponse(null, { status: 400, headers });
    const blocked = value?.["blocked-uri"];
    const kind = blocked === "inline" || blocked === "eval" || blocked === "self" ? blocked
      : typeof blocked === "string" && blocked.startsWith("https:") ? "https" : "other";
    const key = `${directive}:${kind}`, now = Date.now();
    // Fixed vocabulary + capped map, no report URLs, cookies, addresses,
    // tokens, script samples or request bodies are logged or persisted.
    if ((recent.get(key) ?? 0) < now - 60000) {
      if (recent.size >= 64) recent.clear();
      recent.set(key, now);
      console.warn("[csp-report-only]", { directive, kind });
    }
    return new NextResponse(null, { status: 204, headers });
  } catch {
    return new NextResponse(null, { status: 400, headers });
  } finally { reader.releaseLock(); }
}
