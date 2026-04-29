import type { Metadata } from "next";
import Link from "next/link";
import {
  Package, MapPin, Truck, Thermometer, Snowflake,
  Clock, CheckCircle, Zap, ArrowRight, ChevronDown, Leaf,
  Trophy, Home, Timer, Route, Bell,
} from "lucide-react";
import { lockers } from "@/lib/mock-data";
import { LockerSubscribeButton } from "@/components/locker-subscribe-button";
import { ZonesMap } from "@/components/zones-map";
import { PostalZoneLookup } from "@/components/postal-zone-lookup";

export const metadata: Metadata = {
  title: "Piegāde — pārtikas pakomāts, kurjers, ekspres",
  description: "Visas piegādes iespējas — IziPizi pārtikas pakomāts 24/7, standarta kurjers pa Latviju vai eksprespiegāde 2–5h Rīgā.",
  openGraph: {
    title: "Piegāde | tirgus.izipizi.lv",
    description: "IziPizi pārtikas pakomāts 24/7, kurjers pa Latviju vai eksprespiegāde 2–5h Rīgā.",
    url: "https://tirgus.izipizi.lv/piegade",
    type: "website" as const,
  },
};

// Cenas ar PVN 21% · avots: izipizi.lv/zonas-cenas (atjaunināts 2026-04-29)
// thermo = viena temperatūras režīma sūtījums (dzesēts VAI saldēts)
// frozen = divu temperatūras režīmu sūtījums (dzesēts UN saldēts)
// MARKETPLACE: tikai 2 temp. režīmi — dzesēts (+2°C – +6°C) un saldēts (-18°C)
const STANDARD_ZONES = [
  {
    zone: "Zona 0",
    area: "Rīgas centrs",
    cities: "Rīga (centrs)",
    codes: "1001, 1002, 1003, 1004, 1009, 1010, 1011, 1012, 1013, 1019, 1045, 1046, 1048, 1050",
    thermo: "5.45",
    frozen: "8.83",
    window: "09:00–12:00, 12:00–18:00, 18:00–22:00",
  },
  {
    zone: "Zona 1",
    area: "Rīgas mikrorajoni + tuvākā Pierīga",
    cities: "Imanta, Pļavnieki, Mežaparks, Jugla, Salaspils, Stopiņi, Ulbroka",
    codes: "1005–1007, 1014–1015, 1021–1084 (daļa), 2101–2167 (daļa)",
    thermo: "6.66",
    frozen: "8.83",
    window: "5h logs (pieteikties iepriek. dienā)",
  },
  {
    zone: "Zona 2",
    area: "Tālākā Pierīga",
    cities: "Mārupe, Olaine, Babīte, Saulkrasti, Ādaži, Carnikava",
    codes: "1016, 1030, 2103–2127 (daļa)",
    thermo: "9.08",
    frozen: "11.25",
    window: "08:00–18:00",
  },
  {
    zone: "Zona 3",
    area: "Reģionālā Latvija",
    cities: "Jelgava, Tukums, Bauska, Ogre, Sigulda, Cēsis, Daugavpils, Valmiera",
    codes: "2008–2016, 2105, 5001, 5015–5071",
    thermo: "10.77",
    frozen: "13.19",
    window: "08:00–18:00",
  },
];

const EXPRESS_ZONES = [
  {
    name: "Zona 0 — Rīgas centrs",
    codes: "1001–1013, 1019, 1045–1046, 1048, 1050",
    thermo: "9.08",
    frozen: "10.29",
    window: "09:00–12:00, 12:00–18:00, 18:00–22:00",
  },
  {
    name: "Zona 1 — Rīgas mikrorajoni + tuvākā Pierīga",
    codes: "1005–1084 (daļa), 2101–2167 (daļa)",
    thermo: "10.89",
    frozen: "12.10",
    window: "5h logs (pieteikties iepriek. dienā)",
  },
  {
    name: "Zona 2 — Tālākā Pierīga",
    codes: "1016, 1030, 2103–2169 (daļa)",
    thermo: "15.13",
    frozen: "16.34",
    window: "08:00–18:00",
  },
];

const LOCKERS = lockers;

const FAQ = [
  {
    q: "Kādas ir laika logu rezervēšanas iespējas?",
    a: "Zona 0 (Rīgas centrs): 09:00–12:00, 12:00–18:00 vai 18:00–22:00. Pieteikties iepriekšējā dienā līdz 20:00. Zonās 1–2: 5 stundu logs darba dienās 08:00–16:00, brīvdienās 08:00–10:00.",
  },
  {
    q: "Vai eksprespiegāde ir pieejama visiem produktiem?",
    a: "Eksprespiegāde pieejama tikai produktiem, kur ražotājs to ir aktivizējis (Zonas 0–2). Produkta kartītē parādīsies ⚡ zīme, ja eksprespiegāde ir iespējama.",
  },
  {
    q: "Ko nozīmē '+2°C VAI −18°C' un '+2°C UN −18°C'?",
    a: "'+2°C VAI −18°C' nozīmē, ka sūtījumā ir vai nu dzesēti, vai saldēti produkti — viena temperatūras zona. '+2°C UN −18°C' nozīmē, ka vienā sūtījumā ir ABĀ dzesēti UN saldēti produkti vienlaikus.",
  },
  {
    q: "Cik ilgi var uzglabāties sūtījums pakomātā?",
    a: "Sūtījums pakomātā tiek uzglabāts līdz 48 stundām ar nepārtrauktu temperatūras kontroli (+2°C–+6°C vai −18°C).",
  },
  {
    q: "Vai varu saņemt pie durvīm, ja dzīvoju ārpus Rīgas?",
    a: "Standarta kurjers pieejams 4 zonās — Rīgā, Pierīgā un reģionālajās lielākajās pilsētās (Zonas 0–3). Eksprespiegāde (tajā pašā dienā) pašlaik pieejama tikai Zonās 0–2 (Rīga un Pierīga).",
  },
  {
    q: "Vai pieejama piegāde uz nelieliem novadiem ārpus zonām?",
    a: "Šobrīd ne — piegāde aprobežota ar 4 zonām. Ja tava adrese nav iekļauta zonās, izvēlies tuvāko pakomātu (3€) vai sazinies ar mums uz birojs@izipizi.lv individuālam risinājumam.",
  },
];

export default function PiegadePage() {
  return (
    <div className="bg-white">

      {/* ── HERO ── */}
      <div className="relative overflow-hidden bg-[#192635] px-4 py-16 text-white sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute -top-32 -right-32 h-80 w-80 rounded-full bg-brand-400/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-64 w-64 rounded-full bg-purple-500/10 blur-3xl" />
        <div className="relative mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-400/20 px-3 py-1 text-xs font-medium text-brand-300">
            <Truck size={12} /> Piegāde
          </span>
          <h1 className="mt-4 text-3xl font-extrabold leading-tight sm:text-4xl">
            Daudz veidu kā saņemt —<br className="hidden sm:block" />
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(90deg,#53F3A4,#AD47FF)" }}>
              izvēlies šoreiz ērtāko
            </span>
          </h1>
          <p className="mt-3 text-base text-gray-400 max-w-xl mx-auto">
            Pārtikas pakomāts, mājas kurjers vai eksprespiegāde tajā pašā dienā — katrs veids piemērots citam brīdim. Nav obligāts viens risinājums uz visiem laikiem.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            <a href="#veidi" className="rounded-full border border-white/20 px-4 py-2 text-xs font-medium text-white hover:bg-white/10 transition">
              Salīdzināt opcijas
            </a>
            <a href="#izdevigaks" className="inline-flex items-center gap-1.5 rounded-full border border-yellow-400/30 bg-yellow-400/10 px-4 py-2 text-xs font-semibold text-yellow-300 hover:bg-yellow-400/20 transition">
              <Trophy size={11} /> Izdevīgākais
            </a>
            <a href="#ekologiskaks" className="inline-flex items-center gap-1.5 rounded-full border border-green-400/30 bg-green-400/10 px-4 py-2 text-xs font-semibold text-green-300 hover:bg-green-400/20 transition">
              <Leaf size={11} /> Ekoloģiskākais
            </a>
            <a href="#dienas-ritms" className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/30 bg-violet-400/10 px-4 py-2 text-xs font-semibold text-violet-300 hover:bg-violet-400/20 transition">
              <Route size={11} /> Dienas ritmam
            </a>
            <a href="#ekspres" className="inline-flex items-center gap-1.5 rounded-full border border-brand-400/30 bg-brand-400/10 px-4 py-2 text-xs font-semibold text-brand-300 hover:bg-brand-400/20 transition">
              <Zap size={11} /> Ekspres Rīgā
            </a>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8 space-y-20">

        {/* ── COMPARISON CARDS ── */}
        <section id="veidi" className="scroll-mt-20">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-400 text-center">Piegādes veidi</p>
          <h2 className="mb-8 text-2xl font-extrabold text-gray-900 text-center">Trīs veidi — viens par labu tev šodien</h2>

          <div className="grid gap-5 sm:grid-cols-3">

            {/* Pārtikas pakomāts */}
            <div className="relative flex flex-col rounded-2xl border-2 border-brand-400/40 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-start justify-between gap-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-400/10">
                  <Package size={24} className="text-brand-700" />
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-bold text-yellow-700">
                    <Trophy size={9} /> Lētākais
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">
                    <Leaf size={9} /> Zaļākais
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">
                    <Route size={9} /> Dienas ritmam
                  </span>
                </div>
              </div>
              <h3 className="text-lg font-extrabold text-gray-900">Pārtikas pakomāts</h3>
              <p className="mt-1 text-sm text-gray-500">Saņem kad ērti — 24/7</p>
              <p className="mt-4 text-2xl font-extrabold text-brand-700">3€ par skapīti</p>
              <ul className="mt-4 space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2"><CheckCircle size={14} className="mt-0.5 shrink-0 text-brand-500" /> Pieejams 24/7, saņem savā laikā</li>
                <li className="flex items-start gap-2"><CheckCircle size={14} className="mt-0.5 shrink-0 text-brand-500" /> Temperatūras kontrole +2°C – −18°C</li>
                <li className="flex items-start gap-2"><CheckCircle size={14} className="mt-0.5 shrink-0 text-brand-500" /> Uzglabāšana pakomātā līdz 48h</li>
              </ul>
              <p className="mt-5 rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-500">
                <span className="font-semibold text-gray-700">Labākais ja</span> — negribi gaidīt mājās kurjeru un vēlies doties pakomātā tad, kad iziet garām.
              </p>
              <a href="#pakomati-saraksts" className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">
                Skatīt pakomātus <ArrowRight size={12} />
              </a>
            </div>

            {/* Kurjers */}
            <div className="relative flex flex-col rounded-2xl border-2 border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-start justify-between gap-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100">
                  <Truck size={24} className="text-gray-600" />
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600">
                  <Home size={9} /> Mājas durvīs
                </span>
              </div>
              <h3 className="text-lg font-extrabold text-gray-900">Kurjers</h3>
              <p className="mt-1 text-sm text-gray-500">Rīga, Pierīga, reģionālie centri</p>
              <p className="mt-4 text-2xl font-extrabold text-gray-800">no 5.45€</p>
              <ul className="mt-4 space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2"><CheckCircle size={14} className="mt-0.5 shrink-0 text-gray-400" /> Piegāde uz jebkuru adresi</li>
                <li className="flex items-start gap-2"><CheckCircle size={14} className="mt-0.5 shrink-0 text-gray-400" /> 4 zonas (Rīga, Pierīga, lielākās pilsētas)</li>
                <li className="flex items-start gap-2"><CheckCircle size={14} className="mt-0.5 shrink-0 text-gray-400" /> Laika logs pēc izvēles</li>
              </ul>
              <p className="mt-5 rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-500">
                <span className="font-semibold text-gray-700">Labākais ja</span> — nevēlies iet nekur, vai pasūti lielu daudzumu ko nevar ērti nest no pakomāta.
              </p>
              <a href="#kurjers" className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-gray-600 hover:underline">
                Skatīt kurjera cenas <ArrowRight size={12} />
              </a>
            </div>

            {/* Ekspres */}
            <div className="relative flex flex-col rounded-2xl border-2 border-yellow-300 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-start justify-between gap-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-yellow-100">
                  <Zap size={24} className="text-yellow-600" />
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="inline-flex items-center gap-1 rounded-full bg-yellow-400 px-2 py-0.5 text-[10px] font-bold text-yellow-900">
                    <Timer size={9} /> Tajā pašā dienā
                  </span>
                  <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-semibold text-yellow-700">Tikai Rīgā</span>
                </div>
              </div>
              <h3 className="text-lg font-extrabold text-gray-900">Eksprespiegāde</h3>
              <p className="mt-1 text-sm text-gray-500">2–5h Rīgā un Pierīgā</p>
              <p className="mt-4 text-2xl font-extrabold text-yellow-700">no 6.66€</p>
              <ul className="mt-4 space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2"><CheckCircle size={14} className="mt-0.5 shrink-0 text-yellow-500" /> Piegāde 2–5h pēc pasūtīšanas</li>
                <li className="flex items-start gap-2"><CheckCircle size={14} className="mt-0.5 shrink-0 text-yellow-500" /> Vakara logs līdz 22:00 (Zona 0)</li>
                <li className="flex items-start gap-2"><CheckCircle size={14} className="mt-0.5 shrink-0 text-yellow-500" /> Produkti ar ⚡ zīmi</li>
              </ul>
              <p className="mt-5 rounded-xl bg-yellow-50 px-3 py-2 text-xs text-yellow-700">
                <span className="font-semibold">Labākais ja</span> — pasūtīji šodien un gribi vakariņās lietot tos produktus, ko tikko ieraudzīji.
              </p>
              <a href="#ekspres" className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-yellow-700 hover:underline">
                Skatīt ekspres zonas <ArrowRight size={12} />
              </a>
            </div>
          </div>
        </section>

        {/* ── THREE HIGHLIGHT SECTIONS ── */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">

          {/* Izdevīgākais */}
          <section id="izdevigaks" className="scroll-mt-20 rounded-2xl border border-yellow-200 bg-gradient-to-br from-yellow-50 to-white p-7">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-yellow-400/20">
                <Trophy size={22} className="text-yellow-600" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-yellow-600">Izdevīgākā izvēle</p>
                <h3 className="text-lg font-extrabold text-gray-900">Pārtikas pakomāts</h3>
              </div>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              Pārtikas pakomāts ir vienkārši lētākais variants — viena vienota cena
              neatkarīgi no pakomāta atrašanās vietas vai attāluma.
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              <li className="flex items-start gap-2 text-gray-600">
                <CheckCircle size={15} className="mt-0.5 shrink-0 text-yellow-500" />
                <span><strong className="text-gray-900">3€ par skapīti</strong> — viena temperatūras zona</span>
              </li>
              <li className="flex items-start gap-2 text-gray-600">
                <CheckCircle size={15} className="mt-0.5 shrink-0 text-yellow-500" />
                <span>Ja pasūtījumā ir gan dzesēti, gan saldēti produkti — <strong className="text-gray-900">2 skapīši × 3€</strong></span>
              </li>
              <li className="flex items-start gap-2 text-gray-600">
                <CheckCircle size={15} className="mt-0.5 shrink-0 text-yellow-500" />
                Nav jāmaksā par konkrētu laika logu
              </li>
              <li className="flex items-start gap-2 text-gray-600">
                <CheckCircle size={15} className="mt-0.5 shrink-0 text-yellow-500" />
                Saņem jebkurā laikā 24/7 — bez piemaksas
              </li>
            </ul>
            <a href="#pakomati-saraksts" className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-yellow-400 px-4 py-1.5 text-xs font-bold text-yellow-900 hover:bg-yellow-500 transition">
              Skatīt pakomātus <ArrowRight size={12} />
            </a>
          </section>

          {/* Ekoloģiskākais */}
          <section id="ekologiskaks" className="scroll-mt-20 rounded-2xl border border-green-200 bg-gradient-to-br from-green-50 to-white p-7">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-400/20">
                <Leaf size={22} className="text-green-600" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-green-600">Ekoloģiskākā izvēle</p>
                <h3 className="text-lg font-extrabold text-gray-900">Pārtikas pakomāts</h3>
              </div>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              Pārtikas pakomāts ir arī zaļākais variants — viens kravas brauciens apkalpo <strong>desmitiem sūtījumu</strong> vienlaikus, nevis viena kurjera auto uz katru mājas adresi atsevišķi.
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              <li className="flex items-start gap-2 text-gray-600">
                <Leaf size={15} className="mt-0.5 shrink-0 text-green-500" />
                Pakopveida piegāde = mazāk CO₂ uz sūtījumu
              </li>
              <li className="flex items-start gap-2 text-gray-600">
                <Leaf size={15} className="mt-0.5 shrink-0 text-green-500" />
                Nav atkārtotu piegāžu, ja tevis nav mājās
              </li>
              <li className="flex items-start gap-2 text-gray-600">
                <Leaf size={15} className="mt-0.5 shrink-0 text-green-500" />
                Mazāk iepakojuma nekā individuālai kurjerpostai
              </li>
              <li className="flex items-start gap-2 text-gray-600">
                <Leaf size={15} className="mt-0.5 shrink-0 text-green-500" />
                Ražotājs pats nogādā — nav starpnieku
              </li>
            </ul>
            <a href="#pakomati-saraksts" className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-green-500 px-4 py-1.5 text-xs font-bold text-white hover:bg-green-600 transition">
              Atrast tuvāko pakomātu <ArrowRight size={12} />
            </a>
          </section>

          {/* Dienas ritmam */}
          <section id="dienas-ritms" className="scroll-mt-20 rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-7">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-400/20">
                <Route size={22} className="text-violet-600" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-violet-600">Dienas ritmam</p>
                <h3 className="text-lg font-extrabold text-gray-900">Pārtikas pakomāts</h3>
              </div>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              Nav jāmaina ieradumi — pakomāts iekļaujas tavā dienā pats. Garām ejot, kad ērti. Bez gaidīšanas mājās, bez plānošanas.
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              <li className="flex items-start gap-2 text-gray-600">
                <Route size={15} className="mt-0.5 shrink-0 text-violet-500" />
                Saņem ceļā uz mājām vai no darba
              </li>
              <li className="flex items-start gap-2 text-gray-600">
                <Route size={15} className="mt-0.5 shrink-0 text-violet-500" />
                48h uzglabāšana — nav jāsteidzas
              </li>
              <li className="flex items-start gap-2 text-gray-600">
                <Route size={15} className="mt-0.5 shrink-0 text-violet-500" />
                Atvērts agri no rīta un vēlu vakarā
              </li>
              <li className="flex items-start gap-2 text-gray-600">
                <Route size={15} className="mt-0.5 shrink-0 text-violet-500" />
                6 vietas — lielākā daļa pie degvielas uzpildes vai tirgus
              </li>
            </ul>
            <a href="#pakomati-saraksts" className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-violet-500 px-4 py-1.5 text-xs font-bold text-white hover:bg-violet-600 transition">
              Skatīt vietas <ArrowRight size={12} />
            </a>
          </section>

        </div>

        {/* ── ZONU PĀRKLĀJUMA KARTE ── */}
        <section id="zonas" className="scroll-mt-20">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100">
              <MapPin size={22} className="text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Piegādes pārklājums</h2>
              <p className="text-sm text-gray-500">4 zonas — Rīga, Pierīga un reģionālie centri</p>
            </div>
          </div>

          {/* Postal code lookup — most precise way to check */}
          <div className="mb-6">
            <PostalZoneLookup />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Interactive Latvia map */}
            <div>
              <ZonesMap />
              <p className="mt-2 text-center text-xs text-gray-400">
                Klikšķini uz zonas vai pilsētas. Precizēšanai augšā meklē pēc pasta indeksa.
              </p>
            </div>

            {/* Zone summary cards */}
            <div className="space-y-2">
              {STANDARD_ZONES.map((z, i) => {
                const colors = [
                  { bg: "bg-green-50",  border: "border-green-200",  text: "text-green-700",  badge: "bg-green-500" },
                  { bg: "bg-blue-50",   border: "border-blue-200",   text: "text-blue-700",   badge: "bg-blue-500" },
                  { bg: "bg-amber-50",  border: "border-amber-200",  text: "text-amber-700",  badge: "bg-amber-500" },
                  { bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-700", badge: "bg-purple-500" },
                ][i];
                return (
                  <div key={z.zone} className={`rounded-xl border ${colors.border} ${colors.bg} p-3`}>
                    <div className="flex items-center gap-2">
                      <span className={`flex h-7 w-7 items-center justify-center rounded-full ${colors.badge} text-xs font-bold text-white`}>
                        {z.zone.replace("Zona ", "")}
                      </span>
                      <p className={`font-bold text-sm ${colors.text}`}>{z.area}</p>
                    </div>
                    <p className="mt-1.5 text-xs text-gray-600">{z.cities}</p>
                    <div className="mt-2 flex items-center gap-3 text-[10px] text-gray-500">
                      <span>1 temp: <strong className="text-gray-900">{z.thermo}€</strong></span>
                      <span>2 temp: <strong className="text-gray-900">{z.frozen}€</strong></span>
                    </div>
                  </div>
                );
              })}
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-3 text-center">
                <p className="text-xs text-gray-500">
                  Zonas 4+ (attālie reģioni) <strong>netiek apkalpotas</strong>.
                  Pārbaudi savu indeksu — ja nav sarakstā, izvēlies pakomātu vai sazinies.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── KURJERS PRICES ── */}
        <section id="kurjers" className="scroll-mt-20">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100">
              <Truck size={22} className="text-gray-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Kurjera cenas pa zonām</h2>
              <p className="text-sm text-gray-500">Rīga, Pierīga un reģionālie centri (Zonas 0–3)</p>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Zona</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-cyan-700">+2°C vai −18°C</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-blue-700">+2°C un −18°C</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 hidden md:table-cell">Laika logs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {STANDARD_ZONES.map((z) => (
                    <tr key={z.zone} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-gray-900">{z.zone}</p>
                        <p className="text-xs text-gray-500">{z.area}</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">{z.cities}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{z.codes}</p>
                      </td>
                      <td className="px-3 py-3 text-center font-bold text-cyan-700">{z.thermo}€</td>
                      <td className="px-3 py-3 text-center font-bold text-blue-700">{z.frozen}€</td>
                      <td className="px-3 py-3 text-xs text-gray-500 hidden md:table-cell">{z.window}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
              <span>Pieteikšanās laika logam: iepriekšējā dienā līdz 20:00 ·
                Kontakts: <a href="tel:+37128807456" className="font-medium text-brand-700">+371 28807456</a> ·
                <a href="mailto:birojs@izipizi.lv" className="font-medium text-brand-700 ml-1">birojs@izipizi.lv</a>
              </span>
              <span className="text-gray-400">PVN iekļauts</span>
            </div>
          </div>
        </section>

        {/* ── EKSPRES PRICES ── */}
        <section id="ekspres" className="scroll-mt-20">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-100">
              <Zap size={22} className="text-yellow-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Eksprespiegāde
                <span className="ml-2 rounded-full bg-yellow-400/20 px-2 py-0.5 text-xs font-bold text-yellow-700">JAUNS</span>
              </h2>
              <p className="text-sm text-gray-500">Rīga un Pierīga · Tajā pašā dienā</p>
            </div>
          </div>

          <div className="rounded-2xl border border-yellow-200 bg-white shadow-sm overflow-hidden mb-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-yellow-50 border-b border-yellow-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Zona</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-cyan-700">+2°C vai −18°C</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-blue-700">+2°C un −18°C</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 hidden md:table-cell">Laika logs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-yellow-50">
                  {EXPRESS_ZONES.map((z) => (
                    <tr key={z.name} className="hover:bg-yellow-50/50">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-gray-900 text-xs leading-snug">{z.name}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{z.codes}</p>
                      </td>
                      <td className="px-3 py-3 text-center font-bold text-cyan-700">{z.thermo}€</td>
                      <td className="px-3 py-3 text-center font-bold text-blue-700">{z.frozen}€</td>
                      <td className="px-3 py-3 text-xs text-gray-500 hidden md:table-cell">{z.window}</td>
                    </tr>
                  ))}
                  <tr className="opacity-40">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-700 text-xs">Zona 3+ — Pārējā Latvija</p>
                    </td>
                    <td colSpan={2} className="px-3 py-3 text-center text-xs text-gray-500">Nav pieejams</td>
                    <td className="hidden md:table-cell" />
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="border-t border-yellow-100 bg-yellow-50 px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs text-yellow-800">
              <span>Zona 0: pieteikties iepriekšējā dienā līdz 20:00 · Zona 1–2: darba dienās 08:00–16:00</span>
              <span className="text-yellow-600">PVN iekļauts</span>
            </div>
          </div>

          <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
            <strong>Kā zināt, vai produktam pieejama eksprespiegāde?</strong>{" "}
            Produkta kartītē un lapā redzēsi ⚡ zīmi. Ražotāji Rīgā un Pierīgā to aktivizē paši.
          </div>
        </section>

        {/* ── PAKOMĀTU SARAKSTS ── */}
        <section id="pakomati-saraksts" className="scroll-mt-20">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50">
              <MapPin size={22} className="text-brand-700" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Pārtikas pakomātu atrašanās vietas</h2>
              <p className="text-sm text-gray-500">
                6 termālie pakomāti Latvijā ·{" "}
                <a href="https://www.izipizi.lv/pakomati" target="_blank" rel="noopener" className="text-brand-600 hover:underline">
                  pilns saraksts izipizi.lv
                </a>
              </p>
            </div>
          </div>

          <div className="mb-4 flex items-start gap-2 rounded-xl bg-brand-50 border border-brand-100 px-4 py-3 text-sm text-brand-800">
            <Bell size={15} className="mt-0.5 shrink-0" />
            <p className="text-xs leading-relaxed">
              <strong>Abonē savu pakomātu</strong> un saņem paziņojumu, kad kāds no ražotājiem
              ievietos jaunu produktu — svaiga gaļa, dārzeņi, maize tiešā veidā uz pakomātu.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {LOCKERS.map((l) => (
              <div key={l.id} className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm hover:border-brand-200 transition">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50">
                    <MapPin size={16} className="text-brand-700" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 text-sm">{l.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{l.address}</p>
                    <p className="text-xs text-gray-400">{l.city}</p>
                    <span className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      l.hours === "24/7" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                    }`}>
                      <Clock size={8} /> {l.hours}
                    </span>
                  </div>
                </div>
                <LockerSubscribeButton lockerId={l.id} className="self-start" />
              </div>
            ))}
          </div>
        </section>

        {/* ── TEMPERATURE ── */}
        <section>
          <h2 className="mb-6 text-xl font-bold text-gray-900">Temperatūras ķēde</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-5">
              <Thermometer size={24} className="text-cyan-600" />
              <h3 className="mt-3 font-bold text-gray-900">Dzesēti produkti</h3>
              <p className="mt-1 text-2xl font-extrabold text-cyan-600">+2°C – +6°C</p>
              <p className="mt-2 text-sm text-gray-500">Svaiga gaļa, piena produkti, dārzeņi, olas, zivis</p>
            </div>
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
              <Snowflake size={24} className="text-blue-600" />
              <h3 className="mt-3 font-bold text-gray-900">Saldēti produkti</h3>
              <p className="mt-1 text-2xl font-extrabold text-blue-600">−18°C</p>
              <p className="mt-2 text-sm text-gray-500">Saldēta gaļa, zivis, ogas, pelmeņi</p>
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section>
          <h2 className="mb-6 text-xl font-bold text-gray-900">Biežāk uzdotie jautājumi</h2>
          <div className="space-y-3">
            {FAQ.map((f, i) => (
              <details key={i} className="group rounded-2xl border border-gray-100 bg-white shadow-sm">
                <summary className="flex cursor-pointer items-center justify-between gap-4 p-5">
                  <span className="font-semibold text-gray-900">{f.q}</span>
                  <ChevronDown size={16} className="shrink-0 text-gray-400 transition group-open:rotate-180" />
                </summary>
                <p className="px-5 pb-5 text-sm leading-relaxed text-gray-500">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ── BOTTOM CTA ── */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl bg-[#192635] p-6 text-white">
            <p className="font-bold text-lg">Viss ir gatavs</p>
            <p className="mt-2 text-sm text-gray-300">
              Izvēlies produktus — piegādes veidu izvēlēsies pasūtīšanas solī, atkarībā no tā, kas šodien ērtāk.
            </p>
            <div className="mt-4 space-y-2 text-sm text-gray-300">
              <p className="flex items-center gap-2"><CheckCircle size={14} className="text-brand-400 shrink-0" /> Pārtikas pakomāts 24/7 · lētākais</p>
              <p className="flex items-center gap-2"><CheckCircle size={14} className="text-brand-400 shrink-0" /> Kurjers · mājas durvīs</p>
              <p className="flex items-center gap-2"><CheckCircle size={14} className="text-brand-400 shrink-0" /> Ekspres · tajā pašā dienā Rīgā</p>
            </div>
            <Link href="/catalog"
              className="mt-5 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-[#192635] transition hover:brightness-110"
              style={{ background: "linear-gradient(90deg,#53F3A4,#AD47FF)" }}>
              Skatīt produktus <ArrowRight size={14} />
            </Link>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <p className="font-bold text-gray-900">Jautājumi par piegādi?</p>
            <p className="mt-2 text-sm text-gray-500">Darba dienās 9:00–18:00</p>
            <div className="mt-4 space-y-2">
              <a href="tel:+37128807456" className="flex items-center gap-2 text-sm font-medium text-brand-700 hover:underline">
                📞 +371 28807456
              </a>
              <a href="mailto:birojs@izipizi.lv" className="flex items-center gap-2 text-sm font-medium text-brand-700 hover:underline">
                ✉️ birojs@izipizi.lv
              </a>
            </div>
            <p className="mt-4 text-xs text-gray-400">
              Cenas ar PVN 21% ·{" "}
              <a href="https://www.izipizi.lv/zonas-cenas" target="_blank" rel="noopener" className="text-brand-600 hover:underline">
                avots: izipizi.lv/zonas-cenas
              </a>
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
