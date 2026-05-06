import Link from "next/link";
import type { Metadata } from "next";
import { ShoppingBag, Store, ArrowRight, CheckCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Reģistrēties — tirgus.izipizi.lv",
  description:
    "Izvēlies konta tipu — pircējs vai ražotājs. tirgus.izipizi.lv savieno Latvijas ražotājus ar pircējiem.",
  alternates: { canonical: "/register" },
};

export default function RegisterChooserPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:py-16">
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-700">
          Reģistrācija
        </span>
        <h1 className="mt-4 text-3xl font-extrabold text-gray-900 sm:text-4xl">
          Sveiks! Kā vēlies izmantot tirgus.izipizi.lv?
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-base text-gray-500">
          Izvēlies konta tipu — pircējs vai ražotājs.
          Reģistrācija ir bezmaksas un aizņem mazāk par minūti.
        </p>
      </div>

      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        {/* Buyer card */}
        <Link
          href="/register/pircejs"
          className="group relative overflow-hidden rounded-3xl border-2 border-brand-200 bg-gradient-to-br from-brand-50 to-white p-7 transition hover:border-brand-400 hover:shadow-xl"
        >
          <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-brand-200/30 blur-2xl" />
          <div className="relative">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-200 text-brand-800">
              <ShoppingBag size={26} />
            </div>
            <h2 className="mt-5 text-2xl font-extrabold text-gray-900">Esmu pircējs</h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              Iepērcies tieši no Latvijas ražotājiem — svaiga pārtika no fermas līdz pakomātam vai mājām.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-gray-700">
              <li className="flex items-center gap-2">
                <CheckCircle size={14} className="text-brand-600" />
                Atrodi ražotājus tuvumā
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle size={14} className="text-brand-600" />
                Seko iemīļotām fermām
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle size={14} className="text-brand-600" />
                Saņem bonusus par pasūtījumiem
              </li>
            </ul>
            <div className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-brand-700 transition group-hover:gap-3">
              Reģistrēties kā pircējs <ArrowRight size={16} />
            </div>
          </div>
        </Link>

        {/* Seller card */}
        <Link
          href="/register/razotajs"
          className="group relative overflow-hidden rounded-3xl bg-[#192635] p-7 text-white transition hover:shadow-2xl"
        >
          <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-brand-400/20 blur-2xl" />
          <div className="relative">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-brand-400">
              <Store size={26} />
            </div>
            <h2 className="mt-5 text-2xl font-extrabold">Esmu ražotājs</h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-300">
              Pārdod savus produktus caur izipizi pakomātu tīklu visā Latvijā — bez tirgus telts un bez gaidīšanas.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-gray-200">
              <li className="flex items-center gap-2">
                <CheckCircle size={14} className="text-brand-400" />
                Bezmaksas reģistrācija
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle size={14} className="text-brand-400" />
                Komisija tikai no pārdošanas
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle size={14} className="text-brand-400" />
                Apstiprināšana līdz 24h
              </li>
            </ul>
            <div className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-brand-400 transition group-hover:gap-3">
              Pieteikties kā ražotājs <ArrowRight size={16} />
            </div>
          </div>
        </Link>
      </div>

      <p className="mt-10 text-center text-sm text-gray-500">
        Jau ir konts?{" "}
        <Link href="/login" className="font-medium text-brand-600 hover:underline">
          Pieslēgties
        </Link>
      </p>
    </div>
  );
}
