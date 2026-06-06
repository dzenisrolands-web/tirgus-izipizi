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
<title>Notiek novirzīšana uz Paysera...</title>
<style>
  body { margin:0; font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif; background:#192635; color:#fff; display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:100vh; padding:20px; text-align:center; }
  .spinner { width:40px; height:40px; border:3px solid rgba(255,255,255,.15); border-top-color:#53F3A4; border-radius:50%; animation:spin 0.8s linear infinite; margin-bottom:24px; }
  @keyframes spin { to { transform:rotate(360deg); } }
  h1 { font-size:18px; margin:0 0 8px; }
  p { font-size:14px; color:rgba(255,255,255,.6); margin:0 0 24px; }
  a { display:inline-block; padding:14px 32px; border-radius:999px; font-size:15px; font-weight:700; text-decoration:none; color:#192635; background:linear-gradient(90deg,#53F3A4,#AD47FF); }
  .lock { font-size:12px; color:rgba(255,255,255,.4); margin-top:20px; }
</style>
</head>
<body>
<div class="spinner"></div>
<h1>Notiek novirzīšana uz Paysera...</h1>
<p>Lūdzu, neaizver pārlūku</p>
<a id="btn" href="${escaped}" style="display:none">Turpināt uz maksājumu →</a>
<p class="lock">🔒 Drošs maksājums caur Paysera</p>
<script>
// JS redirect sets correct Referer (works in Facebook/Instagram WebView)
try {
  window.location.replace("${escaped}");
} catch(e) {}
// Fallback: show manual button after 2s if redirect didn't fire
setTimeout(function(){ document.getElementById('btn').style.display='inline-block'; }, 2000);
</script>
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
