import { NextResponse } from "next/server";
import {
  serverSupabase,
  rigaDate,
  mode,
  prepareDailyPost,
  publishDailyPost,
  emailDraft,
  pickListing,
  generateCopy,
  SITE_URL,
  type DailyPostRow,
} from "@/lib/social/daily-product";
import { listingUrl } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Vercel Cron — katru rītu (sk. vercel.json).
// Izvēlas dienas produktu, uzraksta tekstu un publicē uz
// Instagram (tirgus.izipizi.lv, feed + Stories) un Facebook (svaigi.lv).
//
// Manuāli (ar Authorization: Bearer $CRON_SECRET):
//   ?dry=1     — tikai parāda, ko izvēlētos un uzrakstītu; neko nesaglabā, nepublicē
//   ?force=1   — publicē šodienas ierakstu uzreiz arī draft režīmā
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const dry = url.searchParams.get("dry") === "1";
  const force = url.searchParams.get("force") === "1";
  const sb = serverSupabase();
  const date = rigaDate();

  try {
    if (dry) {
      const picked = await pickListing(sb, date);
      if (!picked) return NextResponse.json({ ok: true, dry: true, picked: null });
      const productUrl = `${SITE_URL}${listingUrl(picked.listing)}`;
      const copy = await generateCopy({
        ...picked,
        fbUrl: `${productUrl}?utm_source=facebook&utm_medium=social&utm_campaign=dienas_produkts`,
      });
      return NextResponse.json({
        ok: true,
        dry: true,
        date,
        listing: { id: picked.listing.id, title: picked.listing.title, image: picked.listing.image_url },
        productUrl,
        copy,
      });
    }

    const { data: existing } = await sb
      .from("social_daily_posts")
      .select("*")
      .eq("post_date", date)
      .maybeSingle<DailyPostRow>();

    let row = existing;
    let created = false;
    if (!row) {
      row = await prepareDailyPost(sb, date);
      created = true;
      if (!row) {
        return NextResponse.json({ ok: true, date, skipped: "nav piemērotu produktu" });
      }
    }

    if (row.status === "published") {
      return NextResponse.json({ ok: true, date, already: "published", row });
    }

    if (mode() === "live" || force || row.status === "partial") {
      row = await publishDailyPost(sb, row);
    } else if (created) {
      await emailDraft(row);
    }

    return NextResponse.json({ ok: true, date, mode: mode(), row });
  } catch (e) {
    console.error("[cron/daily-product]", e);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
