import type { Metadata } from "next";
import Link from "next/link";
import {
  UserPlus, ClipboardList, PackageCheck, Bell, ShoppingBag, CheckCircle, ArrowRight,
  Truck, CreditCard, Shield, Star, Leaf,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Kā tas strādā | tirgus.izipizi.lv",
  description: "Uzzini kā darbojas tirgus.izipizi.lv — no reģistrācijas līdz pasūtījuma saņemšanai.",
};

const buyerSteps = [
  {
    icon: <ShoppingBag size={22} />,
    title: "Izvēlies produktus",
    desc: "Pārlūko katalogu, filtrē pēc kategorijas, ražotāja vai atrašanās vietas. Pievieno grozam.",
  },
  {
    icon: <Truck size={22} />,
    title: "Izvēlies piegādes veidu",
    desc: "Pakomāts (3 €/skapītis), kurjers uz adresi (no 5.45 €) vai ekspres piegāde Rīgā un Pierīgā (no 6.66 €).",
  },
  {
    icon: <CreditCard size={22} />,
    title: "Apmaksā ar Paysera",
    desc: "Drošs maksājums caur Paysera — bankas pārskaitījums vai maksājumu karte.",
  },
  {
    icon: <Bell size={22} />,
    title: "Saņem pasūtījumu",
    desc: "Pakomāta gadījumā uz e-pastu un SMS atsūtām kodu — izņem 48h laikā. Kurjeru un ekspres piegādi nogādājam tieši uz tavu adresi.",
  },
];

const sellerSteps = [
  {
    icon: <UserPlus size={22} />,
    title: "Reģistrējies kā pārdevējs",
    desc: "Aizpildi pieteikumu ar saimniecības informāciju. Apstiprinājums līdz 24 stundām.",
  },
  {
    icon: <ClipboardList size={22} />,
    title: "Pievieno produktus",
    desc: "Pievienot foto, cenu, daudzumu, kategoriju un izvēlies pakomātu, kurā izvieto produktus.",
  },
  {
    icon: <PackageCheck size={22} />,
    title: "Saņem pasūtījumu",
    desc: "Kad klients pasūta, tu saņem paziņojumu. Ievieto produktu pakomātā norādītajā laika logā.",
  },
  {
    icon: <CreditCard size={22} />,
    title: "Saņem maksājumu",
    desc: "Pēc veiksmīgas izsniegšanas maksājums tiek pārskaitīts uz tavu norādīto kontu.",
  },
];

const features = [
  { icon: <Shield size={20} />, title: "Droši darījumi", desc: "Paysera maksājumu aizsardzība" },
  { icon: <Leaf size={20} />, title: "Vietējie produkti", desc: "Tieši no Latvijas ražotājiem" },
  { icon: <Star size={20} />, title: "Kvalitātes kontrole", desc: "Katrs pārdevējs tiek apstiprināts" },
  { icon: <Truck size={20} />, title: "3 piegādes veidi", desc: "Pakomāts, kurjers vai ekspres" },
];

export default function HowItWorksPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">

      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">Kā tas strādā?</h1>
        <p className="mx-auto mt-3 max-w-xl text-gray-500">
          tirgus.izipizi.lv savieno Latvijas ražotāju produktus ar klientiem visā Latvijā —
          ar piegādi pakomātā, kurjeru uz adresi vai ekspres piegādi tajā pašā dienā.
        </p>
      </div>

      {/* Features */}
      <div className="mt-10 grid gap-4 sm:grid-cols-4">
        {features.map((f) => (
          <div key={f.title} className="rounded-2xl bg-gray-50 p-4 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-brand-700">
              {f.icon}
            </div>
            <p className="mt-2 text-sm font-semibold text-gray-900">{f.title}</p>
            <p className="mt-0.5 text-xs text-gray-500">{f.desc}</p>
          </div>
        ))}
      </div>

      {/* Buyer flow */}
      <div className="mt-14">
        <div className="mb-6 flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full text-[#192635]"
            style={{ background: "linear-gradient(90deg,#53F3A4,#AD47FF)" }}
          >
            <ShoppingBag size={18} />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Pircējam</h2>
        </div>
        <ol className="space-y-5">
          {buyerSteps.map((step, i) => (
            <li key={i} className="flex gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-400/20 text-brand-700">
                {step.icon}
              </span>
              <div>
                <p className="font-semibold text-gray-900">
                  <span className="mr-2 text-xs font-bold text-brand-600">{i + 1}.</span>
                  {step.title}
                </p>
                <p className="mt-0.5 text-sm text-gray-500 leading-relaxed">{step.desc}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-5 flex justify-center">
          <Link href="/catalog" className="btn-primary flex items-center gap-2">
            Skatīt produktus <ArrowRight size={15} />
          </Link>
        </div>
      </div>

      {/* Seller flow */}
      <div className="mt-14">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#192635] text-white">
            <ClipboardList size={18} />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Pārdevējam</h2>
        </div>
        <ol className="space-y-5">
          {sellerSteps.map((step, i) => (
            <li key={i} className="flex gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600">
                {step.icon}
              </span>
              <div>
                <p className="font-semibold text-gray-900">
                  <span className="mr-2 text-xs font-bold text-gray-400">{i + 1}.</span>
                  {step.title}
                </p>
                <p className="mt-0.5 text-sm text-gray-500 leading-relaxed">{step.desc}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-5 flex justify-center">
          <Link href="/register?role=seller" className="btn-primary flex items-center gap-2">
            Kļūt par pārdevēju <ArrowRight size={15} />
          </Link>
        </div>
      </div>

      {/* FAQ */}
      <div className="mt-14">
        <h2 className="text-xl font-bold text-gray-900">Biežāk uzdotie jautājumi</h2>
        <div className="mt-6 space-y-4">
          {[
            {
              q: "Kādi piegādes veidi ir pieejami?",
              a: "Trīs varianti: (1) IziPizi pakomāts — 3 € par skapīti, izņem 24/7 jebkurā no 6+ pakomātiem Latvijā; (2) Kurjers uz adresi — no 5.45 €, atkarībā no zonas, 1–2 darba dienās; (3) Ekspres piegāde Rīgā un Pierīgā — no 6.66 €, 2–5 stundu laikā tajā pašā dienā.",
            },
            {
              q: "Kādā termiņā produkti jāizņem no pakomāta?",
              a: "Produkti pakomātā tiek uzglabāti 48 stundas no brīža, kad pārdevējs tos ievieto. Pēc tam tie tiek atgriezti pārdevējam. Kurjera un ekspres piegādei termiņš netiek piemērots — saņem pie durvīm.",
            },
            {
              q: "Kā saņemšu paziņojumu par pasūtījumu?",
              a: "Pakomāta pasūtījumiem — uz e-pastu un SMS atsūtīsim pakomāta kodu. Kurjeram un ekspres piegādei — kurjers sazināsies pirms ierašanās. Visi atjauninājumi pieejami arī tavā kontā.",
            },
            {
              q: "Ko darīt, ja produkts ir bojāts vai neatbilst aprakstam?",
              a: "Sazinies ar mums pa e-pastu tirgus@izipizi.lv vai telefoniski. Pretenzijas par produkta kvalitāti pieņemam 24 stundu laikā pēc saņemšanas.",
            },
            {
              q: "Vai var pārdot arī saldētas preces?",
              a: "Jā — IziPizi pakomāti atbalsta saldēšanas režīmu −18°C un atdzesēšanu +2°C līdz +6°C. Kurjera un ekspres piegādei izmantojam termo iesaiņojumu.",
            },
            {
              q: "Kāda ir komisija pārdevējiem?",
              a: "Komisija tiek aprēķināta procentuāli no katras pārdošanas (5–20% atkarībā no kategorijas). Konkrēts apmērs tiek apspriests un apstiprināts pirms produkta publicēšanas.",
            },
          ].map((item, i) => (
            <details key={i} className="group rounded-2xl border border-gray-100 bg-white shadow-sm">
              <summary className="flex cursor-pointer items-center justify-between px-5 py-4 font-semibold text-gray-900 marker:hidden list-none">
                {item.q}
                <span className="ml-3 shrink-0 text-gray-400 group-open:rotate-45 transition-transform">+</span>
              </summary>
              <p className="px-5 pb-4 text-sm text-gray-500 leading-relaxed">{item.a}</p>
            </details>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="mt-12 rounded-2xl bg-[#192635] px-8 py-10 text-center text-white">
        <h2 className="text-xl font-bold">Gatavs sākt?</h2>
        <p className="mt-2 text-gray-300">Pircējs vai pārdevējs — izipizi tirgus ir atvērts visiem.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link href="/catalog" className="btn-primary">
            Skatīt produktus
          </Link>
          <Link href="/register?role=seller"
            className="inline-flex items-center justify-center rounded-full border border-white/30 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10">
            Kļūt par pārdevēju
          </Link>
        </div>
        <div className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-gray-300">
          {["Drošs maksājums", "Vietējie produkti", "3 piegādes veidi", "Visā Latvijā"].map((f) => (
            <span key={f} className="flex items-center gap-1.5">
              <CheckCircle size={13} className="text-brand-400" /> {f}
            </span>
          ))}
        </div>
      </div>

    </div>
  );
}
