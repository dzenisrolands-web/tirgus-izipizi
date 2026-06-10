import { Suspense } from "react";
import { CatalogClient } from "./catalog-client";
import { fetchActiveListings, fetchWeeklyFeatured } from "@/lib/db-listings";
import { listings as mockListings, lockers, type Listing } from "@/lib/mock-data";
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

/** Map RPC search result rows to Listing objects for CatalogClient */
function mapRpcToListing(row: Record<string, unknown>): Listing {
  const locker = lockers[0];
  return {
    id: row.id as string,
    title: row.title as string,
    description: "",
    price: row.price as number,
    unit: (row.unit as string) ?? "gab.",
    category: (row.category as string) ?? "",
    image: (row.image_url as string) ?? "",
    lockerId: locker.id,
    locker,
    sellerId: (row.seller_id as string) ?? "",
    seller: {
      id: (row.seller_id as string) ?? "",
      name: (row.seller_name as string) ?? "",
      farmName: (row.seller_farm_name as string) ?? "",
      avatar: (row.seller_avatar as string) ?? "",
      verified: true,
      rating: 5.0,
      reviewCount: 0,
      location: (row.seller_location as string) ?? "",
    },
    quantity: 1,
    freshnessDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    createdAt: new Date().toISOString(),
    slug: (row.slug as string) ?? undefined,
  };
}

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
  const realListings = dbListings.filter(isPublicReady);
  const baseListings = realListings.length > 0 ? realListings : mockListings.filter(isPublicReady);

  let allListings: Listing[];
  if (q && q.length >= 2) {
    // Try pg_trgm search via RPC (server-side, uses service role)
    try {
      const supabase = createServerClient();
      const { data, error } = await supabase.rpc("search_products", {
        query: q,
        lim: 60,
      });
      if (!error && data && data.length > 0) {
        allListings = (data as Record<string, unknown>[]).map(mapRpcToListing);
      } else {
        // RPC returned empty or error — fall back to in-memory search
        allListings = baseListings;
      }
    } catch {
      allListings = baseListings;
    }
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
