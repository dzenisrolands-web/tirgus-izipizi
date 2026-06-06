import { NextRequest, NextResponse } from "next/server";

/**
 * Paysera redirect intermediary.
 * Uses a server-side 302 redirect so the browser follows the HTTP redirect
 * chain and sends Referer: tirgus.izipizi.lv to Paysera.
 *
 * This fixes Paysera 0x13 error in PWA standalone mode where client-side
 * redirects (meta-refresh, JS, anchor click, form submit) all fail because
 * Chrome Custom Tab strips the Referer on cross-origin navigations.
 *
 * A 302 HTTP redirect is different — the browser treats the entire chain
 * as a single navigation and propagates the Referer from the originating page.
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");

  // Safety: only allow redirects to Paysera
  if (!url || !url.startsWith("https://www.paysera.com/")) {
    return NextResponse.redirect(new URL("/cart", req.url));
  }

  return new NextResponse(null, {
    status: 302,
    headers: {
      Location: url,
      "Referrer-Policy": "unsafe-url",
      "Cache-Control": "no-store",
    },
  });
}
