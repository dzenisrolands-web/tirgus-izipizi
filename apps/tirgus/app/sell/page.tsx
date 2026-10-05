import Link from "next/link";
import { CheckCircle, ArrowRight, Clock, Percent, Shield, CreditCard } from "lucide-react";

export const metadata = {
  title: "Sākt pārdot — pievienojies kā ražotājs",
  description:
    "Pārdod savus produktus caur IziPizi pārtikas pakomātu tīklu. Bezmaksas reģistrācija. Komisija tikai no pārdošanas. Apstiprināšana 24h laikā.",
  openGraph: {
    title: "Sākt pārdot tirgus.izipizi.lv — pievienojies kā ražotājs",
    description: "Pārdod savus produktus caur IziPizi pārtikas pakomātu tīklu. Komisija tikai no pārdošanas.",
    url: "https://tirgus.izipizi.lv/sell",
    type: "website" as const,
  },
};

const steps = [
  {
    num: "1",
    title: "Aizpildi pieteikumu",
    desc: "Reģistrējies, norādi savas saimniecības informāciju un gaidi apstiprinājumu (līdz 24h).",
  },
  {
    num: "2",
    title: "Izvieto produktus",
    desc: "Pievieno savus produktus — foto, cena, daudzums, derīguma termiņš, pārtikas pakomāta vieta.",
  },
  {
    num: "3",
    title: "Saņem pasūtījumu",
    desc: "Kad klients pasūta, tu saņem paziņojumu un laika logs ielādei pārtikas pakomātā.",
  },
  {
    num: "4",
    title: "Ievieto pārtikas pakomātā",
    desc: "Ievieto produktus izipizi pārtikas pakomātā, iezīmē kā gatavu — klients saņem kodu.",
  },
  {
    num: "5",
    title: "Saņem maksājumu",
    desc: "Maksājumi tiek apkopoti un pārskaitīti 2× mēnesī (1. un 16. datumā) uz tavu bankas kontu (IBAN). Tirgus izraksta reversais rēķins (self-billing) tavā vārdā — dokumentus kārtojam mēs.",
  },
];

const benefits = [
  { icon: <Percent size={20} />, title: "15% komisija (bez PVN)", desc: "15% no cenas bez produkta PVN + 21% PVN par komisijas pakalpojumu. Produktam ar 21% PVN tu saņem 85%." },
  { icon: <Clock size={20} />, title: "Ātrs sākums", desc: "Apstiprināšana līdz 24 stundām. Sāc pārdot jau šodien." },
  { icon: <Shield size={20} />, title: "Drosi maksājumi", desc: "Paysera maksājumu sistēma — droša un uzticīga." },
  { icon: <CreditCard size={20} />, title: "Izmaksa 2× mēnesī", desc: "Maksājumi uz tavu bankas kontu divas reizes mēnesī. Reversais rēķins — mums." },
];

export default function SellPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Hero */}
      <div className="text-center">
        <h1 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
          Pārdod savus produktus<br />
          <span className="text-brand-600">caur izipizi pārtikas pakomātiem</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-gray-500">
          Reģistrējies kā pārdevējs, izvieto savus produktus un sasniedz klientus
          bez tirgus telts un bez gaidīšanas.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/register/razotajs" className="btn-primary">
            Pieteikties kā pārdevējs
            <ArrowRight size={16} className="ml-2" />
          </Link>
        </div>
      </div>

      {/* Benefits */}
      <div className="mt-14 grid gap-5 sm:grid-cols-3">
        {benefits.map((b) => (
          <div key={b.title} className="rounded-2xl border border-gray-100 bg-gray-50 p-5 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-brand-100 text-brand-600">
              {b.icon}
            </div>
            <p className="mt-3 font-semibold text-gray-900">{b.title}</p>
            <p className="mt-1 text-sm text-gray-500">{b.desc}</p>
          </div>
        ))}
      </div>

      {/* Commission breakdown table */}
      <div className="mt-14 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900 mb-1">Komisijas aprēķins</h2>
        <p className="text-sm text-gray-500 mb-5">
          Komisija = 15% no cenas bez produkta PVN + 21% PVN par komisijas pakalpojumu.
          Produkta PVN noēmsi no saņemtās summas un maksāsi VID pats.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                <th className="pb-2 pr-4">Piemērs (10€)</th>
                <th className="pb-2 pr-4 text-right">PVN 5%</th>
                <th className="pb-2 pr-4 text-right">PVN 12%</th>
                <th className="pb-2 text-right">PVN 21%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              <tr>
                <td className="py-2 pr-4 text-gray-600">Cena bez produkta PVN</td>
                <td className="py-2 pr-4 text-right font-mono">9.52 €</td>
                <td className="py-2 pr-4 text-right font-mono">8.93 €</td>
                <td className="py-2 text-right font-mono">8.26 €</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 text-amber-700">Komisija 15%</td>
                <td className="py-2 pr-4 text-right font-mono text-amber-700">−1.43 €</td>
                <td className="py-2 pr-4 text-right font-mono text-amber-700">−1.34 €</td>
                <td className="py-2 text-right font-mono text-amber-700">−1.24 €</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 text-orange-600">PVN 21% par komisiju</td>
                <td className="py-2 pr-4 text-right font-mono text-orange-600">−0.30 €</td>
                <td className="py-2 pr-4 text-right font-mono text-orange-600">−0.28 €</td>
                <td className="py-2 text-right font-mono text-orange-600">−0.26 €</td>
              </tr>
              <tr className="border-t-2 border-gray-300">
                <td className="py-2 pr-4 font-bold text-green-800">Tu saņemsi</td>
                <td className="py-2 pr-4 text-right font-bold font-mono text-green-700">8.27 €</td>
                <td className="py-2 pr-4 text-right font-bold font-mono text-green-700">8.38 €</td>
                <td className="py-2 text-right font-bold font-mono text-green-700">8.50 €</td>
              </tr>
              <tr>
                <td className="py-1 pr-4 text-xs text-gray-400">% no cenas</td>
                <td className="py-1 pr-4 text-right text-xs text-gray-400">82.7%</td>
                <td className="py-1 pr-4 text-right text-xs text-gray-400">83.8%</td>
                <td className="py-1 text-right text-xs text-gray-400">85.0%</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs text-gray-400">
          * Produkta PVN (šajā piemērā nav ierēķināts) ir jādeklarē VID pats.
          Precizu aprēķinu konkrētai cenai redzi produkta pievienošanas formā.
        </p>
      </div>

      {/* Steps */}
      <div className="mt-14">
        <h2 className="text-center text-xl font-bold text-gray-900">Kā tas strādā?</h2>
        <ol className="mt-8 space-y-5">
          {steps.map((step) => (
            <li key={step.num} className="flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-700 text-sm font-bold text-white">
                {step.num}
              </span>
              <div>
                <p className="font-semibold text-gray-900">{step.title}</p>
                <p className="mt-0.5 text-sm text-gray-500">{step.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* CTA */}
      <div className="mt-12 rounded-2xl bg-[#192635] px-8 py-10 text-center text-white">
        <h2 className="text-xl font-bold">Gatavs sākt?</h2>
        <p className="mt-2 text-gray-300">Reģistrācija ir bezmaksas. Komisija tikai no pārdošanas.</p>
        <Link href="/register/razotajs" className="btn-primary mt-5 bg-white text-brand-700 hover:bg-brand-50">
          Pieteikties tagad <ArrowRight size={16} className="ml-2" />
        </Link>
        <ul className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-gray-300">
          {["Bezmaksas reģistrācija", "Apstiprināšana 24h", "Latvijas ražotāji"].map((f) => (
            <li key={f} className="flex items-center gap-1.5">
              <CheckCircle size={13} /> {f}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
