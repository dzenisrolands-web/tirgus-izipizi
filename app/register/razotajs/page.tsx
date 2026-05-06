import type { Metadata } from "next";
import { SellerSignupForm } from "@/components/seller-signup-form";

export const metadata: Metadata = {
  title: "Pieteikties kā ražotājs — tirgus.izipizi.lv",
  description:
    "Izveido ražotāja kontu un sāc pārdot savus produktus caur izipizi pakomātu tīklu visā Latvijā. Komisija tikai no pārdošanas.",
  alternates: { canonical: "/register/razotajs" },
};

export default function SellerRegisterPage() {
  return <SellerSignupForm />;
}
