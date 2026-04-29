import { Flame } from "lucide-react";
import { fetchActiveDrops } from "@/lib/hot-drops/queries";
import { DropGrid } from "@/components/keriens/DropGrid";

export const revalidate = 30;

export const metadata = {
  title: "Sludinājumu dēlis",
  description: "Tieši no Latvijas ražotāja — svaigi sludinājumi par produktiem, kas pieejami tavā pakomātā. Abonē un saņem paziņojumu uzreiz.",
  openGraph: {
    title: "🔥 Sludinājumu dēlis — tirgus.izipizi.lv",
    description: "Tieši no Latvijas ražotāja — svaigi sludinājumi par produktiem, kas pieejami tavā pakomātā.",
    url: "https://tirgus.izipizi.lv/keriens",
    images: [
      {
        url: "https://business.izipizi.lv/images/marketplace/products/4998684Pelmeni-veganie-webp.webp",
        width: 1200,
        height: 630,
        alt: "Sludinājumu dēlis — tieši no ražotāja",
      },
    ],
  },
  twitter: {
    card: "summary_large_image" as const,
    title: "🔥 Sludinājumu dēlis — tirgus.izipizi.lv",
    description: "Tieši no Latvijas ražotāja — svaigi sludinājumi par produktiem, kas pieejami tavā pakomātā.",
  },
};

export default async function SludinajumuDelisPage() {
  const drops = await fetchActiveDrops();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="flex items-center justify-center gap-2 text-3xl font-extrabold text-gray-900 sm:text-4xl">
          <Flame size={32} className="text-orange-500" />
          Sludinājumu dēlis
        </h1>
        <p className="mt-2 text-base text-gray-500">
          Tieši no ražotāja · Pievienots šodien · Saņem savā pakomātā
        </p>
      </div>

      <DropGrid initialDrops={drops} />
    </div>
  );
}
