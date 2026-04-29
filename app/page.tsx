import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight, Package, Flame, Zap,
  CheckCircle, ChevronRight, ShoppingBag, Truck, Star,
} from "lucide-react";
import { listings, sellers } from "@/lib/mock-data";
import { sellersMeta } from "@/lib/sellers-meta";
import { ListingCard } from "@/components/listing-card";
import { HotDropsPreview } from "@/components/keriens/HotDropsPreview";
import { recipes } from "@/lib/recipes-data";
import { fetchActiveListings } from "@/lib/db-listings";
import { hasValidImage } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Svaiga pārtika no Latvijas ražotājiem",
  description:
    "Pelmeņi no Vidzemes, brieža steiki no meža, ikri no Rīgas bāra — saņem tieši no ražotāja caur IziPizi pakomātiem. Svaigi. Ātri. Vietēji.",
  openGraph: {
    title: "tirgus.izipizi.lv — Svaiga pārtika bez starpniekiem",
    description:
      "Pelmeņi no Vidzemes, brieža steiki no meža, ikri no Rīgas bāra — saņem tieši no ražotāja caur IziPizi pakomātiem.",
    url: "https://tirgus.izipizi.lv",
    images: [
      {
        url: "https://business.izipizi.lv/images/marketplace/products/4998684Pelmeni-veganie-webp.webp",
        width: 1200,
        height: 630,
        alt: "tirgus.izipizi.lv produkti",
      },
    ],
  },
};

const CATEGORIES = [
  { label: "Saldēta pārtika", emoji: "🥟", slug: "Saldēta pārtika" },
  { label: "Gaļa",            emoji: "🥩", slug: "Gaļa" },
  { label: "Dzērieni",        emoji: "🥤", slug: "Dzērieni" },
  { label: "Olas",            emoji: "🥚", slug: "Olas" },
  { label: "Garšaugi",        emoji: "🌿", slug: "Garšaugi" },
  { label: "Konservi",        emoji: "🥫", slug: "Konservi" },
  { label: "Dārzeņi",         emoji: "🥦", slug: "Dārzeņi" },
  { label: "Jūras veltes",    emoji: "🐟", slug: "Jūras veltes" },
  { label: "Konditorejas",    emoji: "🍰", slug: "Konditorejas" },
  { label: "Medus",           emoji: "🍯", slug: "Medus" },
];

const HERO_PRODUCTS = [
  {
    img: "https://business.izipizi.lv/images/marketplace/products/4998684Pelmeni-veganie-webp.webp",
    name: "Vegānie pelmeņi", seller: "Bujums", price: "€4.00",
  },
  {
    img: "https://business.izipizi.lv/images/marketplace/products/5397193Brie-a-steiks-stilbs-marin-ts-jpg.jpg",
    name: "Brieža steiks", seller: "WILD'N'FREE", price: "€12.50",
  },
  {
    img: "https://business.izipizi.lv/images/marketplace/products/3837272facebook-1770717542678-7426927672127940456-jpg.jpg",
    name: "Paipalu olas", seller: "Bujums", price: "€5.50",
  },
  {
    img: "https://business.izipizi.lv/images/marketplace/products/4066818Pankukas-Spinatu-2-webp.webp",
    name: "Pankūkas ar spinātiem", seller: "Bujums", price: "€4.86",
  },
];

export default async function HomePage() {
  const dbListings = await fetchActiveListings();
  const allListings = [...dbListings, ...listings].filter(hasValidImage);
  const featured = allListings.slice(0, 8);
  const totalListings = allListings.length;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": "https://tirgus.izipizi.lv/#website",
        url: "https://tirgus.izipizi.lv",
        name: "tirgus.izipizi.lv",
        description: "Latvijas ražotāju pārtikas tirgus vieta",
        inLanguage: "lv",
        potentialAction: {
          "@type": "SearchAction",
          target: { "@type": "EntryPoint", urlTemplate: "https://tirgus.izipizi.lv/catalog?q={search_term_string}" },
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@type": "Organization",
        "@id": "https://tirgus.izipizi.lv/#organization",
        name: "tirgus.izipizi.lv",
        url: "https://tirgus.izipizi.lv",
        logo: { "@type": "ImageObject", url: "https://tirgus.izipizi.lv/logo.png" },
        sameAs: ["https://izipizi.lv"],
      },
    ],
  };

  return (
    <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    <div>

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#192635]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full opacity-10"
            style={{ background: "radial-gradient(circle, #53F3A4, transparent 70%)" }} />
          <div className="absolute -bottom-24 -left-24 h-80 w-80 rounded-full opacity-10"
            style={{ background: "radial-gradient(circle, #AD47FF, transparent 70%)" }} />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-8 py-14 lg:grid-cols-2 lg:py-20">

            {/* Left */}
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-green-400/30 bg-green-400/10 px-3 py-1.5 text-xs font-semibold text-green-300">
                <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                Latvijā ražoti produkti — tieši no ražotāja
              </div>

              <h1 className="mt-5 text-4xl font-extrabold leading-tight text-white sm:text-5xl lg:text-6xl">
                Svaiga pārtika{" "}
                <span className="bg-clip-text text-transparent"
                  style={{ backgroundImage: "linear-gradient(90deg, #53F3A4, #AD47FF)" }}>
                  bez starpniekiem
                </span>
              </h1>

              <p className="mt-4 max-w-lg text-base leading-relaxed text-gray-300 sm:text-lg">
                Pelmeņi no Vidzemes, brieža steiki no meža, ikri no Rīgas bāra — saņem
                tieši no ražotāja caur <strong className="text-white">IziPizi pakomātiem</strong>. Svaigi. Ātri. Vietēji.
              </p>

              {/* CTAs */}
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href="/catalog"
                  className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-[#192635] transition hover:brightness-110"
                  style={{ background: "linear-gradient(90deg, #53F3A4, #AD47FF)" }}>
                  <ShoppingBag size={15} /> Skatīt visus produktus
                </Link>
                <Link href="/keriens"
                  className="inline-flex items-center gap-2 rounded-full border border-orange-400/50 bg-orange-400/10 px-6 py-3 text-sm font-bold text-orange-300 hover:bg-orange-400/20 transition">
                  <Flame size={14} /> Sludinājumu dēlis
                </Link>
              </div>

              {/* Stats */}
              <div className="mt-10 grid grid-cols-3 gap-4 border-t border-white/10 pt-8">
                <div>
                  <p className="text-2xl font-extrabold" style={{ color: "#53F3A4" }}>{sellers.length}</p>
                  <p className="mt-0.5 text-xs text-gray-400">Verificēti ražotāji</p>
                </div>
                <div>
                  <p className="text-2xl font-extrabold" style={{ color: "#53F3A4" }}>{totalListings}+</p>
                  <p className="mt-0.5 text-xs text-gray-400">Produkti</p>
                </div>
                <div>
                  <p className="text-2xl font-extrabold" style={{ color: "#53F3A4" }}>6+</p>
                  <p className="mt-0.5 text-xs text-gray-400">Pārtikas pakomātu vietas</p>
                </div>
              </div>
            </div>

            {/* Right — product card mosaic */}
            <div className="hidden grid-cols-2 gap-3 lg:grid">
              {HERO_PRODUCTS.map((p) => (
                <div key={p.name}
                  className="group overflow-hidden rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 transition">
                  <div className="relative h-36 overflow-hidden bg-gray-800">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.img} alt={p.name}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-90" />
                  </div>
                  <div className="p-3">
                    <p className="text-xs font-bold text-white leading-tight">{p.name}</p>
                    <div className="mt-1 flex items-center justify-between">
                      <p className="text-[11px] text-gray-400">{p.seller}</p>
                      <p className="text-xs font-bold text-green-400">{p.price}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Seller logos strip */}
          <div className="border-t border-white/10 py-5">
            <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-widest text-gray-500">
              Mūsu ražotāji
            </p>
            <div className="flex flex-wrap items-center justify-center gap-6 opacity-60">
              {sellers.map((s) => (
                <Link key={s.id} href={`/seller/${s.id}`}
                  className="h-8 transition hover:opacity-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.avatar} alt={s.name} className="h-8 w-auto object-contain" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CATEGORY STRIP ───────────────────────────────────── */}
      <section className="border-b border-gray-100 bg-white px-4 py-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {CATEGORIES.map((cat) => (
              <Link key={cat.slug}
                href={`/catalog?category=${encodeURIComponent(cat.slug)}`}
                className="flex shrink-0 items-center gap-1.5 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:border-gray-400 hover:bg-gray-50 transition">
                <span>{cat.emoji}</span>
                {cat.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── SLUDINĀJUMU DĒLIS — paslēpts līdz launch ──
      <HotDropsPreview />
      */}

      {/* ── FEATURED PRODUCTS ────────────────────────────────── */}
      <section className="bg-gray-50 px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-7 flex items-end justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-brand-600">Tieši no ražotāja</span>
              <h2 className="mt-1 text-2xl font-extrabold text-gray-900">Svaigākie produkti</h2>
            </div>
            <Link href="/catalog"
              className="hidden items-center gap-1 text-sm font-medium text-brand-600 hover:underline sm:flex">
              Visi produkti <ArrowRight size={14} />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {featured.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
          <div className="mt-6 text-center sm:hidden">
            <Link href="/catalog" className="btn-outline text-sm">Skatīt visus produktus</Link>
          </div>
        </div>
      </section>

      {/* ── SELLERS SPOTLIGHT ────────────────────────────────── */}
      <section className="px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-7 flex items-end justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-brand-600">Verificēti</span>
              <h2 className="mt-1 text-2xl font-extrabold text-gray-900">Mūsu ražotāji</h2>
            </div>
            <Link href="/razotaji"
              className="flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline">
              Visi ražotāji <ArrowRight size={14} />
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sellers.map((seller) => {
              const meta = sellersMeta[seller.id];
              const count = listings.filter((l) => l.sellerId === seller.id).length;
              return (
                <Link key={seller.id} href={`/seller/${seller.id}`}
                  className="group relative overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition">
                  {/* Cover image */}
                  <div className="relative h-32 overflow-hidden bg-gradient-to-br from-gray-800 to-gray-700">
                    {meta?.cover && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={meta.cover} alt="" className="h-full w-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-300" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    {/* Logo */}
                    <div className="absolute bottom-3 left-3 h-12 w-12 overflow-hidden rounded-xl border-2 border-white bg-white shadow">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={seller.avatar} alt={seller.name} className="h-full w-full object-contain p-1" />
                    </div>
                    {seller.verified && (
                      <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-green-700 backdrop-blur-sm">
                        <CheckCircle size={9} /> Verificēts
                      </div>
                    )}
                  </div>
                  {/* Info */}
                  <div className="p-4">
                    <p className="font-bold text-gray-900 group-hover:text-brand-600 transition">{seller.name}</p>
                    {meta?.shortDesc && (
                      <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-gray-500">{meta.shortDesc}</p>
                    )}
                    <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Package size={11} /> {count} produkti
                      </span>
                      <span className="flex items-center gap-1">
                        <Star size={11} fill="currentColor" className="text-amber-400" />
                        {seller.rating} ({seller.reviewCount})
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────── */}
      <section className="bg-[#192635] px-4 py-14 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-400">Vienkārši</span>
            <h2 className="mt-2 text-2xl font-extrabold text-white">Kā tas strādā?</h2>
          </div>
          <div className="mt-10 grid gap-3 sm:grid-cols-4">
            {[
              { icon: "🌾", step: "01", title: "Izvēlies produktu", desc: "Kataloogs, meklēšana vai hot drops — atrodi ko vēlies." },
              { icon: "📍", step: "02", title: "Izvēlies pakomātu", desc: "Tuvākais IziPizi pakomāts — 6+ vietas Latvijā." },
              { icon: "💳", step: "03", title: "Apmaksā droši", desc: "Paysera vai karte. Ražotājs saņem pasūtījumu." },
              { icon: "✅", step: "04", title: "Saņem pakomātā", desc: "24/7 piekļuve. Svaigs produkts tevi gaida." },
            ].map((item, i) => (
              <div key={item.step} className="relative">
                {i < 3 && (
                  <ChevronRight size={18} className="absolute -right-2 top-8 z-10 hidden text-white/20 sm:block" />
                )}
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <span className="text-3xl">{item.icon}</span>
                  <p className="mt-3 text-xs font-extrabold text-brand-400">{item.step}</p>
                  <h3 className="mt-1 font-bold text-white">{item.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-gray-400">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DELIVERY OPTIONS ─────────────────────────────────── */}
      <section className="px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-600">Piegāde</span>
            <h2 className="mt-2 text-2xl font-extrabold text-gray-900">Saņem tā, kā tev ērti</h2>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              {
                icon: <Package size={22} className="text-brand-500" />,
                bg: "bg-brand-50 border-brand-200",
                title: "IziPizi pakomāts",
                desc: "Saņem jebkurā no 6+ pakomātiem 24/7. Dzesēts un saldēts režīms.",
                price: "3 € / skapītis",
                href: "/piegade",
                color: "text-brand-600",
              },
              {
                icon: <Truck size={22} className="text-gray-600" />,
                bg: "bg-gray-50 border-gray-200",
                title: "Kurjers",
                desc: "Mājas durvīs 4 zonās — Rīga, Pierīga un reģionālie centri. 1–2 darba dienās.",
                price: "no 5.45 €",
                href: "/piegade",
                color: "text-gray-700",
              },
              {
                icon: <Zap size={22} className="text-yellow-500" />,
                bg: "bg-yellow-50 border-yellow-200",
                title: "Eksprespiegāde",
                desc: "2–5h piegāde Rīgā un Pierīgā. Pasūti no rīta — saņem pusdienā.",
                price: "no 6.66 €",
                href: "/piegade#ekspres",
                color: "text-yellow-700",
              },
            ].map((d) => (
              <Link key={d.title} href={d.href}
                className={`group flex flex-col rounded-2xl border p-6 transition hover:shadow-md ${d.bg}`}>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm">
                  {d.icon}
                </div>
                <h3 className="mt-4 font-bold text-gray-900">{d.title}</h3>
                <p className="mt-1.5 flex-1 text-sm leading-relaxed text-gray-500">{d.desc}</p>
                <div className="mt-4 flex items-center justify-between">
                  <span className={`text-xl font-extrabold ${d.color}`}>{d.price}</span>
                  <ArrowRight size={16} className="text-gray-300 transition group-hover:translate-x-1 group-hover:text-gray-500" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── RECIPES ──────────────────────────────────────────── */}
      <section className="bg-gray-50 px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-7 flex items-end justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-brand-600">Iedvesma virtuvē</span>
              <h2 className="mt-1 text-2xl font-extrabold text-gray-900">Receptes ar vietējiem produktiem</h2>
            </div>
            <Link href="/receptes"
              className="hidden items-center gap-1 text-sm font-medium text-brand-600 hover:underline sm:flex">
              Visas receptes <ArrowRight size={14} />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {recipes.slice(0, 3).map((r) => (
              <Link key={r.slug} href={`/receptes/${r.slug}`}
                className="group overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition">
                <div className="relative h-44 overflow-hidden bg-gray-100">
                  <Image src={r.image} alt={r.title} fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    sizes="(max-width: 640px) 100vw, 33vw" />
                  <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-0.5 text-xs font-semibold text-gray-700 backdrop-blur-sm">
                    {r.category}
                  </span>
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-gray-900 group-hover:text-brand-600 transition">{r.title}</h3>
                  <p className="mt-1 line-clamp-2 text-xs text-gray-500">{r.shortDesc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── SELLER CTA ───────────────────────────────────────── */}
      <section className="px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl overflow-hidden rounded-3xl bg-[#192635] px-8 py-12 text-white">
          <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-400/20 px-3 py-1 text-xs font-semibold text-brand-400">
                🌱 Pārdod vietēji
              </span>
              <h2 className="mt-4 text-3xl font-extrabold leading-tight">
                Esi ražotājs<br />vai pārdevējs?
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-gray-300">
                Tu tirgo, mēs nodrošinām visu pārējo — pakomātu tīklu, temperatūras ķēdi,
                piegādi un maksājumus. Reģistrējies un sasniedz vairāk pircējus.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/sell"
                  className="inline-flex items-center gap-2 rounded-full px-7 py-3 text-sm font-bold text-[#192635] hover:brightness-110 transition"
                  style={{ background: "linear-gradient(90deg, #53F3A4, #AD47FF)" }}>
                  Sākt pārdot <ArrowRight size={15} />
                </Link>
              </div>
            </div>
            <ul className="space-y-2">
              {[
                "✅ Bezmaksas reģistrācija",
                "⚡ Apstiprināšana 24h laikā",
                "💰 Komisija tikai no pārdošanas",
                "🚚 IziPizi piegādes infrastruktūra",
                "❄️ Temperatūras ķēde no ražotāja",
                "🔥 Flash drops — pārdod ātri un vairāk",
              ].map((f) => (
                <li key={f}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-gray-300">
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

    </div>
    </>
  );
}
