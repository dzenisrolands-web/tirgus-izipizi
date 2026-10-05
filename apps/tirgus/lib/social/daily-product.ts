// Dienas produkts — izvēle, teksta ģenerēšana, publicēšana.
//
// Plūsma (katru rītu no Vercel Cron):
//   1. izvēlas produktu, kas visilgāk nav rādīts (aktīvs, ir noliktavā, ir īsts foto);
//   2. Gemini uzraksta latvisku tekstu Facebook (svaigi.lv) un Instagram (tirgus.izipizi.lv);
//   3. saglabā dienas rindu social_daily_posts;
//   4. DAILY_PRODUCT_MODE=live → publicē uzreiz;
//      DAILY_PRODUCT_MODE=draft (noklusējums) → atsūta e-pastu ar pogu "Publicēt".

import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { listingUrl, isPublicReady } from "@/lib/utils";
import {
  metaConfig,
  publishFacebookPhoto,
  publishInstagramImage,
  publishInstagramStory,
} from "@/lib/social/meta";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://tirgus.izipizi.lv").replace(/\/$/, "");

export type DailyCopy = { facebook: string; instagram: string };

export type DailyPostRow = {
  id: string;
  post_date: string;
  listing_id: string;
  product_url: string;
  image_url: string;
  copy: DailyCopy;
  status: "draft" | "published" | "partial" | "failed" | "skipped";
  fb_post_id: string | null;
  ig_media_id: string | null;
  ig_story_id: string | null;
  error: string | null;
};

type ListingRow = {
  id: string;
  slug: string | null;
  title: string;
  description: string | null;
  price: number;
  unit: string;
  category: string | null;
  image_url: string | null;
  quantity: number | null;
  seller_id: string | null;
};

type SellerRow = { id: string; name: string; farm_name: string | null; location: string | null; status: string };

export function serverSupabase(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
}

/** Šodienas datums Rīgas laikā, YYYY-MM-DD. */
export function rigaDate(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Riga" }).format(d);
}

export function mode(): "live" | "draft" {
  return process.env.DAILY_PRODUCT_MODE === "live" ? "live" : "draft";
}

// ── Paraksts publicēšanas saitei e-pastā ────────────────────────────────────

export function signDate(date: string): string {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new Error("CRON_SECRET nav uzstādīts");
  return createHmac("sha256", secret).update(`daily-product:${date}`).digest("hex");
}

export function verifyDateSig(date: string, sig: string): boolean {
  try {
    const a = Buffer.from(signDate(date), "hex");
    const b = Buffer.from(sig, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ── Attēli ──────────────────────────────────────────────────────────────────

function absoluteUrl(u: string): string {
  if (/^https?:\/\//i.test(u)) return u;
  return `${SITE_URL}${u.startsWith("/") ? "" : "/"}${u}`;
}

/**
 * Instagram pieņem tikai JPEG ar malu attiecību 4:5 … 1.91:1 (Stories 9:16).
 * Ja foto ir Supabase Storage, mēģinām Supabase attēlu transformāciju (apgriež,
 * saglabā oriģinālo formātu). Ja tā nav pieejama — atgriežam oriģinālo foto.
 */
async function croppedVariant(url: string, width: number, height: number): Promise<string> {
  if (!url.includes("/storage/v1/object/public/")) return url;
  const candidate =
    url.split("?")[0].replace("/storage/v1/object/public/", "/storage/v1/render/image/public/") +
    `?width=${width}&height=${height}&resize=cover&quality=90&format=origin`;
  try {
    const res = await fetch(candidate, { method: "GET", headers: { Accept: "image/jpeg" } });
    const type = res.headers.get("content-type") ?? "";
    if (res.ok && type.startsWith("image/")) return candidate;
  } catch {
    /* krītam atpakaļ uz oriģinālu */
  }
  return url;
}

// ── Produkta izvēle ─────────────────────────────────────────────────────────

/** Deterministisks "nejaušs" skaitlis no teksta — lai secība nav tikai pēc ID. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export async function pickListing(
  sb: SupabaseClient,
  date: string,
): Promise<{ listing: ListingRow; seller: SellerRow | null } | null> {
  const { data: rows, error } = await sb
    .from("listings")
    .select("id, slug, title, description, price, unit, category, image_url, quantity, seller_id")
    .eq("status", "active")
    .gt("quantity", 0)
    .returns<ListingRow[]>();
  if (error) throw new Error(`listings: ${error.message}`);

  const candidates = (rows ?? []).filter((l) =>
    isPublicReady({ image: l.image_url, price: l.price }),
  );
  if (candidates.length === 0) return null;

  const sellerIds = [...new Set(candidates.map((l) => l.seller_id).filter(Boolean))] as string[];
  const { data: sellers } = await sb
    .from("sellers")
    .select("id, name, farm_name, location, status")
    .in("id", sellerIds)
    .returns<SellerRow[]>();
  const sellerMap = new Map((sellers ?? []).map((s) => [s.id, s]));

  // Tikai apstiprinātu tirgotāju produkti
  const approved = candidates.filter((l) => {
    const s = l.seller_id ? sellerMap.get(l.seller_id) : null;
    return !s || s.status === "approved";
  });
  const pool = approved.length > 0 ? approved : candidates;

  // Kad katrs produkts rādīts pēdējo reizi
  const { data: history } = await sb
    .from("social_daily_posts")
    .select("listing_id, post_date")
    .in("status", ["published", "partial"])
    .order("post_date", { ascending: false })
    .limit(1000);
  const lastShown = new Map<string, string>();
  for (const h of history ?? []) {
    if (!lastShown.has(h.listing_id)) lastShown.set(h.listing_id, h.post_date);
  }

  // Nekad nerādītie pirmie, tad visilgāk nerādītie; vienādos — dienas "nejaušība"
  pool.sort((a, b) => {
    const la = lastShown.get(a.id) ?? "";
    const lb = lastShown.get(b.id) ?? "";
    if (la !== lb) return la < lb ? -1 : 1;
    return hash(a.id + date) - hash(b.id + date);
  });

  // Nerādām to pašu tirgotāju divas dienas pēc kārtas, ja var izvēlēties
  const yesterdaySeller = (() => {
    const lastId = history?.[0]?.listing_id;
    return lastId ? (rows ?? []).find((r) => r.id === lastId)?.seller_id ?? null : null;
  })();
  const pick = pool.find((l) => l.seller_id !== yesterdaySeller) ?? pool[0];

  return { listing: pick, seller: pick.seller_id ? sellerMap.get(pick.seller_id) ?? null : null };
}

// ── Teksts ──────────────────────────────────────────────────────────────────

const COPY_SYSTEM = `Tu raksti sociālo tīklu ierakstus "Dienas produkts" rubrikai latviešu valodā.
Zīmols: tirgus.izipizi.lv — Latvijas mazo ražotāju tirgus; pirkumus saņem temperatūras kontrolētā pārtikas pakomātā (IziPizi) vai ar kurjeru.
Facebook lapa ir svaigi.lv (sena kopiena, kas pērk vietējo pārtiku), Instagram konts ir tirgus.izipizi.lv.

Noteikumi:
- Raksti pareizā, dabiskā latviešu valodā (pareizas galotnes un saskaņojums), siltā, tiešā tonī. Bez pārspīlējumiem.
- Izmanto TIKAI dotos faktus par produktu un ražotāju. Neizdomā sertifikātus, vietas, garšas apgalvojumus, atlaides vai skaitļus, kas nav dati.
- Cenu raksti kā "X,XX €" ar komatu.
- Pa 1–3 emocijzīmēm, ne vairāk.
- facebook: 3–5 īsi teikumi, beigās aicinājums pasūtīt un produkta saite (dota zemāk) atsevišķā rindā.
- instagram: 2–4 teikumi, aicinājums "saite profilā" (Instagram saites nav klikšķināmas), tad tukša rinda un 8–12 atbilstoši tēmturi (#tirgusizipizi #izipizi #vietejaisražojums #latvijasprodukti + specifiski produktam).
Atgriez tikai JSON: {"facebook": "...", "instagram": "..."}`;

function fmtPrice(n: number): string {
  return n.toFixed(2).replace(".", ",");
}

export async function generateCopy(input: {
  listing: ListingRow;
  seller: SellerRow | null;
  fbUrl: string;
}): Promise<DailyCopy> {
  const apiKey = process.env.GEMINI_API_KEY;
  const { listing, seller, fbUrl } = input;
  const producer = seller?.farm_name || seller?.name || "";

  const facts = [
    `Produkts: ${listing.title}`,
    `Cena: ${fmtPrice(listing.price)} € / ${listing.unit}`,
    listing.category ? `Kategorija: ${listing.category}` : "",
    producer ? `Ražotājs: ${producer}` : "",
    seller?.location ? `Ražotāja vieta: ${seller.location}` : "",
    listing.description ? `Apraksts no produkta lapas: ${listing.description.slice(0, 1200)}` : "",
    `Produkta saite (Facebook tekstam): ${fbUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  const fallback: DailyCopy = {
    facebook: `🌿 Dienas produkts: ${listing.title}${producer ? ` no ${producer}` : ""}.\n\n${fmtPrice(listing.price)} € / ${listing.unit}. Pasūti tirgus.izipizi.lv un saņem tuvākajā pārtikas pakomātā.\n\n${fbUrl}`,
    instagram: `🌿 Dienas produkts: ${listing.title}${producer ? ` no ${producer}` : ""} — ${fmtPrice(listing.price)} € / ${listing.unit}. Saite profilā 👆\n\n#tirgusizipizi #izipizi #vietejaisrazojums #latvijasprodukti #dienasprodukts`,
  };
  if (!apiKey) return fallback;

  const genAI = new GoogleGenerativeAI(apiKey);
  // 2.5-flash raksta labāku latviešu valodu; viens pieprasījums dienā iekļaujas bezmaksas limitā.
  for (const modelName of ["gemini-2.5-flash", "gemini-2.5-flash-lite"]) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: COPY_SYSTEM,
        generationConfig: { responseMimeType: "application/json", temperature: 0.8 },
      });
      const res = await model.generateContent(facts);
      const parsed = JSON.parse(res.response.text()) as Partial<DailyCopy>;
      if (parsed.facebook && parsed.instagram) {
        // Drošībai: saitei FB tekstā jābūt
        const facebook = parsed.facebook.includes(fbUrl)
          ? parsed.facebook
          : `${parsed.facebook.trim()}\n\n${fbUrl}`;
        return { facebook, instagram: parsed.instagram.trim() };
      }
    } catch (e) {
      console.error(`[daily-product] ${modelName}:`, e);
    }
  }
  return fallback;
}

// ── Dienas ieraksta sagatavošana ────────────────────────────────────────────

export async function prepareDailyPost(sb: SupabaseClient, date: string): Promise<DailyPostRow | null> {
  const picked = await pickListing(sb, date);
  if (!picked) return null;
  const { listing, seller } = picked;

  const productUrl = `${SITE_URL}${listingUrl(listing)}`;
  const fbUrl = `${productUrl}?utm_source=facebook&utm_medium=social&utm_campaign=dienas_produkts`;
  const imageUrl = absoluteUrl(listing.image_url!);
  const copy = await generateCopy({ listing, seller, fbUrl });

  const { data, error } = await sb
    .from("social_daily_posts")
    .insert({
      post_date: date,
      listing_id: listing.id,
      product_url: productUrl,
      image_url: imageUrl,
      copy,
      status: "draft",
    })
    .select("*")
    .single<DailyPostRow>();
  if (error) throw new Error(`social_daily_posts insert: ${error.message}`);
  return data;
}

// ── Publicēšana ─────────────────────────────────────────────────────────────

/** Publicē visus vēl nepublicētos kanālus. Droši izsaukt atkārtoti. */
export async function publishDailyPost(sb: SupabaseClient, row: DailyPostRow): Promise<DailyPostRow> {
  const cfg = metaConfig();
  const errors: string[] = [];
  const update: Partial<DailyPostRow> & { published_at?: string } = {};

  if (cfg.fbReady && !row.fb_post_id) {
    try {
      update.fb_post_id = await publishFacebookPhoto({
        pageId: cfg.fbPageId,
        token: cfg.fbToken,
        imageUrl: row.image_url,
        message: row.copy.facebook,
      });
    } catch (e) {
      errors.push(`FB: ${(e as Error).message}`);
    }
  } else if (!cfg.fbReady) {
    errors.push("FB: META_FB_PAGE_ID / META_FB_PAGE_TOKEN nav uzstādīti");
  }

  if (cfg.igReady) {
    if (!row.ig_media_id) {
      try {
        update.ig_media_id = await publishInstagramImage({
          igUserId: cfg.igUserId,
          token: cfg.igToken,
          imageUrl: await croppedVariant(row.image_url, 1080, 1350),
          caption: row.copy.instagram,
        });
      } catch (e) {
        errors.push(`IG: ${(e as Error).message}`);
      }
    }
    if (!row.ig_story_id) {
      try {
        update.ig_story_id = await publishInstagramStory({
          igUserId: cfg.igUserId,
          token: cfg.igToken,
          imageUrl: await croppedVariant(row.image_url, 1080, 1920),
        });
      } catch (e) {
        errors.push(`IG Stories: ${(e as Error).message}`);
      }
    }
  } else {
    errors.push("IG: META_IG_USER_ID / META_IG_ACCESS_TOKEN nav uzstādīti");
  }

  const fb = update.fb_post_id ?? row.fb_post_id;
  const ig = update.ig_media_id ?? row.ig_media_id;
  const story = update.ig_story_id ?? row.ig_story_id;
  const all = Boolean(fb && ig && story);
  const any = Boolean(fb || ig || story);

  update.status = all ? "published" : any ? "partial" : "failed";
  update.error = errors.length ? errors.join(" | ") : null;
  if (any) update.published_at = new Date().toISOString();

  const { data, error } = await sb
    .from("social_daily_posts")
    .update(update)
    .eq("id", row.id)
    .select("*")
    .single<DailyPostRow>();
  if (error) throw new Error(`social_daily_posts update: ${error.message}`);
  return data;
}

// ── Melnraksta e-pasts ──────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

export async function emailDraft(row: DailyPostRow): Promise<void> {
  const to = process.env.DAILY_PRODUCT_PREVIEW_EMAIL;
  const key = process.env.RESEND_API_KEY;
  if (!to || !key) {
    console.warn("[daily-product] DAILY_PRODUCT_PREVIEW_EMAIL vai RESEND_API_KEY nav — e-pasts netiek sūtīts");
    return;
  }
  const publishUrl = `${SITE_URL}/api/social/daily-product/publish?date=${row.post_date}&sig=${signDate(row.post_date)}`;
  const block = (title: string, text: string) =>
    `<h3 style="margin:24px 0 8px;font:600 15px sans-serif;color:#192635">${title}</h3>
     <div style="white-space:pre-wrap;font:14px/1.5 sans-serif;color:#192635;background:#f4f6f8;border-radius:8px;padding:12px">${esc(text)}</div>`;

  const html = `<div style="max-width:560px;margin:0 auto;font-family:sans-serif">
    <h2 style="font:700 20px sans-serif;color:#192635">Dienas produkts · ${row.post_date}</h2>
    <a href="${row.product_url}"><img src="${row.image_url}" alt="" style="width:100%;border-radius:12px"></a>
    ${block("Facebook · svaigi.lv", row.copy.facebook)}
    ${block("Instagram · tirgus.izipizi.lv (+ Stories ar to pašu foto)", row.copy.instagram)}
    <p style="margin:28px 0;text-align:center">
      <a href="${publishUrl}" style="background:#53F3A4;color:#192635;font:700 16px sans-serif;padding:14px 28px;border-radius:10px;text-decoration:none">Publicēt</a>
    </p>
    <p style="font:12px sans-serif;color:#777">Ja nepublicēsi, šodien nekas netiks ievietots. Lai publicētu automātiski bez apstiprināšanas, Vercel uzstādi DAILY_PRODUCT_MODE=live.</p>
  </div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "tirgus.izipizi.lv <noreply@tirgus.izipizi.lv>",
      to: [to],
      subject: `Dienas produkts ${row.post_date} — apstiprini publicēšanu`,
      html,
    }),
  });
  if (!res.ok) console.error("[daily-product] Resend:", res.status, await res.text().catch(() => ""));
}
