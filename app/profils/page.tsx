import type { Metadata } from "next";
import { BuyerProfile } from "@/components/buyer-profile";

export const metadata: Metadata = {
  title: "Mans konts — tirgus.izipizi.lv",
  description: "Tavi pasūtījumi, sekotie ražotāji un bonusi vienuviet.",
  robots: { index: false, follow: false },
};

export default function BuyerProfilePage() {
  return <BuyerProfile />;
}
