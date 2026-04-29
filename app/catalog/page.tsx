import { Suspense } from "react";
import { CatalogClient } from "./catalog-client";
import { fetchActiveListings } from "@/lib/db-listings";
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
  const dbListings = await fetchActiveListings();
  // Real DB listings first, then mock demo listings — filter out anything without a valid image
  const allListings = [...dbListings, ...mockListings].filter(hasValidImage);

  return (
    <Suspense>
      <CatalogClient listings={allListings} />
    </Suspense>
  );
}
