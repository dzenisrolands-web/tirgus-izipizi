import { Suspense } from "react";
import { CatalogClient } from "./catalog-client";
import { fetchActiveListings, fetchWeeklyFeatured, searchPublicListings } from "@/lib/db-listings";
import { type Listing } from "@/lib/mock-data";
import { isPublicReady } from "@/lib/utils";
import { createServerClient } from "@/lib/supabase";

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

export const revalidate = 60;

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; seller?: string; category?: string }>;
}) {
  const params = await searchParams;
  const q = (params.q ?? "").trim();

  const [dbListings, dbWeekly] = await Promise.all([
    fetchActiveListings(),
    fetchWeeklyFeatured(7),
  ]);
  const baseListings = dbListings.filter(isPublicReady);

  let allListings: Listing[] = searchPublicListings(baseListings, q);
  if (q && q.length >= 2) {
    // Try pg_trgm search via RPC (server-side, uses service role)
    try {
      const supabase = createServerClient();
      const { data, error } = await supabase.rpc("search_products", {
        query: q,
        lim: 60,
      });
      if (!error && Array.isArray(data)) {
        allListings = searchPublicListings(baseListings, q, data);
      }
    } catch {
      // Local matching remains available without a schema migration or RPC.
    }
  }
  const weeklyFeatured = dbWeekly.filter(isPublicReady);

  return (
    <Suspense>
      <CatalogClient
        key={JSON.stringify([q, params.seller ?? "", params.category ?? ""])}
        listings={allListings}
        weeklyFeatured={weeklyFeatured}
        initialQuery={params.q ?? ""}
      />
    </Suspense>
  );
}
