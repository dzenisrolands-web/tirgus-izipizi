import type { Metadata } from "next";
import { SellerSignupForm } from "@/components/seller-signup-form";

export const metadata: Metadata = {
  title: "Pieteikties kā ražotājs — tirgus.izipizi.lv",
  description:
    "Izveido ražotāja kontu un sāc pārdot savus produktus caur izipizi p\u0101rtikas pakom\u0101tu tīklu. Komisija tikai no pārdošanas.",
  alternates: { canonical: "/register/razotajs" },
};

export default function SellerRegisterPage() {
  return <SellerSignupForm />;
}
