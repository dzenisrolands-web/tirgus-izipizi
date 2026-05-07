import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

const BASE = "https://tirgus.izipizi.lv";

export const revalidate = 3600; // regenerate every hour

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${BASE}/catalog`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    // { url: `${BASE}/keriens`, lastModified: now, changeFrequency: "hourly", priority: 0.9 }, // Sludinājumu dēlis paslēpts līdz launch
    { url: `${BASE}/razotaji`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    // /receptes paslēpts pirms launch — saturs jāsakārto, skat. project_recipes_cleanup.md
    { url: `${BASE}/piegade`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/par-mums`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/how-it-works`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/sell`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/contact`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${BASE}/noteikumi`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/privatums`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/atgriesana`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  // Fetch real DB data for listings, sellers, drops
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;

  let dbPages: MetadataRoute.Sitemap = [];
  if (url && key) {
    try {
      const supabase = createClient(url, key);
      const [listingsRes, sellersRes] = await Promise.all([
        supabase.from("listings").select("id, updated_at").eq("status", "active"),
        supabase.from("sellers").select("id, updated_at").eq("status", "approved"),
      ]);

      const listingPages: MetadataRoute.Sitemap = (listingsRes.data ?? []).map((l) => ({
        url: `${BASE}/listing/${l.id}`,
        lastModified: l.updated_at ? new Date(l.updated_at) : now,
        changeFrequency: "weekly",
        priority: 0.8,
      }));

      const sellerPages: MetadataRoute.Sitemap = (sellersRes.data ?? []).map((s) => ({
        url: `${BASE}/seller/${s.id}`,
        lastModified: s.updated_at ? new Date(s.updated_at) : now,
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
