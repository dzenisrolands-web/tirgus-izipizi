import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

const BASE = "https://tirgus.izipizi.lv";

export const revalidate = 3600; // regenerate every hour

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE, changeFrequency: "daily", priority: 1.0 },
    { url: `${BASE}/catalog`, changeFrequency: "hourly", priority: 0.9 },
    // { url: `${BASE}/keriens`, lastModified: now, changeFrequency: "hourly", priority: 0.9 }, // Sludinājumu dēlis paslēpts līdz launch
    { url: `${BASE}/razotaji`, changeFrequency: "weekly", priority: 0.8 },
    // /receptes paslēpts pirms launch — saturs jāsakārto, skat. project_recipes_cleanup.md
    { url: `${BASE}/piegade`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/par-mums`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/how-it-works`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/sell`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/contact`, changeFrequency: "yearly", priority: 0.4 },
    { url: `${BASE}/lockers`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE}/noteikumi`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/privatums`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/atgriesana`, changeFrequency: "yearly", priority: 0.3 },
  ];

  // Fetch real DB data for listings, sellers, drops
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  let dbPages: MetadataRoute.Sitemap = [];
  if (url && key) {
    try {
      const supabase = createClient(url, key);
      const [listingsRes, sellersRes] = await Promise.all([
        supabase.from("listings").select("id, slug, price, updated_at").eq("status", "active").gt("price", 0),
        supabase.from("sellers_public").select("id, updated_at").eq("status", "approved"),
      ]);
      if (listingsRes.error) console.warn("[sitemap] Public listing query unavailable");
      if (sellersRes.error) console.warn("[sitemap] Public seller query unavailable");

      const listingPages: MetadataRoute.Sitemap = (listingsRes.error ? [] : listingsRes.data ?? [])
        .filter(l => typeof l.price === "number" && Number.isFinite(l.price) && l.price > 0)
        .map((l) => ({
        url: `${BASE}/listing/${encodeURIComponent(l.slug || l.id)}`,
        lastModified: validDate(l.updated_at),
        changeFrequency: "weekly",
        priority: 0.8,
      }));

      const sellerPages: MetadataRoute.Sitemap = (sellersRes.error ? [] : sellersRes.data ?? []).map((s) => ({
        url: `${BASE}/seller/${encodeURIComponent(s.id)}`,
        lastModified: validDate(s.updated_at),
        changeFrequency: "weekly",
        priority: 0.7,
      }));

      dbPages = [...listingPages, ...sellerPages];
    } catch (err) {
      console.error("[sitemap] DB query failed, falling back to static only:", err);
    }
  }

  return [...staticPages, ...dbPages];
}

function validDate(value: unknown): Date | undefined {
  if (typeof value !== "string") return undefined;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : undefined;
}
