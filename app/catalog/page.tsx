import { Suspense } from "react";
import { CatalogClient } from "./catalog-client";

export const metadata = { title: "Katalogs — tirgus.izipizi.lv" };

export default function CatalogPage() {
  return (
    <Suspense>
      <CatalogClient />
    </Suspense>
  );
}
