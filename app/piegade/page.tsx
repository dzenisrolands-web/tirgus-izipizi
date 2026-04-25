import type { Metadata } from "next";
import Link from "next/link";
import {
  Package, MapPin, Truck, Thermometer, Snowflake,
  Clock, CheckCircle, Zap, ArrowRight, Info,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Piegāde | tirgus.izipizi.lv",
  description: "Piegādes iespējas — IziPizi pakomāts 24/7, standarta kurjers pa Latviju vai eksprespiegāde 2–5h Rīgā.",
};

const LOCKER_SIZES = [
  { size: "S / M", desc: "Standarta · istabas t°", price: "1.50 €", promo: true },
  { size: "M",     desc: "Dzesēts  +2°C – +6°C",  price: "2.50 €", promo: false },
  { size: "L",     desc: "Saldēts  −18°C",          price: "3.99 €", promo: false },
  { size: "XL",    desc: "Liels / korporatīvs",     price: "4.50 €", promo: false },
];

const COURIER_ZONES = [
  { zone: "Zona 0", area: "Rīga un tuvākā apkārtne",         noThermo: "4.50", thermo: "6.40", frozen: "7.30" },
  { zone: "Zona 1", area: "Pierīgas novads, Jūrmala, Salaspils", noThermo: "5.50", thermo: "7.00", frozen: "8.00" },
  { zone: "Zona 2", area: "Pārējā Latvija",                   noThermo: "7.50", thermo: "8.40", frozen: "9.30" },
];

export default function PiegadePage() {
  return (
    <div>
      {/* Header */}
      <div className="bg-[#192635] px-4 py-14 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-400/20 px-3 py-1 text-xs font-medium text-brand-400">
            <Truck size={12} /> Piegādes iespējas
          </span>
          <h1 className="mt-4 text-3xl font-extrabold sm:text-4xl">Piegāde no ražotāja — pie tevis</h1>
          <p className="mt-3 text-gray-400">
            IziPizi infrastruktūra nodrošina temperatūras kontrolētu sūtījumu ceļu —
            no ražotāja pakomāta līdz tavai adresei vai tuvākajam lokerim.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/catalog"
              className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold text-[#192635]"
              style={{ background: "linear-gradient(90deg,#53F3A4,#AD47FF)" }}>
              Skatīt produktus <ArrowRight size={14} />
            </Link>
            <Link href="/eksprespiegade"
              className="inline-flex items-center gap-2 rounded-full border border-yellow-400/40 px-6 py-2.5 text-sm font-medium text-yellow-300 hover:bg-yellow-400/10 transition">
              <Zap size={14} /> Eksprespiegāde Rīgā
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">

        {/* Journey */}
        <div className="mb-12">
          <h2 className="text-xl font-bold text-gray-900">Kā notiek piegāde?</h2>
          <p className="mt-1 text-sm text-gray-500">Pilnais ceļš no ražotāja līdz tev — visā kontrolēts</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-4">
            {[
              { icon: <Package size={20} />, step: "1", title: "Ražotājs ievieto", desc: "Pārdevējs sagatavo pasūtījumu un ievieto savā mājas pakomātā vai nodod IziPizi kurjeram." },
              { icon: <Thermometer size={20} />, step: "2", title: "Temperatūras ķēde", desc: "IziPizi sistēma uzrauga temperatūru no ražotāja līdz saņemšanai — saldēts vai dzesēts." },
              { icon: <MapPin size={20} />, step: "3", title: "Maršrutēšana", desc: "Sūtījums nonāk tuvākajā IziPizi pakomātā vai tiek nodots kurjeram uz tavu adresi." },
              { icon: <CheckCircle size={20} />, step: "4", title: "Tu saņem", desc: "Kods uz e-pastu vai SMS. Pakomātā — 24/7. Kurjers — norādītajā laika logā." },
            ].map((s, i) => (
              <div key={i} className="rounded-2xl bg-gray-50 p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-400/20 text-brand-700">
                  {s.icon}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#192635] text-[10px] font-bold text-white">{s.step}</span>
                  <p className="font-semibold text-gray-900">{s.title}</p>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Express CTA banner */}
        <div className="mb-12 flex flex-col gap-4 overflow-hidden rounded-2xl bg-[#192635] p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Zap size={18} className="text-yellow-400" />
              <span className="font-bold text-white">Eksprespiegāde Rīgā — 2–5 stundās</span>
              <span className="rounded-full bg-yellow-400/20 px-2 py-0.5 text-[10px] font-bold text-yellow-400">JAUNS</span>
            </div>
            <p className="mt-1 text-sm text-gray-400">Pasūti no rīta — saņem pusdienā. No ražotāja tieši pie tavām durvīm tajā pašā dienā.</p>
          </div>
          <Link href="/eksprespiegade"
            className="inline-flex shrink-0 items-center gap-2 rounded-full border border-yellow-400/40 px-5 py-2.5 text-sm font-medium text-yellow-300 transition hover:bg-yellow-400/10">
            Uzzināt vairāk <ArrowRight size={14} />
          </Link>
        </div>

        {/* Two delivery options */}
        <div className="mb-12 grid gap-6 sm:grid-cols-2">

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
                      <span className="rounded-full px-2 py-0.5 text-xs font-bold text-[#192635]"
                        style={{ background: "linear-gradient(90deg, #53F3A4, #AD47FF)" }}>
                        Akcija
                      </span>
                    )}
                    <span className="font-bold text-gray-900">{s.price}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 space-y-1.5 text-xs text-gray-500">
              <p className="flex items-center gap-1.5"><Thermometer size={12} className="text-brand-600" /> +2°C – +6°C — svaigai pārtikai</p>
              <p className="flex items-center gap-1.5"><Snowflake size={12} className="text-blue-400" /> −18°C — saldētai produkcijai</p>
              <p className="flex items-center gap-1.5"><Clock size={12} className="text-gray-400" /> Saņemšana 24/7 jebkurā laikā</p>
              <p className="flex items-center gap-1.5"><Info size={12} className="text-gray-400" /> Uzglabāšana pakomātā līdz 48h</p>
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
                <p className="text-xs text-gray-500">Temperatūras režīmā · Cenas bez PVN</p>
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
              * Piegāde 5 stundu laikā pēc pieteikuma (Zona 0 un 1). Zona 2 — nākamajā darba dienā.
            </p>
          </div>
        </div>

        {/* Delivery availability note */}
        <div className="mb-12 rounded-2xl border border-blue-100 bg-blue-50 p-5">
          <div className="flex gap-3">
            <Info size={18} className="mt-0.5 shrink-0 text-blue-500" />
            <div>
              <p className="font-semibold text-blue-800">Piegādes pieejamība atkarīga no ražotāja atrašanās vietas</p>
              <p className="mt-1 text-sm text-blue-700">
                Katrs ražotājs pats nosaka, kuru piegādes veidu viņš piedāvā — mājas pakomātu, kurjeru vai eksprespiegādi.
                Konkrētā produkta lapā redzēsi pieejamās piegādes iespējas un aptuveno laiku.
                Eksprespiegāde pieejama tikai no ražotājiem Rīgas reģionā.
              </p>
            </div>
          </div>
        </div>

        {/* Info boxes */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl bg-[#192635] p-5 text-white">
            <p className="font-semibold">Temperatūras kontrole visā ķēdē</p>
            <ul className="mt-3 space-y-2 text-sm text-gray-300">
              <li className="flex items-center gap-2"><CheckCircle size={14} className="text-brand-400 shrink-0" /> Svaiga pārtika: +2°C – +6°C</li>
              <li className="flex items-center gap-2"><CheckCircle size={14} className="text-brand-400 shrink-0" /> Saldēta produkcija: −18°C</li>
              <li className="flex items-center gap-2"><CheckCircle size={14} className="text-brand-400 shrink-0" /> Uzglabāšana pakomātā līdz 48h</li>
              <li className="flex items-center gap-2"><CheckCircle size={14} className="text-brand-400 shrink-0" /> Reāllaika izsekošana</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="font-semibold text-gray-900">Jautājumi par piegādi?</p>
            <p className="mt-2 text-sm text-gray-500">Atbildēsim darba dienās 9:00–18:00</p>
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
    </div>
  );
}
