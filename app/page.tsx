import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Home, Store, Tag, CheckCircle, Package, Clock, Calendar, MapPin } from "lucide-react";
import { listings, sellers } from "@/lib/mock-data";
import { sellersMeta } from "@/lib/sellers-meta";
import { ListingCard } from "@/components/listing-card";
import { recipes } from "@/lib/recipes-data";
import { events } from "@/lib/events-data";

export default function HomePage() {
  const featured = listings.slice(0, 8);

  const coverImages = [
    sellersMeta.s7.cover,
    sellersMeta.s9.cover,
    sellersMeta.s12.cover,
    sellersMeta.s13.cover,
  ].filter(Boolean);

  return (
    <div>
      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="bg-[#192635] px-4 py-16 text-white sm:px-6 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="grid items-center gap-12 lg:grid-cols-2">

            {/* Left — copy */}
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-brand-300">
                🇱🇻 Latvijas zemnieku tirgus
              </span>

              <h1 className="mt-5 text-4xl font-extrabold leading-tight sm:text-5xl lg:text-6xl">
                Pērc <span className="text-brand-400">tieši</span><br />
                no ražotāja
              </h1>

              <p className="mt-4 max-w-lg text-lg text-gray-300">
                Latvijas zemnieki un ražotāji ievieto produktus savā mājas pakomātā —
                tu izņem ērtā laikā. Svaigi. Lēti. Vietēji.
              </p>

              {/* Home locker vs other lockers */}
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-brand-400/30 bg-brand-400/10 p-4">
                  <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-brand-400">
                    <Home size={15} />
                    Mājas pakomāts
                  </div>
                  <p className="text-lg font-bold text-white">Zemākā cena</p>
                  <p className="mt-0.5 text-xs text-gray-400">
                    Ražotāja tuvākais pakomāts — vienmēr visizdevīgāk
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-gray-300">
                    <Store size={15} />
                    Citi pakomāti
                  </div>
                  <p className="text-lg font-bold text-white">Nedaudz augstāka</p>
                  <p className="mt-0.5 text-xs text-gray-400">
                    Produkts pieejams arī citos izipizi pakomātos
                  </p>
                </div>
              </div>

              {/* Promo badge */}
              <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-brand-400/30 bg-brand-400/10 px-4 py-3">
                <Tag size={16} className="shrink-0 text-brand-400" />
                <p className="text-sm text-white">
                  <span className="font-bold text-brand-400">Akcijas cena 3 EUR</span>
                  {" "}— izvēlētiem produktiem visos pakomātos
                </p>
              </div>

              {/* CTAs */}
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/catalog"
                  className="inline-flex items-center gap-2 rounded-full bg-brand-400 px-6 py-3 text-sm font-bold text-[#192635] transition hover:brightness-110"
                  style={{ background: "linear-gradient(90deg, #53F3A4, #AD47FF)" }}
                >
                  Skatīt produktus
                  <ArrowRight size={16} />
                </Link>
                <Link
                  href="/razotaji"
                  className="inline-flex items-center gap-2 rounded-full border border-white/30 px-6 py-3 text-sm font-medium text-white transition hover:bg-white/10"
                >
                  Ražotāji
                </Link>
              </div>

              {/* Quick stats */}
              <div className="mt-10 flex flex-wrap gap-8 border-t border-white/10 pt-8">
                <div>
                  <p className="text-2xl font-bold text-brand-400">{sellers.length}</p>
                  <p className="text-sm text-gray-400">Ražotāji</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-brand-400">{listings.length}+</p>
                  <p className="text-sm text-gray-400">Produkti</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-brand-400">6</p>
                  <p className="text-sm text-gray-400">Pakomātu vietas</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-brand-400">24/7</p>
                  <p className="text-sm text-gray-400">Pieejamība</p>
                </div>
              </div>
            </div>

            {/* Right — cover image mosaic */}
            <div className="hidden grid-cols-2 grid-rows-2 gap-3 lg:grid" style={{ height: 460 }}>
              {/* Tall left image */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={coverImages[0]}
                alt=""
                className="row-span-2 h-full w-full rounded-2xl object-cover"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={coverImages[1]}
                alt=""
                className="h-full w-full rounded-2xl object-cover"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={coverImages[2]}
                alt=""
                className="h-full w-full rounded-2xl object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────── */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900">Kā tas strādā?</h2>
            <p className="mt-2 text-sm text-gray-500">No ražotāja — tieši tavā pakomātā</p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {[
              {
                step: "1",
                icon: "🌱",
                title: "Ražotājs ievieto",
                desc: "Latvijas zemnieks vai ražotājs sagatavo produktus un ievieto tos savā mājas pakomātā — vienmēr par zemāko cenu.",
                accent: true,
              },
              {
                step: "2",
                icon: "📦",
                title: "Tu izvēlies",
                desc: "Izvēlies produktus no mūsu kataloga. Mājas pakomāts — lētāk. Citi izipizi pakomāti — nedaudz dārgāk, bet tik pat ērti.",
                accent: false,
              },
              {
                step: "3",
                icon: "🎉",
                title: "Saņem produktus",
                desc: "Saņem kodu uz e-pastu un izņem svaigos produktus pakomātā sev ērtā laikā — 24/7.",
                accent: false,
              },
            ].map((item) => (
              <div
                key={item.step}
                className={`relative rounded-2xl p-6 ${item.accent ? "bg-brand-950 text-white" : "bg-gray-50"}`}
              >
                <span className="text-3xl">{item.icon}</span>
                <div
                  className={`mt-4 inline-block rounded-full px-2 py-0.5 text-xs font-bold ${
                    item.accent ? "bg-brand-400 text-brand-950" : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {item.step}
                </div>
                <h3 className={`mt-2 text-base font-bold ${item.accent ? "text-white" : "text-gray-900"}`}>
                  {item.title}
                </h3>
                <p className={`mt-2 text-sm leading-relaxed ${item.accent ? "text-gray-300" : "text-gray-500"}`}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Locker price concept ─────────────────────────── */}
      <section className="bg-[#192635] px-4 py-16 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-400/20 px-3 py-1 text-xs font-medium text-brand-400">
              <Tag size={12} />
              Cenu struktūra
            </span>
            <h2 className="mt-4 text-2xl font-bold">
              Mājas pakomāts — vienmēr lētāk
            </h2>
            <p className="mt-2 text-gray-400">
              Katram ražotājam ir savs mājas pakomāts, kurā produkti ir vienmēr par zemāko cenu.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {/* Home locker */}
            <div className="rounded-2xl border border-brand-400/40 bg-brand-400/10 p-6 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-400/20">
                <Home size={22} className="text-brand-400" />
              </div>
              <p className="text-xs font-medium uppercase tracking-wide text-brand-400">Mājas pakomāts</p>
              <p className="mt-2 text-3xl font-extrabold text-white">Base cena</p>
              <p className="mt-1 text-sm text-gray-400">Ražotāja tuvākais pakomāts</p>
            </div>

            {/* Other lockers */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
                <Store size={22} className="text-gray-300" />
              </div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Citi pakomāti</p>
              <p className="mt-2 text-3xl font-extrabold text-white">Base + €</p>
              <p className="mt-1 text-sm text-gray-400">Pārējie izipizi pakomāti</p>
            </div>

            {/* Promo */}
            <div className="rounded-2xl border border-yellow-400/40 bg-yellow-400/10 p-6 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-yellow-400/20">
                <Tag size={22} className="text-yellow-400" />
              </div>
              <p className="text-xs font-medium uppercase tracking-wide text-yellow-400">Akcija</p>
              <p className="mt-2 text-3xl font-extrabold text-white">3 EUR</p>
              <p className="mt-1 text-sm text-gray-400">Izvēlētiem produktiem visur</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Featured products ────────────────────────────── */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Svaigākie produkti</h2>
              <p className="mt-1 text-sm text-gray-500">Tieši no zemnieka</p>
            </div>
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

      {/* ── Recipes promo ───────────────────────────────── */}
      <section className="bg-gray-50 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-end justify-between mb-8">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-brand-600">Iedvesma virtuvē</span>
              <h2 className="mt-1 text-2xl font-bold text-gray-900">Receptes no ražotāju produktiem</h2>
              <p className="mt-1 text-sm text-gray-500">Garšīgas idejas, ko pagatavot no vietējiem produktiem</p>
            </div>
            <Link href="/receptes" className="hidden sm:flex items-center gap-1 text-sm text-brand-600 hover:underline shrink-0">
              Visas receptes <ArrowRight size={14} />
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            {recipes.slice(0, 3).map((r) => (
              <Link key={r.slug} href={`/receptes/${r.slug}`}
                className="group overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-shadow">
                <div className="relative h-44 w-full overflow-hidden bg-gray-100">
                  <Image src={r.image} alt={r.title} fill className="object-cover transition-transform duration-300 group-hover:scale-105"
                    sizes="(max-width: 640px) 100vw, 33vw" />
                  <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-0.5 text-xs font-medium text-gray-700 backdrop-blur-sm">
                    {r.category}
                  </span>
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-gray-900 group-hover:text-brand-600 transition-colors leading-snug">{r.title}</h3>
                  <p className="mt-1 text-xs text-gray-500 line-clamp-2">{r.shortDesc}</p>
                  <div className="mt-3 flex items-center gap-3 text-xs text-gray-400">
                    <span className="flex items-center gap-1"><Clock size={11} /> {r.prepTime + r.cookTime} min</span>
                    <span>{r.difficulty}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          <div className="mt-5 text-center sm:hidden">
            <Link href="/receptes" className="btn-outline text-sm">Skatīt visas receptes</Link>
          </div>
        </div>
      </section>

      {/* ── Producers strip ──────────────────────────────── */}
      <section className="bg-gray-50 px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Mūsu ražotāji</h2>
              <p className="mt-1 text-sm text-gray-500">Verificēti Latvijas zemnieki un ražotāji</p>
            </div>
            <Link
              href="/razotaji"
              className="flex items-center gap-1 text-sm text-brand-600 hover:underline"
            >
              Visi ražotāji <ArrowRight size={14} />
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sellers.map((seller) => {
              const meta = sellersMeta[seller.id];
              const count = listings.filter((l) => l.sellerId === seller.id).length;
              return (
                <Link
                  key={seller.id}
                  href={`/seller/${seller.id}`}
                  className="group flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition hover:shadow-md"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={seller.avatar}
                    alt={seller.name}
                    className="h-14 w-14 shrink-0 rounded-xl border border-gray-100 object-contain p-1"
                  />
                  <div className="min-w-0">
                    <p className="truncate font-bold text-gray-900 group-hover:text-brand-600">
                      {seller.name}
                    </p>
                    {meta?.description && (
                      <p className="mt-0.5 line-clamp-1 text-xs text-gray-500">
                        {meta.description}
                      </p>
                    )}
                    <p className="mt-1 flex items-center gap-1 text-xs text-gray-400">
                      <Package size={11} />
                      {count} produkti
                    </p>
                  </div>
                  <ArrowRight size={16} className="ml-auto shrink-0 text-gray-300 transition group-hover:text-brand-400" />
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Calendar promo ───────────────────────────────── */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="overflow-hidden rounded-3xl bg-[#192635] px-8 py-10">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-400/20 px-3 py-1 text-xs font-medium text-brand-400">
                  <Calendar size={12} /> Tirgu kalendārs
                </span>
                <h2 className="mt-3 text-2xl font-extrabold text-white">Tuvākie tirgi un festivāli</h2>
                <p className="mt-1 text-sm text-gray-400">Zemnieku tirgi, gadatirgi un pārtikas festivāli visā Latvijā</p>
              </div>
              <Link href="/kalendars" className="shrink-0 inline-flex items-center gap-2 rounded-full border border-white/20 px-5 py-2.5 text-sm font-medium text-white hover:bg-white/10 transition">
                Skatīt kalendāru <ArrowRight size={14} />
              </Link>
            </div>
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {events.filter(e => e.month >= 4).slice(0, 3).map((ev) => (
                <Link key={ev.id} href={`/kalendars/${ev.id}`}
                  className="flex gap-3 rounded-xl bg-white/5 border border-white/10 p-4 hover:bg-white/10 transition">
                  <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-brand-400/20 text-center">
                    <span className="text-[10px] font-bold uppercase text-brand-400 leading-none">
                      {["Jan","Feb","Mar","Apr","Mai","Jūn","Jūl","Aug","Sep","Okt","Nov","Dec"][ev.month - 1]}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate leading-snug">{ev.name}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-400">
                      <MapPin size={10} /> {ev.city}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Seller CTA ───────────────────────────────────── */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl overflow-hidden rounded-3xl bg-[#192635] px-8 py-14 text-white">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-400/20 px-3 py-1 text-xs font-medium text-brand-400">
                🌱 Pārdod vietēji
              </span>
              <h2 className="mt-4 text-3xl font-extrabold leading-tight">Esi zemnieks<br />vai ražotājs?</h2>
              <p className="mt-3 text-gray-300 leading-relaxed">
                Reģistrējies, ievieto produktus savā mājas pakomātā un pārdod klientiem
                visā Latvijā. Bez lieka papīra darba. Komisija tikai no veiksmīgas pārdošanas.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/sell"
                  className="inline-flex items-center gap-2 rounded-full px-8 py-3 text-sm font-bold text-[#192635] transition hover:brightness-110"
                  style={{ background: "linear-gradient(90deg, #53F3A4, #AD47FF)" }}
                >
                  Sākt pārdot <ArrowRight size={16} />
                </Link>
                <Link href="/how-it-works" className="inline-flex items-center gap-2 rounded-full border border-white/20 px-6 py-3 text-sm font-medium text-white hover:bg-white/10 transition">
                  Kā tas strādā
                </Link>
              </div>
            </div>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
              {[
                { icon: "✅", text: "Bezmaksas reģistrācija" },
                { icon: "⚡", text: "Apstiprināšana 24h laikā" },
                { icon: "💰", text: "Komisija tikai no pārdošanas" },
                { icon: "📦", text: "Mājas pakomāts — zemākā cena" },
              ].map((f) => (
                <li key={f.text} className="flex items-center gap-3 rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-gray-300">
                  <span className="text-base">{f.icon}</span>
                  {f.text}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
