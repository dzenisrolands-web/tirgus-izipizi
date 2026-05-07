import type { Metadata } from "next";
import { BuyerOrders } from "@/components/buyer-orders";

export const metadata: Metadata = {
  title: "Mani pasūtījumi — tirgus.izipizi.lv",
  description: "Tavu pasūtījumu vēsture un statusi.",
  robots: { index: false, follow: false },
};

export default function BuyerOrdersPage() {
  return <BuyerOrders />;
}
