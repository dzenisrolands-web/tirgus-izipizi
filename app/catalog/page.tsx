import { Suspense } from "react";
import { CatalogClient } from "./catalog-client";
import { fetchActiveListings, fetchWeeklyFeatured } from "@/lib/db-listings";
import { listings as mockListings, type Listing } from "@/lib/mock-data";
import { hasValidImage } from "@/lib/utils";

export const metadata = {
  title: "Produktu katalogs — tirgus.izipizi.lv",
  description: "Pārlūko svaigus produktus no Latvijas ražotājiem. Filtrē pēc kategorijas, pilsētas un uzglabāšanas veida. Saņem pasūtījumu izipizi pakomātā.",
  keywords: ["latvijas ražotāji", "svaigi produkti", "pakomāts", "bioloģiski", "vietējā pārtika"],
  openGraph: {
    title: "Produktu katalogs — tirgus.izipizi.lv",
    description: "Pārlūko svaigus produktus no Latvijas ražotājiem.",
    type: "website" as const,
    siteName: "tirgus.izipizi.lv",
  },
};

function matchesQuery(l: Listing, q: string): boolean {
  return (
    l.title.toLowerCase().includes(q) ||
    l.description.toLowerCase().includes(q) ||
    l.category.toLowerCase().includes(q) ||
    l.seller.farmName.toLowerCase().includes(q) ||
    l.seller.name.toLowerCase().includes(q)
  );
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
