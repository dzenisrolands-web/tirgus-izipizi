import Link from "next/link";
import { ArrowRight, MapPin, ShoppingBag, Truck, CheckCircle } from "lucide-react";
import { listings, lockers } from "@/lib/mock-data";
import { ListingCard } from "@/components/listing-card";
import { LockerCard } from "@/components/locker-card";

export default function HomePage() {
  const featured = listings.slice(0, 4);

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-[#1a1f2e] via-[#1a1f2e] to-[#003e3c] px-4 py-20 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <span className="inline-block rounded-full bg-white/20 px-3 py-1 text-xs font-medium backdrop-blur-sm">
              🇱🇻 Latvijas zemnieku tirgus
            </span>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight sm:text-5xl">
              Svaiga pārtika —<br />
              <span className="text-brand-400">pie tevis tuvāk</span>
            </h1>
            <p className="mt-4 max-w-lg text-lg text-gray-300">
              Iegādājies produktus tieši no Latvijas zemniekiem un saņem tos
              izipizi pakomātā tavā apkaimē. Bez gaidīšanas. Bez pārdevēju tirgiem.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/catalog" className="btn-primary bg-white text-brand-700 hover:bg-brand-50">
                Skatīt produktus
                <ArrowRight size={16} className="ml-2" />
              </Link>
              <Link href="/sell" className="btn-outline border-white/40 text-white hover:bg-white/10">
                Kļūt par pārdevēju
              </Link>
            </div>

            {/* Quick stats */}
            <div className="mt-10 flex flex-wrap gap-8">
              <div>
                <p className="text-2xl font-bold text-brand-400">6</p>
                <p className="text-sm text-gray-400">Pakomātu vietas</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-brand-400">24/7</p>
                <p className="text-sm text-gray-400">Pieejamība</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-brand-400">+2°C</p>
                <p className="text-sm text-gray-400">Temperatūras kontrole</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-gray-50 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-center text-2xl font-bold text-gray-900">
            Kā tas strādā?
          </h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-3">
            {[
              {
                icon: <ShoppingBag size={24} />,
                step: "1",
                title: "Izvēlies produktus",
                desc: "Pārlūko piedāvājumus no vietējiem zemniekiem un pievieno grozam.",
              },
              {
                icon: <Truck size={24} />,
                step: "2",
                title: "Pārdevējs ielādē pakomātā",
                desc: "Pārdevējs sagatavo pasūtījumu un ievieto to tuvākajā izipizi pakomātā.",
              },
              {
                icon: <MapPin size={24} />,
                step: "3",
                title: "Saņem produktus",
                desc: "Saņem kodu uz e-pastu un izņem produktus pakomātā ērtā laikā.",
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-brand-600">
                  {item.icon}
                </div>
                <p className="mt-4 text-base font-semibold text-gray-900">
                  {item.title}
                </p>
                <p className="mt-2 text-sm text-gray-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured listings */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">Svaigākie produkti</h2>
            <Link
              href="/catalog"
              className="flex items-center gap-1 text-sm text-brand-600 hover:underline"
            >
              Skatīt visus <ArrowRight size={14} />
            </Link>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {featured.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        </div>
      </section>

      {/* Locker locations */}
      <section className="bg-gray-50 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Pakomātu vietas</h2>
              <p className="mt-1 text-sm text-gray-500">
                Temperatūras kontrole +2°C līdz +6°C · Saldēšana −18°C
              </p>
            </div>
            <Link
              href="/lockers"
              className="flex items-center gap-1 text-sm text-brand-600 hover:underline"
            >
              Vairāk <ArrowRight size={14} />
            </Link>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {lockers.map((locker) => (
              <LockerCard key={locker.id} locker={locker} />
            ))}
          </div>
        </div>
      </section>

      {/* Seller CTA */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl rounded-2xl bg-brand-600 px-8 py-12 text-center text-white">
          <h2 className="text-2xl font-bold">Esi zemnieks vai ražotājs?</h2>
          <p className="mt-3 text-brand-100">
            Reģistrējies kā pārdevējs, izvieto savus produktus un pārdod tie
            klientiem tuvākajā pakomātā. Bez lieka papīra darba.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/sell" className="btn-primary bg-white text-brand-700 hover:bg-brand-50">
              Sākt pārdot
              <ArrowRight size={16} className="ml-2" />
            </Link>
          </div>
          <ul className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-brand-100">
            {["Bezmaksas reģistrācija", "Apstiprināšana 24h laikā", "Komisija tikai no pārdošanas"].map(
              (feat) => (
                <li key={feat} className="flex items-center gap-1.5">
                  <CheckCircle size={14} />
                  {feat}
                </li>
              )
            )}
          </ul>
        </div>
      </section>
    </div>
  );
}
