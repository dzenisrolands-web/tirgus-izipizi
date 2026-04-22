import Link from "next/link";
import { CheckCircle, ArrowRight, Clock, Percent, Shield } from "lucide-react";

export const metadata = {
  title: "Kļūt par pārdevēju — tirgus.izipizi.lv",
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
    desc: "Pievieno savus produktus — foto, cena, daudzums, derīguma termiņš, pakomāta vieta.",
  },
  {
    num: "3",
    title: "Saņem pasūtījumu",
    desc: "Kad klients pasūta, tu saņem paziņojumu un laika logs ielādei pakomātā.",
  },
  {
    num: "4",
    title: "Ievieto pakomātā",
    desc: "Ievieto produktus izipizi pakomātā, iezīmē kā gatavu — klients saņem kodu.",
  },
  {
    num: "5",
    title: "Saņem maksājumu",
    desc: "Maksājums tiek pārskaitīts pēc veiksmīgas pasūtījuma pabeigšanas.",
  },
];

const benefits = [
  { icon: <Percent size={20} />, title: "Komisija tikai no pārdošanas", desc: "Nav abonēšanas maksas. Maksā tikai tad, kad pārdod." },
  { icon: <Clock size={20} />, title: "Ātrs sākums", desc: "Apstiprināšana līdz 24 stundām. Sāc pārdot jau šodien." },
  { icon: <Shield size={20} />, title: "Droši maksājumi", desc: "Paysera maksājumu sistēma — droša un uzticama." },
];

export default function SellPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Hero */}
      <div className="text-center">
        <h1 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
          Pārdod savus produktus<br />
          <span className="text-brand-600">caur izipizi pakomātiem</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-gray-500">
          Reģistrējies kā pārdevējs, izvieto savus produktus un sasniedz klientus
          visā Latvijā — bez tirgus telts un bez gaidīšanas.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/register?role=seller" className="btn-primary">
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

      {/* Steps */}
      <div className="mt-14">
        <h2 className="text-center text-xl font-bold text-gray-900">Kā tas strādā?</h2>
        <ol className="mt-8 space-y-5">
          {steps.map((step) => (
            <li key={step.num} className="flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
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
      <div className="mt-12 rounded-2xl bg-brand-600 px-8 py-10 text-center text-white">
        <h2 className="text-xl font-bold">Gatavs sākt?</h2>
        <p className="mt-2 text-brand-100">Reģistrācija ir bezmaksas. Komisija tikai no pārdošanas.</p>
        <Link href="/register?role=seller" className="btn-primary mt-5 bg-white text-brand-700 hover:bg-brand-50">
          Pieteikties tagad <ArrowRight size={16} className="ml-2" />
        </Link>
        <ul className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-brand-100">
          {["Bezmaksas reģistrācija", "Apstiprināšana 24h", "Latvijas zemnieki"].map((f) => (
            <li key={f} className="flex items-center gap-1.5">
              <CheckCircle size={13} /> {f}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
