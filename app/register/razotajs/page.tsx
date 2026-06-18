import type { Metadata } from "next";
import { SellerSignupForm } from "@/components/seller-signup-form";

export const metadata: Metadata = {
  title: "Pieteikties k\u0101 ra\u017eot\u0101js \u2014 tirgus.izipizi.lv",
  description:
    "Izveido ra\u017eot\u0101ja kontu un s\u0101c p\u0101rdot savus produktus caur izipizi p\u0101rtikas pakom\u0101tu t\u012bklu. Komisija tikai no p\u0101rdo\u0161anas.",
  alternates: { canonical: "/register/razotajs" },
};

export default function SellerRegisterPage({
  searchParams,
}: {
  searchParams: { iid?: string; ref?: string };
}) {
  return <SellerSignupForm invitationId={searchParams.iid} />;
}
