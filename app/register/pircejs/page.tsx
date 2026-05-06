import type { Metadata } from "next";
import { BuyerSignupForm } from "@/components/buyer-signup-form";

export const metadata: Metadata = {
  title: "Reģistrēties kā pircējs — tirgus.izipizi.lv",
  description:
    "Izveido pircēja kontu un sāc iepirkties tieši no Latvijas ražotājiem. Bonusi, sekošana ražotājiem, ātrāka kase.",
  alternates: { canonical: "/register/pircejs" },
};

export default function BuyerRegisterPage() {
  return <BuyerSignupForm />;
}
