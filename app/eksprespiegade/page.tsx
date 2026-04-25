import type { Metadata } from "next";
import Link from "next/link";
import {
  Zap, ArrowRight, CheckCircle, MapPin, Clock,
  Thermometer, Snowflake, Package, ChevronDown,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Eksprespiegāde | tirgus.izipizi.lv",
  description: "Eksprespiegāde 2–5 stundu laikā Rīgā un apkārtnē — svaigi produkti tieši no ražotāja pie tavām durvīm.",
};

const EXPRESS_ZONES = [
  {
    name: "Rīga (centrs + mikrorajoni)",
    time: "2–3h",
    price: "5.99€",
    available: true,
  },
  {
    name: "Rīgas apkārtne (15 km)",
    time: "3–4h",
    price: "7.99€",
    available: true,
  },
  {
    name: "Jūrmala, Salaspils, Ādaži",
    time: "3–5h",
    price: "9.99€",
    available: true,
  },
  {
    name: "Pārējā Latvija",
    time: "Standarta piegāde",
    price: "no 4.50€",
    available: false,
  },
];

const FAQ = [
  {
    q: "Cik ātrā laikā tiks piegādāts pasūtījums?",
    a: "Rīgā un tuvākajā apkārtnē piegāde notiek 2–5 stundu laikā pēc pasūtījuma apstiprināšanas. Ja pasūti pirms 10:00, piegāde notiek tajā pašā dienā. Pasūtījumi pēc 14:00 tiek piegādāti nākamajā dienā.",
  },
  {
    q: "Vai eksprespiegāde ir pieejama visos produktiem?",
    a: "Eksprespiegāde pieejama tikai produktiem no ražotājiem, kas atrodas Rīgas reģionā un ir aktivizējuši ekspresa piegādes iespēju. Produkta lapā redzēsi, vai eksprespiegāde ir pieejama.",
  },
  {
    q: "Kā tiek uzturēta temperatūra eksprespiegādes laikā?",
    a: "Mūsu kurjeri izmanto temperatūras kontrolētas somas un transportlīdzekļus. Svaigi produkti tiek uzturēti +2°C – +6°C, saldēti produkti — −18°C. Temperatūras žurnāls pieejams pieprasījuma gadījumā.",
  },
  {
    q: "Vai varu norādīt konkrētu piegādes laiku?",
    a: "Jā, pasūtot vari norādīt vēlamo 2h laika logu. Pirms piegādes saņemsi SMS ar precīzu laiku un iespēju mainīt, ja nepieciešams.",
  },
  {
    q: "Ko darīt, ja mani nav mājās piegādes brīdī?",
    a: "Kurjers sazināsies ar tevi pa tālruni. Ja nav iespējas piegādāt, varam piegādi pārcelt vai novirzīt uz tuvāko IziPizi pakomātu.",
  },
];

export default function EksprespiegadePage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-[#192635] px-4 py-16 text-white sm:px-6 lg:px-8 lg:py-20">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-20 top-0 h-80 w-80 rounded-full opacity-15"
            style={{ background: "radial-gradient(circle, #facc15, transparent 70%)" }} />
          <div className="absolute -bottom-10 -left-10 h-60 w-60 rounded-full opacity-10"
            style={{ background: "radial-gradient(circle, #AD47FF, transparent 70%)" }} />
        </div>

        <div className="relative mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-yellow-400/40 bg-yellow-400/10 px-4 py-2">
            <Zap size={14} className="text-yellow-400" />
            <span className="text-sm font-bold text-yellow-300">Eksprespiegāde — JAUNS pakalpojums</span>
          </div>

          <h1 className="mt-6 text-4xl font-extrabold leading-tight sm:text-5xl">
            Svaigi produkti —{" "}
            <span className="text-yellow-400">2–4 stundās</span>
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-gray-300">
            Latvijas ražotāju produkti tieši pie tavām durvīm. Tajā pašā dienā.
            IziPizi ekspresa kurjers uztur temperatūras ķēdi no ražotāja līdz tev — nekādā
            gadījumā nelaužot auksto ķēdi.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link href="/catalog"
              className="inline-flex items-center gap-2 rounded-full px-8 py-3 text-sm font-bold text-[#192635] transition hover:brightness-110"
              style={{ background: "linear-gradient(90deg, #facc15, #fb923c)" }}>
              Pasūtīt ar eksprespiegādi <ArrowRight size={16} />
            </Link>
            <Link href="/piegade"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-6 py-3 text-sm font-medium text-white transition hover:bg-white/10">
              Visas piegādes iespējas
            </Link>
          </div>

          {/* Quick stats */}
          <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { value: "2–5h", label: "Piegādes laiks" },
              { value: "0°C+", label: "Temperatūras kontrole" },
              { value: "Rīga", label: "Piegādes zona" },
              { value: "24/7", label: "Izsekošana reāllaikā" },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-2xl font-extrabold text-yellow-400">{s.value}</p>
                <p className="mt-1 text-xs text-gray-400">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">

        {/* How it works */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold text-gray-900">Kā darbojas eksprespiegāde?</h2>
          <p className="mt-1 text-sm text-gray-500">No pasūtījuma līdz durvīm — 4 vienkārši soļi</p>

          <div className="mt-8 space-y-4">
            {[
              {
                step: "01",
                icon: <Package size={20} />,
                title: "Izvēlies produktus ar ekspresa zīmi",
                desc: "Katalogā filtrē produktus, kas atrodas Rīgas reģionā. Produkta kartītē redzēsi ⚡ eksprespiegādes zīmi un paredzamo piegādes laiku.",
                color: "yellow",
              },
              {
                step: "02",
                icon: <Clock size={20} />,
                title: "Izvēlies piegādes laika logu",
                desc: "Pasūtot norādi vēlamo 2h laika logu (piem., 12:00–14:00). Ja pasūti pirms plkst. 10:00, piegāde pieejama tajā pašā dienā.",
                color: "brand",
              },
              {
                step: "03",
                icon: <Thermometer size={20} />,
                title: "Ražotājs sagatavo, kurjers paņem",
                desc: "Ražotājs sagatavo pasūtījumu temperatūras paketē. IziPizi kurjers paņem sūtījumu un nodrošina aukstās ķēdes uzturēšanu ceļā.",
                color: "cyan",
              },
              {
                step: "04",
                icon: <MapPin size={20} />,
                title: "Saņem pie durvīm",
                desc: "Kurjers piegādā tieši pie tevis. Pirms piegādes saņemsi SMS paziņojumu. Parakstīties nav nepieciešams.",
                color: "green",
              },
            ].map((s, i) => (
              <div key={i} className="flex gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                  s.color === "yellow" ? "bg-yellow-100 text-yellow-600" :
                  s.color === "brand" ? "bg-brand-50 text-brand-700" :
                  s.color === "cyan" ? "bg-cyan-50 text-cyan-600" :
                  "bg-green-50 text-green-600"
                }`}>
                  {s.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold text-gray-400">{s.step}</span>
                    <h3 className="font-bold text-gray-900">{s.title}</h3>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-gray-500">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Zones and pricing */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold text-gray-900">Piegādes zonas un cenas</h2>
          <p className="mt-1 text-sm text-gray-500">
            Eksprespiegāde pieejama atkarībā no ražotāja atrašanās vietas un piegādes adreses
          </p>

          <div className="mt-6 space-y-3">
            {EXPRESS_ZONES.map((z) => (
              <div key={z.name}
                className={`flex items-center justify-between rounded-2xl border p-5 ${
                  z.available
                    ? "border-yellow-200 bg-yellow-50"
                    : "border-gray-100 bg-gray-50 opacity-60"
                }`}>
                <div className="flex items-center gap-3">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-full ${
                    z.available ? "bg-yellow-400/20" : "bg-gray-200"
                  }`}>
                    {z.available
                      ? <Zap size={16} className="text-yellow-600" />
                      : <MapPin size={16} className="text-gray-400" />
                    }
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{z.name}</p>
                    <p className="text-xs text-gray-500">Piegādes laiks: {z.time}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-extrabold ${z.available ? "text-yellow-600" : "text-gray-400"}`}>
                    {z.price}
                  </p>
                  {!z.available && (
                    <p className="text-xs text-gray-400">Nav pieejams</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-700">
            <strong>Svarīgi:</strong> Eksprespiegādes pieejamība atkarīga no ražotāja atrašanās vietas.
            Produkta lapā vienmēr redzēsi, vai eksprespiegāde ir iespējama uz tavu adresi konkrētā pasūtījuma gadījumā.
          </div>
        </section>

        {/* Temperature */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold text-gray-900">Temperatūras kontrole</h2>
          <p className="mt-1 text-sm text-gray-500">Aukstā ķēde nekad netiek pārrāuta</p>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-5">
              <Thermometer size={24} className="text-cyan-600" />
              <h3 className="mt-3 font-bold text-gray-900">Dzesēti produkti</h3>
              <p className="mt-1 text-2xl font-extrabold text-cyan-600">+2°C – +6°C</p>
              <p className="mt-2 text-sm text-gray-500">Svaiga gaļa, piena produkti, dārzeņi, augļi</p>
            </div>
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
              <Snowflake size={24} className="text-blue-600" />
              <h3 className="mt-3 font-bold text-gray-900">Saldēti produkti</h3>
              <p className="mt-1 text-2xl font-extrabold text-blue-600">−18°C</p>
              <p className="mt-2 text-sm text-gray-500">Saldēta gaļa, zivis, ogas, saldētas pārtikas preces</p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
              <Package size={24} className="text-gray-500" />
              <h3 className="mt-3 font-bold text-gray-900">Istabas temperatūra</h3>
              <p className="mt-1 text-2xl font-extrabold text-gray-600">+15°C – +25°C</p>
              <p className="mt-2 text-sm text-gray-500">Medus, konservi, eļļas, sausa pārtika</p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold text-gray-900">Biežāk uzdotie jautājumi</h2>
          <div className="mt-6 space-y-3">
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

        {/* CTA */}
        <section className="overflow-hidden rounded-3xl bg-[#192635] p-8 text-white">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Zap size={20} className="text-yellow-400" />
                <span className="text-lg font-extrabold">Gatavs pasūtīt?</span>
              </div>
              <p className="mt-2 text-gray-400">
                Atver katalogu, izvēlies produktus ar ⚡ zīmi un saņem tos 2–5h laikā.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/catalog"
                className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-[#192635] transition hover:brightness-110"
                style={{ background: "linear-gradient(90deg,#facc15,#fb923c)" }}>
                Atvērt katalogu <ArrowRight size={14} />
              </Link>
              <a href="tel:+37120031552"
                className="inline-flex items-center gap-2 rounded-full border border-white/20 px-6 py-3 text-sm font-medium text-white transition hover:bg-white/10">
                📞 Zvanīt mums
              </a>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
