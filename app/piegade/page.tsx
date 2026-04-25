import type { Metadata } from "next";
import { Package, MapPin, Truck, Thermometer, Snowflake, Clock, Tag, CheckCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Piegāde | tirgus.izipizi.lv",
  description: "Piegādes iespējas, zonas un cenas — IziPizi pakomāts vai kurjers uz mājas adresi.",
};

const LOCKER_SIZES = [
  { size: "M", desc: "Standarta", price: "3.00 €", promo: true },
  { size: "L", desc: "Saldēts (−18°C)", price: "3.99 €", promo: false },
  { size: "XL", desc: "Liels", price: "4.50 €", promo: false },
];

const COURIER_ZONES = [
  {
    zone: "Zona 0",
    area: "Rīga un tuvākā apkārtne",
    noThermo: "4.50",
    thermo: "6.40",
    frozen: "7.30",
  },
  {
    zone: "Zona 1",
    area: "Pierīgas novads, Jūrmala, Salaspils",
    noThermo: "5.50",
    thermo: "7.00",
    frozen: "8.00",
  },
  {
    zone: "Zona 2",
    area: "Pārējā Latvija",
    noThermo: "7.50",
    thermo: "8.40",
    frozen: "9.30",
  },
];

export default function PiegadePage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">

      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-extrabold text-gray-900">Piegāde</h1>
        <p className="mt-2 text-gray-500">Divas ērtas iespējas — pakomāts vai kurjers tieši uz mājas adresi</p>
      </div>

      {/* Promo banner */}
      <div
        className="mt-8 flex items-center gap-3 rounded-2xl px-6 py-4 text-white"
        style={{ background: "linear-gradient(90deg, #53F3A4, #AD47FF)" }}
      >
        <Tag size={22} className="shrink-0 text-[#192635]" />
        <div>
          <p className="font-bold text-[#192635]">Akcija! Jebkura piegāde uz pakomātu — tikai 3 EUR</p>
          <p className="text-sm text-[#192635]/80">Spēkā līdz nākamajam paziņojumam</p>
        </div>
      </div>

      {/* Two options */}
      <div className="mt-10 grid gap-6 sm:grid-cols-2">

        {/* Pakomāts */}
        <div className="rounded-2xl border-2 border-brand-400/40 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-400/15">
              <Package size={24} className="text-brand-700" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">IziPizi pakomāts</h2>
              <p className="text-xs text-gray-500">24/7 · Temperatūras kontrole</p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {LOCKER_SIZES.map((s) => (
              <div key={s.size} className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-700">
                    {s.size}
                  </span>
                  <span className="text-sm text-gray-700">{s.desc}</span>
                </div>
                <div className="flex items-center gap-2">
                  {s.promo && (
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-bold text-[#192635]"
                      style={{ background: "linear-gradient(90deg, #53F3A4, #AD47FF)" }}
                    >
                      Akcija
                    </span>
                  )}
                  <span className="font-bold text-gray-900">{s.price}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-1.5 text-xs text-gray-500">
            <p className="flex items-center gap-1.5"><Thermometer size={12} className="text-brand-600" /> +2°C līdz +6°C — svaigai pārtikai</p>
            <p className="flex items-center gap-1.5"><Snowflake size={12} className="text-blue-400" /> −18°C — saldētai produkcijai</p>
            <p className="flex items-center gap-1.5"><Clock size={12} className="text-gray-400" /> Saņemšana 24/7 jebkurā laikā</p>
          </div>
        </div>

        {/* Kurjers */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100">
              <Truck size={24} className="text-gray-600" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">Kurjers uz adresi</h2>
              <p className="text-xs text-gray-500">Temperatūras režīmā · Cenas +PVN</p>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-xl border border-gray-100">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Zona</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600">Bez termo</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600">+2°C</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600">−18°C</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {COURIER_ZONES.map((z) => (
                  <tr key={z.zone}>
                    <td className="px-3 py-2.5">
                      <p className="font-semibold text-gray-800">{z.zone}</p>
                      <p className="text-xs text-gray-400">{z.area}</p>
                    </td>
                    <td className="px-3 py-2.5 text-center font-medium text-gray-700">{z.noThermo}€</td>
                    <td className="px-3 py-2.5 text-center font-medium text-gray-700">{z.thermo}€</td>
                    <td className="px-3 py-2.5 text-center font-medium text-gray-700">{z.frozen}€</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-xs text-gray-400">
            * Piegāde 5 stundu laikā pēc pieteikuma noformēšanas (Zona 0 un 1)
          </p>
        </div>
      </div>

      {/* How it works */}
      <div className="mt-12">
        <h2 className="text-xl font-bold text-gray-900">Kā notiek piegāde?</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            { icon: <Package size={20} />, title: "Ražotājs ievieto", desc: "Pārdevējs sagatavo pasūtījumu un ievieto izvēlētajā IziPizi pakomātā vai nodod kurjeram." },
            { icon: <Clock size={20} />, title: "Saņem paziņojumu", desc: "Pēc apmaksas 1–2 dienu laikā saņem kodu uz e-pastu vai SMS." },
            { icon: <MapPin size={20} />, title: "Izņem produktus", desc: "Pakomātā — 24/7 jebkurā laikā. Kurjers — norādītajā adresē un laika logā." },
          ].map((step, i) => (
            <div key={i} className="rounded-2xl bg-gray-50 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-400/20 text-brand-700">
                {step.icon}
              </div>
              <p className="mt-3 font-semibold text-gray-900">{step.title}</p>
              <p className="mt-1 text-sm text-gray-500 leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Info boxes */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-[#192635] p-5 text-white">
          <p className="font-semibold">Temperatūras kontrole</p>
          <ul className="mt-3 space-y-2 text-sm text-gray-300">
            <li className="flex items-center gap-2"><CheckCircle size={14} className="text-brand-400" /> Svaiga pārtika: +2°C līdz +6°C</li>
            <li className="flex items-center gap-2"><CheckCircle size={14} className="text-brand-400" /> Saldēta produkcija: −18°C</li>
            <li className="flex items-center gap-2"><CheckCircle size={14} className="text-brand-400" /> Uzglabāšana pakomātā līdz 48h</li>
          </ul>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="font-semibold text-gray-900">Jautājumi par piegādi?</p>
          <p className="mt-2 text-sm text-gray-500">Sazinies ar mums — atbildēsim darba dienās 9:00–18:00</p>
          <div className="mt-4 space-y-2">
            <a href="tel:+37120031552" className="flex items-center gap-2 text-sm font-medium text-brand-700 hover:underline">
              📞 +371 20031552
            </a>
            <a href="mailto:tirgus@izipizi.lv" className="flex items-center gap-2 text-sm font-medium text-brand-700 hover:underline">
              ✉️ tirgus@izipizi.lv
            </a>
          </div>
        </div>
      </div>

    </div>
  );
}
