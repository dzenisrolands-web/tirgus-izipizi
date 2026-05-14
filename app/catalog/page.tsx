import { Suspense } from "react";
import { CatalogClient } from "./catalog-client";
import { fetchActiveListings, fetchWeeklyFeatured } from "@/lib/db-listings";
import { listings as mockListings, type Listing } from "@/lib/mock-data";
import { hasValidImage } from "@/lib/utils";

export const metadata = {
  title: "Produktu katalogs — tirgus.izipizi.lv",
  description: "Pārlūko svaigus produktus no Latvijas ražotājiem. Filtrē pēc kategorijas, pilsētas un uzglabāšanas veida. Saņem pasūtījumu izipizi pakomātā.",
  keywords: ["latvijas ražotāji", "svaigi produkti", "pakomāts", "bioloģiski", "vietējā pārtika"],
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

function matchesQuery(l: Listing, q: string): boolean {
  const normalizedQ = stripDiacritics(q);
  const fields = [
    l.title,
    l.description,
    l.category,
    l.seller.farmName,
    l.seller.name,
  ];
  // Match each search word independently — "burk sula" matches if both words appear
  const words = normalizedQ.split(/\s+/).filter(Boolean);
  const haystack = fields.map(f => stripDiacritics(f.toLowerCase())).join(" ");
  return words.every(word => haystack.includes(word));
}

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
  const realListings = dbListings.filter(hasValidImage);
  const baseListings = realListings.length > 0 ? realListings : mockListings.filter(hasValidImage);
  const allListings = q ? baseListings.filter((l) => matchesQuery(l, q)) : baseListings;
  const weeklyFeatured = dbWeekly.filter(hasValidImage);

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
