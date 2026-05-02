import { Suspense } from "react";
import { CatalogClient } from "./catalog-client";
import { fetchActiveListings, fetchWeeklyFeatured } from "@/lib/db-listings";
import { listings as mockListings } from "@/lib/mock-data";
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

export default async function CatalogPage() {
  const [dbListings, dbWeekly] = await Promise.all([
    fetchActiveListings(),
    fetchWeeklyFeatured(7),
  ]);
  // Real DB listings only. Mock data falls back ONLY if the DB returns
  // nothing (dev without a populated DB) — it should never inflate counts
  // alongside real products.
  const realListings = dbListings.filter(hasValidImage);
  const allListings = realListings.length > 0 ? realListings : mockListings.filter(hasValidImage);
  const weeklyFeatured = dbWeekly.filter(hasValidImage);

  return (
    <Suspense>
      <CatalogClient listings={allListings} weeklyFeatured={weeklyFeatured} />
    </Suspense>
  );
}
