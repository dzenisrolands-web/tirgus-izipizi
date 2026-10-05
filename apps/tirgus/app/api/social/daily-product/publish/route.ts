import { NextResponse } from "next/server";
import {
  serverSupabase,
  verifyDateSig,
  publishDailyPost,
  type DailyPostRow,
} from "@/lib/social/daily-product";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Poga "Publicēt" no melnraksta e-pasta.
// GET tikai parāda apstiprināšanas lapu (e-pasta drošības skeneri bieži atver
// saites automātiski — tāpēc publicēšana notiek tikai ar POST no pogas).

function page(title: string, body: string, status = 200) {
  return new NextResponse(
    `<!doctype html><html lang="lv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title></head>
<body style="margin:0;background:#192635;font-family:system-ui,sans-serif;color:#fff;display:flex;min-height:100vh;align-items:center;justify-content:center">
<div style="max-width:420px;padding:24px;text-align:center">${body}</div></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

async function load(date: string) {
  const { data } = await serverSupabase()
    .from("social_daily_posts")
    .select("*")
    .eq("post_date", date)
    .maybeSingle<DailyPostRow>();
  return data;
}

function params(url: URL) {
  return { date: url.searchParams.get("date") ?? "", sig: url.searchParams.get("sig") ?? "" };
}

export async function GET(req: Request) {
  const { date, sig } = params(new URL(req.url));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !verifyDateSig(date, sig)) {
    return page("Nederīga saite", "<h2>Nederīga saite</h2>", 403);
  }
  const row = await load(date);
  if (!row) return page("Nav atrasts", `<h2>Ieraksts ${date} nav atrasts</h2>`, 404);
  if (row.status === "published") {
    return page("Jau publicēts", `<h2>✅ ${date} dienas produkts jau ir publicēts</h2>`);
  }
  return page(
    "Publicēt dienas produktu",
    `<img src="${row.image_url}" alt="" style="width:100%;border-radius:12px;margin-bottom:16px">
     <h2 style="margin:0 0 20px">Publicēt ${date} dienas produktu?</h2>
     <p style="opacity:.8;margin:0 0 24px">Instagram (feed + Stories) un Facebook svaigi.lv</p>
     <form method="post"><button style="background:#53F3A4;color:#192635;border:0;border-radius:10px;padding:14px 32px;font:700 17px system-ui;cursor:pointer">Publicēt</button></form>`,
  );
}

export async function POST(req: Request) {
  const { date, sig } = params(new URL(req.url));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !verifyDateSig(date, sig)) {
    return page("Nederīga saite", "<h2>Nederīga saite</h2>", 403);
  }
  const row = await load(date);
  if (!row) return page("Nav atrasts", `<h2>Ieraksts ${date} nav atrasts</h2>`, 404);
  if (row.status === "published") {
    return page("Jau publicēts", `<h2>✅ Jau publicēts</h2>`);
  }
  try {
    const done = await publishDailyPost(serverSupabase(), row);
    if (done.status === "published") return page("Publicēts", "<h2>✅ Publicēts!</h2>");
    return page(
      "Daļēji publicēts",
      `<h2>⚠️ ${done.status === "partial" ? "Daļēji publicēts" : "Neizdevās"}</h2><p style="opacity:.8">${(done.error ?? "").replace(/</g, "&lt;")}</p>`,
      done.status === "partial" ? 200 : 500,
    );
  } catch (e) {
    return page("Kļūda", `<h2>Kļūda</h2><p>${(e as Error).message.replace(/</g, "&lt;")}</p>`, 500);
  }
}
