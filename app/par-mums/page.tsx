import type { Metadata } from "next";
import Link from "next/link";
import { Sprout, Truck, Store, Heart } from "lucide-react";
import { operatorInfo } from "@/lib/operator-info";

export const metadata: Metadata = {
  title: "Par mums",
  description:
    "tirgus.izipizi.lv ir SIA Svaigi pārvaldīta tirgus vieta, kas savieno Latvijas ražotājus ar pircējiem caur izipizi pakomātu tīklu.",
};

export default function ParMumsPage() {
  return (
    <div className="bg-white">
      {/* Hero */}
      <div className="relative overflow-hidden bg-[#192635] px-4 py-16 text-white sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute -top-32 -right-32 h-80 w-80 rounded-full bg-brand-400/10 blur-3xl" />
        <div className="relative mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-400/20 px-3 py-1 text-xs font-medium text-brand-300">
            Par mums
          </span>
          <h1 className="mt-4 text-3xl font-extrabold leading-tight sm:text-4xl">
            Latvijas ražotāji.<br className="hidden sm:block" />
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(90deg,#53F3A4,#AD47FF)" }}>
              Tieši pie tava pakomāta.
            </span>
          </h1>
          <p className="mt-3 text-base text-gray-400 max-w-xl mx-auto">
            Mēs savienojam vietējos pārtikas ražotājus ar pircējiem visā Latvijā —
            izmantojot izipizi pakomātu tīklu kā ērto piegādes risinājumu.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8 space-y-12">

        {/* Mūsu stāsts */}
        <section>
          <h2 className="text-xl font-extrabold text-gray-900">Mūsu stāsts</h2>
          <div className="mt-4 space-y-4 text-sm leading-relaxed text-gray-600">
            <p>
              SIA &quot;Svaigi&quot; tika dibināta 2015. gadā ar vienkāršu mērķi — padarīt
              Latvijas svaigu, vietējo pārtiku pieejamāku ikdienas pircējam. Sākotnēji
              strādājām kā mazs ražotāju kooperatīvs, vēlāk attīstoties par tirgus vietu.
            </p>
            <p>
              2026. gadā mēs apvienojām spēkus ar <strong>SIA &quot;IziPizi&quot;</strong>,
              kas operē Latvijas pārtikas pakomātu tīklu. Pateicoties šai sadarbībai, ražotāji var
              piegādāt savus produktus uz pakomātiem, un pircēji savukārt tos saņem 24/7
              ar temperatūras kontroli.
            </p>
          </div>
        </section>

        {/* Vērtības */}
        <section>
          <h2 className="text-xl font-extrabold text-gray-900">Mūsu vērtības</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <ValueCard
              icon={<Sprout size={18} className="text-brand-600" />}
              title="Vietējie ražotāji"
              text="Tikai pārbaudīti Latvijas ražotāji. Mēs apstiprinām katru reģistrāciju manuāli — lai pircējs zinātu, no kura saņems savu pārtiku."
            />
            <ValueCard
              icon={<Truck size={18} className="text-brand-600" />}
              title="Ērta piegāde"
              text="Pakomāts pieejams 24/7 ar temperatūras kontroli. Saņem ceļā no darba vai nedēļas nogalē — tev nav jāmaina ieradumi."
            />
            <ValueCard
              icon={<Store size={18} className="text-brand-600" />}
              title="Godīga komisija"
              text="Mūsu komisija ir 5–20% atkarībā no produkta — tirgotājs to ierosina, mēs apstiprinām. Caurspīdīgi un ar pamatojumu."
            />
            <ValueCard
              icon={<Heart size={18} className="text-brand-600" />}
              title="Atbalsts vietējiem"
              text="Katrs pirkums atbalsta Latvijas zemnieku un ražotāju. Mūsu mērķis — palīdzēt mazajiem palikt konkurētspējīgiem."
            />
          </div>
        </section>

        {/* Rekvizīti */}
        <section className="rounded-2xl border border-gray-100 bg-gray-50 p-6">
          <h2 className="text-xl font-extrabold text-gray-900">Mūsu rekvizīti</h2>
          <div className="mt-4 grid gap-2 text-sm text-gray-600 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Juridiskais nosaukums</p>
              <p className="font-semibold text-gray-900">{operatorInfo.legalName}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Reģistrācija</p>
              <p>Reģ. Nr.: {operatorInfo.registrationNumber}</p>
              <p>PVN reģ. Nr.: {operatorInfo.vatNumber}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Adrese</p>
              <p>{operatorInfo.legalAddress.street}</p>
              <p>{operatorInfo.legalAddress.city}, {operatorInfo.legalAddress.postalCode}</p>
              <p>{operatorInfo.legalAddress.country}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Kontakti</p>
              <p>{operatorInfo.contact.phone}</p>
              <p>{operatorInfo.contact.emailGeneral}</p>
              <p><a href={operatorInfo.contact.publicWebsite} target="_blank" rel="noopener" className="text-brand-600 hover:underline">svaigi.lv</a></p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="grid gap-4 sm:grid-cols-2">
          <Link href="/catalog" className="rounded-2xl bg-[#192635] p-6 text-white hover:brightness-110 transition">
            <p className="font-bold text-lg">Esmu pircējs</p>
            <p className="mt-1.5 text-sm text-gray-300">Apskati visus Latvijas ražotāju produktus →</p>
          </Link>
          <Link href="/sell" className="rounded-2xl border-2 border-brand-200 bg-brand-50 p-6 hover:bg-brand-100 transition">
            <p className="font-bold text-lg text-brand-800">Esmu ražotājs</p>
            <p className="mt-1.5 text-sm text-brand-700">Reģistrējies un sāc pārdot →</p>
          </Link>
        </section>
      </div>
    </div>
  );
}

function ValueCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50">{icon}</div>
        <h3 className="font-bold text-gray-900">{title}</h3>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-gray-500">{text}</p>
    </div>
  );
}
