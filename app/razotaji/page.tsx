import type { Metadata } from "next";
import { Store } from "lucide-react";
import { RazotajiClient } from "@/components/razotaji-client";
import { fetchApprovedSellers } from "@/lib/db-listings";

export const metadata: Metadata = {
  title: "Ražotāji — Vietējie pārtikas ražotāji | tirgus.izipizi.lv",
  description:
    "Iepazīsties ar vietējiem Latvijas pārtikas ražotājiem — bio dārzeņi, savvaļas gaļa, jūras veltes, konditorejas izstrādājumi un daudz kas cits. Pasūti un saņem IziPizi pakomātā.",
  keywords: [
    "latvijas ražotāji",
    "vietējā pārtika",
    "bio pārtika latvija",
    "medījumu gaļa",
    "austeres latvija",
    "ikri latvija",
    "konditorejas izstrādājumi",
  ],
  alternates: { canonical: "/razotaji" },
  openGraph: {
    title: "Ražotāji — Vietējie pārtikas ražotāji | tirgus.izipizi.lv",
    description: "Iepazīsties ar vietējiem Latvijas pārtikas ražotājiem.",
    url: "https://tirgus.izipizi.lv/razotaji",
    type: "website",
    siteName: "tirgus.izipizi.lv",
  },
};

export default async function RazotajiPage() {
  const dbSellers = await fetchApprovedSellers();

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="max-w-2xl">
        <div className="flex items-center gap-2 text-sm font-medium text-brand-600">
          <Store size={16} />
          <span>Latvijas ražotāji</span>
        </div>
        <h1 className="mt-2 text-3xl font-extrabold text-gray-900 sm:text-4xl">
          Ražotāji
        </h1>
        <p className="mt-3 text-gray-500">
          Vietējie Latvijas pārtikas ražotāji un uzņēmumi — bio dārzeņi, savvaļas
          gaļa, jūras veltes, konditoreja un daudz kas cits. Pasūti tieši no
          ražotāja un saņem IziPizi pakomātā.
        </p>
      </div>

      <RazotajiClient dbSellers={dbSellers} />
    </div>
  );
}
