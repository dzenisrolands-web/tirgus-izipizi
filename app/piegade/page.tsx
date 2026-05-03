import type { Metadata } from "next";
import Link from "next/link";
import {
  Package, MapPin, Truck, Thermometer, Snowflake,
  CheckCircle, Zap, ArrowRight, ChevronDown,
  Trophy, Home, Timer, Leaf, Route,
} from "lucide-react";
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
            Pārtikas pakomāts, mājas kurjers vai eksprespiegāde tajā pašā dienā — katrs veids piemērots citam brīdim.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            <a href="#veidi" className="rounded-full border border-white/20 px-4 py-2 text-xs font-medium text-white hover:bg-white/10 transition">
              Salīdzināt opcijas
            </a>
            <a href="#zonas" className="inline-flex items-center gap-1.5 rounded-full border border-brand-400/30 bg-brand-400/10 px-4 py-2 text-xs font-semibold text-brand-300 hover:bg-brand-400/20 transition">
              <MapPin size={11} /> Pārbaudīt savu adresi
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
            <div className="relative flex flex-col rounded-2xl border-2 border-brand-400/40 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-400/10">
                  <Package size={20} className="text-brand-700" />
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-bold text-yellow-700">
                  <Trophy size={9} /> Lētākais
                </span>
              </div>
              <h3 className="text-base font-extrabold text-gray-900">Pārtikas pakomāts</h3>
              <p className="mt-0.5 text-xs text-gray-500">Saņem kad ērti — 24/7</p>
              <p className="mt-3 text-xl font-extrabold text-brand-700">3€ par skapīti</p>
              <ul className="mt-3 space-y-1.5 text-xs text-gray-600">
                <li className="flex items-start gap-1.5"><CheckCircle size={12} className="mt-0.5 shrink-0 text-brand-500" /> Pieejams 24/7</li>
                <li className="flex items-start gap-1.5"><CheckCircle size={12} className="mt-0.5 shrink-0 text-brand-500" /> Temp. kontrole +2°C – −18°C</li>
                <li className="flex items-start gap-1.5"><CheckCircle size={12} className="mt-0.5 shrink-0 text-brand-500" /> Uzglabāšana līdz 48h</li>
              </ul>
            </div>

            {/* Kurjers */}
            <div className="relative flex flex-col rounded-2xl border-2 border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100">
                  <Truck size={20} className="text-gray-600" />
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600">
                  <Home size={9} /> Mājas durvīs
                </span>
              </div>
              <h3 className="text-base font-extrabold text-gray-900">Kurjers</h3>
              <p className="mt-0.5 text-xs text-gray-500">Rīga, Pierīga, reģionālie centri</p>
              <p className="mt-3 text-xl font-extrabold text-gray-800">no 5.45€</p>
              <ul className="mt-3 space-y-1.5 text-xs text-gray-600">
                <li className="flex items-start gap-1.5"><CheckCircle size={12} className="mt-0.5 shrink-0 text-gray-400" /> Piegāde uz jebkuru adresi</li>
                <li className="flex items-start gap-1.5"><CheckCircle size={12} className="mt-0.5 shrink-0 text-gray-400" /> 4 zonas (Rīga + reģioni)</li>
                <li className="flex items-start gap-1.5"><CheckCircle size={12} className="mt-0.5 shrink-0 text-gray-400" /> Laika logs pēc izvēles</li>
              </ul>
            </div>

            {/* Ekspres */}
            <div className="relative flex flex-col rounded-2xl border-2 border-yellow-300 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-100">
                  <Zap size={20} className="text-yellow-600" />
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-yellow-400 px-2 py-0.5 text-[10px] font-bold text-yellow-900">
                  <Timer size={9} /> Tajā pašā dienā
                </span>
              </div>
              <h3 className="text-base font-extrabold text-gray-900">Eksprespiegāde</h3>
              <p className="mt-0.5 text-xs text-gray-500">2–5h Rīgā un Pierīgā</p>
              <p className="mt-3 text-xl font-extrabold text-yellow-700">no 6.66€</p>
              <ul className="mt-3 space-y-1.5 text-xs text-gray-600">
                <li className="flex items-start gap-1.5"><CheckCircle size={12} className="mt-0.5 shrink-0 text-yellow-500" /> Piegāde 2–5h pēc pasūtīšanas</li>
                <li className="flex items-start gap-1.5"><CheckCircle size={12} className="mt-0.5 shrink-0 text-yellow-500" /> Vakara logs līdz 22:00</li>
                <li className="flex items-start gap-1.5"><CheckCircle size={12} className="mt-0.5 shrink-0 text-yellow-500" /> Produkti ar ⚡ zīmi</li>
              </ul>
            </div>
          </div>
        </section>

        {/* ── PASTA INDEKSA PĀRBAUDE ── */}
        <section id="zonas" className="scroll-mt-20">
          <PostalZoneLookup />
        </section>

        {/* ── PAKOMĀTA BONUSI — 3 KARTIŅAS ── */}
        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-400 text-center">Kāpēc pakomāts</p>
          <h2 className="mb-8 text-2xl font-extrabold text-gray-900 text-center">3 iemesli izvēlēties pakomātu</h2>
          <div className="grid gap-5 sm:grid-cols-3">

            {/* Izdevīgākais */}
            <div className="rounded-2xl border border-yellow-200 bg-gradient-to-br from-yellow-50 to-white p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-400/20">
                  <Trophy size={18} className="text-yellow-600" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-yellow-600">Izdevīgākais</p>
                  <h3 className="text-base font-extrabold text-gray-900">Vienota cena</h3>
                </div>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">
                3 € par skapīti — neatkarīgi no pakomāta atrašanās vai attāluma. Ja pasūtījumā ir gan dzesēti, gan saldēti produkti — 2 skapīši × 3 €.
              </p>
            </div>

            {/* Ekoloģiskākais */}
            <div className="rounded-2xl border border-green-200 bg-gradient-to-br from-green-50 to-white p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-400/20">
                  <Leaf size={18} className="text-green-600" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-green-600">Zaļākais</p>
                  <h3 className="text-base font-extrabold text-gray-900">Mazāk CO₂</h3>
                </div>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">
                Viens kravas brauciens apkalpo desmitiem sūtījumu vienlaikus, nevis viena kurjera auto uz katru māju atsevišķi. Mazāk iepakojuma, ražotājs pats nogādā.
              </p>
            </div>

            {/* Dienas ritmam */}
            <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-400/20">
                  <Route size={18} className="text-violet-600" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-violet-600">Dienas ritmam</p>
                  <h3 className="text-base font-extrabold text-gray-900">Tavā tempā</h3>
                </div>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">
                Saņem ceļā uz mājām vai no darba, kad ērti. Atvērts agri no rīta un vēlu vakarā. Nav jāmaina ieradumi un nav jāgaida mājās.
              </p>
            </div>

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
