import { NextRequest, NextResponse } from "next/server";

/**
 * Paysera redirect intermediary.
 * Browser visits /pay?url=... (on our domain tirgus.izipizi.lv),
 * then meta-refresh sends browser to Paysera with correct Referer header.
 * This fixes Paysera 0x13 error in Edge PWA standalone mode.
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");

  // Safety: only allow redirects to Paysera
  if (!url || !url.startsWith("https://www.paysera.com/")) {
    return NextResponse.redirect(new URL("/cart", req.url));
  }

  const escaped = url.replace(/"/g, "&quot;");

  return new NextResponse(
    `<!DOCTYPE html>
<html lang="lv">
<head>
<meta charset="utf-8">
<meta name="referrer" content="unsafe-url">
<meta http-equiv="refresh" content="0;url=${escaped}">
<title>Notiek novirzīšana uz Paysera...</title>
</head>
<body>
<p style="font-family:sans-serif;text-align:center;margin-top:4rem;color:#555">
  Notiek novirzīšana uz drošo maksājumu lapu...
</p>
</body>
</html>`,
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Referrer-Policy": "unsafe-url",
        "Cache-Control": "no-store",
      },
    }
  );
}
