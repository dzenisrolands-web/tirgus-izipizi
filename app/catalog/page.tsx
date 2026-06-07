import { Suspense } from "react";
import { CatalogClient } from "./catalog-client";
import { fetchActiveListings, fetchWeeklyFeatured } from "@/lib/db-listings";
import { listings as mockListings, type Listing } from "@/lib/mock-data";
import { isPublicReady } from "@/lib/utils";

export const metadata = {
  title: "Produktu katalogs — tirgus.izipizi.lv",
  description: "Pārlūko svaigus produktus no Latvijas ražotājiem. Filtrē pēc kategorijas, pilsētas un uzglabāšanas veida. Saņem pasūtījumu izipizi pārtikas pakomātā.",
  keywords: ["latvijas ražotāji", "svaigi produkti", "pārtikas pakomāts", "bioloģiski", "vietējā pārtika"],
  alternates: { canonical: "/catalog" },
  openGraph: {
    title: "Produktu katalogs — tirgus.izipizi.lv",
    description: "Pārlūko svaigus produktus no Latvijas ražotājiem.",
    url: "https://tirgus.izipizi.lv/catalog",
    type: "website" as const,
    siteName: "tirgus.izipizi.lv",
  },
};

/** Strip Latvian diacritics so "burkans" matches "Burkāns", "kipiloks" matches "Ķīploks" etc. */
function stripDiacritics(s: string): string {
  return s
    .replace(/[āĀ]/g, "a")
    .replace(/[čČ]/g, "c")
    .replace(/[ēĒ]/g, "e")
    .replace(/[ģĢ]/g, "g")
    .replace(/[īĪ]/g, "i")
    .replace(/[ķĶ]/g, "k")
    .replace(/[ļĻ]/g, "l")
    .replace(/[ņŅ]/g, "n")
    .replace(/[šŠ]/g, "s")
    .replace(/[ūŪ]/g, "u")
    .replace(/[žŽ]/g, "z");
}

/**
 * Latvian stem match: "burkans" matches "burkani", "burkanu", "burkaniem" etc.
 * For words >= 4 chars, extract a stem (first 4+ chars) and check if any
 * word in the haystack starts with that stem, or vice versa.
 */
function stemMatch(haystack: string, needle: string): boolean {
  if (haystack.includes(needle)) return true;
  // For short words, require exact substring match
  if (needle.length < 4) return false;
  // Stem = first N chars (min 4, or full word if short)
  const stem = needle.slice(0, Math.max(4, needle.length - 2));
  // Check if any word in haystack starts with the stem
  const words = haystack.split(/\s+/);
  return words.some(w => w.startsWith(stem) || stem.startsWith(w.slice(0, Math.max(4, w.length - 2))));
}

/** Score how relevant a listing is to a query. Higher = more relevant.
 *  Title match = 10 pts per word, seller = 8, category = 5, description = 1 */
function relevanceScore(l: Listing, q: string): number {
  const normalizedQ = stripDiacritics(q);
  const words = normalizedQ.split(/\s+/).filter(Boolean);
  const title = stripDiacritics(l.title.toLowerCase());
  const category = stripDiacritics(l.category.toLowerCase());
  const seller = stripDiacritics((l.seller.farmName || l.seller.name).toLowerCase());
  const desc = stripDiacritics(l.description.toLowerCase());
  let score = 0;
  for (const w of words) {
    if (stemMatch(title, w)) score += 10;
    if (stemMatch(seller, w)) score += 8;
    if (stemMatch(category, w)) score += 5;
    if (stemMatch(desc, w)) score += 1;
  }
  // Bonus if title starts with the query
  if (title.startsWith(normalizedQ)) score += 20;
  // Bonus for exact substring in title (not just stem)
  if (title.includes(normalizedQ)) score += 5;
  return score;
}

function matchesQuery(l: Listing, q: string): boolean {
  const normalizedQ = stripDiacritics(q);
  const fields = [
    l.title,
    l.description,
    l.category,
    l.seller.farmName,
    l.seller.name,
  ];
  const words = normalizedQ.split(/\s+/).filter(Boolean);
  const haystack = fields.map(f => stripDiacritics(f.toLowerCase())).join(" ");
  return words.every(word => stemMatch(haystack, word));
}

export const revalidate = 60; // revalidate every 60s for new products

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; seller?: string; category?: string }>;
}) {
  const params = await searchParams;
  const q = (params.q ?? "").trim().toLowerCase();

  const [dbListings, dbWeekly] = await Promise.all([
    fetchActiveListings(),
    fetchWeeklyFeatured(7),
  ]);
  // Real DB listings only. Mock data falls back ONLY if the DB returns
  // nothing (dev without a populated DB) — it should never inflate counts
  // alongside real products.
  const realListings = dbListings.filter(isPublicReady);
  const baseListings = realListings.length > 0 ? realListings : mockListings.filter(isPublicReady);
  let allListings: Listing[];
  if (q) {
    // Score all listings, sort strong matches (title/seller/category) first,
    // then description-only matches after — so user sees exact products first,
    // followed by products that mention the query in ingredients/description.
    allListings = baseListings
      .map((l) => ({ l, score: relevanceScore(l, q) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ l }) => l);
  } else {
    allListings = baseListings;
  }
  const weeklyFeatured = dbWeekly.filter(isPublicReady);

  return (
    <Suspense>
      <CatalogClient
        listings={allListings}
        weeklyFeatured={weeklyFeatured}
        initialQuery={params.q ?? ""}
      />
    </Suspense>
  );
}
