import { Suspense } from "react";
import { CatalogClient } from "./catalog-client";

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

export default function CatalogPage() {
  return (
    <Suspense>
      <CatalogClient />
    </Suspense>
  );
}
