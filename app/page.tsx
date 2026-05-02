import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight, Package, Zap,
  CheckCircle, ChevronRight, ShoppingBag, Truck, Star,
  TrendingUp, Sparkles,
} from "lucide-react";
import { listings, sellers } from "@/lib/mock-data";
import { sellersMeta } from "@/lib/sellers-meta";
import { ListingCard } from "@/components/listing-card";
import { HotDropsPreview } from "@/components/keriens/HotDropsPreview";
import { HeroProductRotator } from "@/components/hero-product-rotator";
import { recipes } from "@/lib/recipes-data";
import {
  fetchActiveListings,
  fetchApprovedSellers,
  fetchBestSellers,
  fetchNewestListings,
  fetchWeeklyFeatured,
} from "@/lib/db-listings";
import { hasValidImage } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Pērc no vietējā, saņem ērti — pakomātā vai ar piegādi",
  description:
    "Pelmeņi no Vidzemes, brieža steiki no meža, ikri no Rīgas bāra — desmitiem Latvijas ražotāju vienuviet. Saņem pārtikas pakomātā vai ar piegādi uz mājām.",
  openGraph: {
    title: "tirgus.izipizi.lv — Pērc no vietējā, saņem ērti",
    description:
      "Pelmeņi no Vidzemes, brieža steiki no meža, ikri no Rīgas bāra — desmitiem Latvijas ražotāju vienuviet. Pakomātā vai ar piegādi.",
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
  { label: "Konditorija",     emoji: "🍰", slug: "Konditorija" },
  { label: "Mērces",          emoji: "🥣", slug: "Mērces" },
  { label: "Medus",           emoji: "🍯", slug: "Medus" },
];

// Old static hero mosaic — replaced by <HeroProductRotator/> with live DB data.
// const HERO_PRODUCTS = [
//   { img: "...", name: "Vegānie pelmeņi", seller: "Bujums", price: "€4.00" },
//   { img: "...", name: "Brieža steiks", seller: "WILD'N'FREE", price: "€12.50" },
//   { img: "...", name: "Paipalu olas", seller: "Bujums", price: "€5.50" },
//   { img: "...", name: "Pankūkas ar spinātiem", seller: "Bujums", price: "€4.86" },
// ];

export default async function HomePage() {
  const [dbListings, dbBestSellers, dbNewest, dbWeekly, dbApproved] = await Promise.all([
    fetchActiveListings(),
    fetchBestSellers(6),
    fetchNewestListings(8),
    fetchWeeklyFeatured(7),
    fetchApprovedSellers(),
  ]);
  const allListings = [...dbListings, ...listings].filter(hasValidImage);

  // Hero stats — real data, not hardcoded
  const liveSellerCount = dbApproved.length || sellers.length;
  const liveSellerNames = (dbApproved.length ? dbApproved.map((s) => s.seller.name) : sellers.map((s) => s.name))
    .filter(Boolean)
    .slice(0, 4);
  // "Šonedēļ pievienoti" — last 7 days, active listings only
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const freshThisWeekCount = dbListings.filter((l) => {
    const t = new Date(l.createdAt).getTime();
    return Number.isFinite(t) && Date.now() - t < SEVEN_DAYS_MS;
  }).length;

  // Hero product rotator — newest with images first, falls back to mock
  const rotatorProducts = (dbNewest.length ? dbNewest : listings)
    .filter(hasValidImage)
    .slice(0, 8)
    .map((l) => ({
      id: l.id,
      title: l.title,
      price: l.price,
      image: l.image,
      sellerName: l.seller?.name ?? "",
      createdAt: l.createdAt ?? new Date().toISOString(),
    }));

  // Pad helper — if a section has fewer than `target` items, fill from `pool`
  // (avoiding duplicates) so each row always shows a full grid.
  function padTo(target: number, primary: typeof allListings, pool: typeof allListings) {
    const ids = new Set(primary.map((l) => l.id));
    const extras = pool.filter((l) => !ids.has(l.id));
    return [...primary, ...extras].slice(0, target);
  }

  // Best sellers — DB orders first, pad with rest of catalog
  const bestSellers = padTo(6, dbBestSellers.filter(hasValidImage), allListings);
  // Newest — DB sorted by created_at, pad if mock-only catalog is sparse
  const newestListings = padTo(6, dbNewest.filter(hasValidImage), allListings);
  // Weekly featured — only show what admin selected (no fallback — section hides if empty)
  const weeklyFeatured = dbWeekly.filter(hasValidImage);
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
          {/* Warm food halo — adds appetite cue alongside the cool brand colors */}
          <div className="absolute -bottom-32 left-1/3 h-72 w-72 rounded-full opacity-[0.09]"
            style={{ background: "radial-gradient(circle, #fbbf24, transparent 70%)" }} />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-8 py-14 lg:grid-cols-2 lg:py-20">

            {/* Left */}
            <div>
              {/*
                Old hero pill + headline — kept for browser comparison.
                <div className="inline-flex items-center gap-2 rounded-full border border-green-400/30 bg-green-400/10 px-3 py-1.5 text-xs font-semibold text-green-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                  Latvijā ražoti produkti — tieši no ražotāja
                </div>
                <h1 className="mt-5 text-4xl font-extrabold leading-tight text-white sm:text-5xl lg:text-6xl">
                  Pērc no <span className="bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(90deg, #53F3A4, #AD47FF)" }}>vietējā</span>,
                  <br className="hidden sm:block" />
                  saņem <span className="text-white">ērti</span>
                </h1>
                <p className="mt-4 max-w-lg text-base leading-relaxed text-gray-300 sm:text-lg">
                  Pārtikas <strong className="text-white">pakomātā</strong> vai ar <strong className="text-white">piegādi</strong> uz mājām. Pelmeņi no Vidzemes, brieža steiki no meža, ikri no Rīgas bāra — desmitiem Latvijas ražotāju vienuviet.
                </p>
              */}

              <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1.5 text-xs font-semibold text-amber-200">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-300 animate-pulse" />
                {freshThisWeekCount > 0
                  ? `🔥 Šonedēļ pievienoti ${freshThisWeekCount} jauni produkti`
                  : "Latvijā ražoti produkti — tieši no ražotāja"}
              </div>

              <h1 className="mt-5 text-4xl font-extrabold uppercase leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
                <span className="bg-clip-text text-transparent"
                  style={{ backgroundImage: "linear-gradient(90deg, #53F3A4, #AD47FF)" }}>
                  Ražotājs
                </span>,{" "}
                <span className="bg-clip-text text-transparent"
                  style={{ backgroundImage: "linear-gradient(90deg, #53F3A4, #AD47FF)" }}>
                  pārtikas pakomāts
                </span>,
                <br />
                <span className="text-white">Tavs galds</span>.
              </h1>

              <p className="mt-4 max-w-lg text-base leading-relaxed text-gray-300 sm:text-lg">
                {liveSellerNames.length > 0 && (
                  <>
                    {liveSellerNames.map((n, i) => (
                      <span key={n}>
                        <strong className="text-white">{n}</strong>
                        {i < liveSellerNames.length - 1 ? ", " : ""}
                      </span>
                    ))}
                    {" un citi — "}
                  </>
                )}
                {totalListings}+ produkti no {liveSellerCount} Latvijas saimniekiem.{" "}
                Saņem <strong className="text-white">pakomātā</strong> vai ar{" "}
                <strong className="text-white">piegādi</strong> uz mājām.
              </p>

              {/* CTAs */}
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href="/catalog"
                  className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-[#192635] transition hover:brightness-110"
                  style={{ background: "linear-gradient(90deg, #53F3A4, #AD47FF)" }}>
                  <ShoppingBag size={15} /> Skatīt visus produktus
                </Link>
                <Link href="/piegade"
                  className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-6 py-3 text-sm font-bold text-white hover:bg-white/10 transition">
                  <Truck size={14} /> Piegādes veidi
                </Link>
              </div>

              {/* Stats */}
              <div className="mt-10 grid grid-cols-3 gap-4 border-t border-white/10 pt-8">
                <div>
                  <p className="text-2xl font-extrabold" style={{ color: "#53F3A4" }}>{liveSellerCount}</p>
                  <p className="mt-0.5 text-xs text-gray-400">Šodien tirgo</p>
                </div>
                <div>
                  <p className="text-2xl font-extrabold" style={{ color: "#53F3A4" }}>{totalListings}+</p>
                  <p className="mt-0.5 text-xs text-gray-400">Svaigi produkti</p>
                </div>
                <div>
                  <p className="text-2xl font-extrabold" style={{ color: "#53F3A4" }}>6+</p>
                  <p className="mt-0.5 text-xs text-gray-400">Pakomātu vietas</p>
                </div>
              </div>
            </div>

            {/* Right — product rotator (auto-fades every 5s) */}
            <HeroProductRotator products={rotatorProducts} />
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

      {/* ── BEST SELLERS — Pirktākie ──────────────────────────── */}
      {bestSellers.length > 0 && (
        <section className="bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-6 flex items-end justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100">
                  <TrendingUp size={20} className="text-rose-600" />
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600">Šonedēļ populārākie</span>
                  <h2 className="mt-0.5 text-2xl font-extrabold text-gray-900">Šonedēļ visi pērk šo</h2>
                </div>
              </div>
              <Link href="/catalog?sort=popular"
                className="hidden items-center gap-1 text-sm font-medium text-rose-600 hover:underline sm:flex">
                Visi populārākie <ArrowRight size={14} />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {bestSellers.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── WEEKLY FEATURED — Nedēļas piedāvājums ─────────────── */}
      {weeklyFeatured.length > 0 && (
        <section className="px-4 py-12 sm:px-6 lg:px-8 bg-gradient-to-br from-yellow-50 via-white to-purple-50">
          <div className="mx-auto max-w-7xl">
            <div className="mb-6 flex items-end justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{ background: "linear-gradient(135deg,#fef3c7,#e9d5ff)" }}>
                  <Star size={20} className="text-amber-600" fill="currentColor" />
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Redaktoru izvēle</span>
                  <h2 className="mt-0.5 text-2xl font-extrabold text-gray-900">Nedēļas piedāvājums</h2>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
              {weeklyFeatured.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── NEWEST — Tikko pievienoti ────────────────────────── */}
      {newestListings.length > 0 && (
        <section className="bg-white px-4 py-12 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-6 flex items-end justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100">
                  <Sparkles size={20} className="text-brand-700" />
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-brand-600">Tieši no ražotāja</span>
                  <h2 className="mt-0.5 text-2xl font-extrabold text-gray-900">Vēl silti — tikko ievietoti</h2>
                </div>
              </div>
              <Link href="/catalog?sort=newest"
                className="hidden items-center gap-1 text-sm font-medium text-brand-600 hover:underline sm:flex">
                Visi jaunākie <ArrowRight size={14} />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {newestListings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
            <div className="mt-6 text-center sm:hidden">
              <Link href="/catalog" className="btn-outline text-sm">Skatīt visus produktus</Link>
            </div>
          </div>
        </section>
      )}

      {/* ── SELLERS SPOTLIGHT ────────────────────────────────── */}
      <section className="px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-7 flex items-end justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-brand-600">Iepazīsti vārdā</span>
              <h2 className="mt-1 text-2xl font-extrabold text-gray-900">Mūsu saimnieki</h2>
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
              { icon: "🌾", step: "01", title: "Izvēlies produktu", desc: "Pārlūko katalogu vai izmanto meklēšanu — atrodi ko vēlies." },
              { icon: "🚚", step: "02", title: "Izvēlies piegādi", desc: "Pakomāts, kurjers vai ekspres — visā Latvijā." },
              { icon: "💳", step: "03", title: "Apmaksā droši", desc: "Paysera vai karte. Ražotājs saņem pasūtījumu." },
              { icon: "✅", step: "04", title: "Saņem ērti", desc: "Pakomātā 24/7, mājās vai dažu stundu laikā." },
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
                href: "/piegade",
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
              <h2 className="mt-1 text-2xl font-extrabold text-gray-900">IziPizi RECEPTE</h2>
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
                "🚚 Pakomāts, kurjers un ekspres piegāde",
                "❄️ Temperatūras ķēde no ražotāja",
                "📍 Visi izipizi pakomāti Latvijā",
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
