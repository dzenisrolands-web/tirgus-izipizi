import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import {
  Star, CheckCircle, MapPin, Package,
  Globe, Youtube, Instagram, Facebook,
  Calendar, Award, Quote,
} from "lucide-react";
import { sellers, listings } from "@/lib/mock-data";
import { sellersMeta } from "@/lib/sellers-meta";
import { fetchDbSellerProfile } from "@/lib/db-listings";
import { SellerProducts } from "@/components/seller-products";
import { FollowSellerButton } from "@/components/follow-seller-button";
import { hasValidImage } from "@/lib/utils";

export const dynamicParams = true;

export async function generateStaticParams() {
  return sellers.map((s) => ({ id: s.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const mockSeller = sellers.find((s) => s.id === id);
  const seller = mockSeller ?? (await fetchDbSellerProfile(id))?.seller;
  if (!seller) return {};
  const meta = sellersMeta[id] ?? (await fetchDbSellerProfile(id))?.meta;
  const title = `${seller.name} | tirgus.izipizi.lv`;
  const description = meta?.shortDesc ?? `${seller.name} produkti IziPizi tirgū.`;
  const ogImage = meta?.cover ?? seller.avatar;
  return {
    title,
    description,
    keywords: meta?.keywords?.join(", "),
    alternates: { canonical: `/seller/${id}` },
    openGraph: {
      title,
      description,
      url: `https://tirgus.izipizi.lv/seller/${id}`,
      images: [{ url: ogImage, width: 1200, height: 630, alt: seller.name }],
      type: "profile",
      siteName: "tirgus.izipizi.lv",
    },
    twitter: { card: "summary_large_image", title, description, images: [ogImage] },
  };
}

export default async function SellerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const mockSeller = sellers.find((s) => s.id === id);

  let seller, meta, sellerListings;
  if (mockSeller) {
    seller = mockSeller;
    meta = sellersMeta[id];
    sellerListings = listings.filter((l) => l.sellerId === id).filter(hasValidImage);
  } else {
    const db = await fetchDbSellerProfile(id);
    if (!db) notFound();
    seller = db.seller;
    meta = db.meta;
    sellerListings = db.listings.filter(hasValidImage);
  }

  const categories = Array.from(new Set(sellerListings.map((l) => l.category))).sort();

  const jsonLd = {
    "@context": "https://schema.org", "@type": "FoodEstablishment",
    name: seller.name, description: meta?.shortDesc,
    image: meta?.cover || seller.avatar, url: meta?.website ?? `https://tirgus.izipizi.lv/seller/${id}`,
    address: { "@type": "PostalAddress", addressLocality: seller.location, addressCountry: "LV" },
    aggregateRating: seller.reviewCount > 0
      ? { "@type": "AggregateRating", ratingValue: seller.rating, reviewCount: seller.reviewCount, bestRating: 5, worstRating: 1 }
      : undefined,
    sameAs: [meta?.facebook, meta?.instagram, meta?.website].filter(Boolean),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Sākums", item: "https://tirgus.izipizi.lv" },
      { "@type": "ListItem", position: 2, name: "Ražotāji", item: "https://tirgus.izipizi.lv/razotaji" },
      { "@type": "ListItem", position: 3, name: seller.name, item: `https://tirgus.izipizi.lv/seller/${id}` },
    ],
  };

  const galleryImages = sellerListings.filter((l) => l.image).slice(0, 6).map((l) => ({ src: l.image, title: l.title }));

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <article>
        <div className="relative h-64 w-full sm:h-80"
          style={{ background: meta?.cover ? `url(${meta.cover}) center/cover no-repeat` : "linear-gradient(135deg, #192635 0%, #2d1f45 100%)" }}>
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 px-4 pb-5 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-6xl flex items-end gap-4">
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full border-2 border-white bg-white shadow-xl sm:h-24 sm:w-24">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={seller.avatar} alt={seller.name} className="h-full w-full object-contain p-1.5" />
              </div>
              <div className="pb-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-extrabold text-white sm:text-3xl drop-shadow-md">{seller.name}</h1>
                  {seller.verified && (
                    <span className="flex items-center gap-1 rounded-full bg-white/20 backdrop-blur-sm px-2.5 py-0.5 text-xs font-semibold text-white border border-white/30">
                      <CheckCircle size={12} /> Verificēts
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/80">
                  <span className="flex items-center gap-1"><MapPin size={13} /> {seller.location}</span>
                  <span className="flex items-center gap-1"><Package size={13} /> {sellerListings.length} produkti</span>
                  <span className="flex items-center gap-1"><Star size={13} fill="currentColor" className="text-amber-400" /> {seller.rating} ({seller.reviewCount})</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 flex flex-wrap items-center justify-end gap-2 border-b border-gray-100 pb-6 pt-4">
            <FollowSellerButton sellerId={id} sellerName={seller.name} />
            {meta?.website && <a href={meta.website} target="_blank" rel="noopener noreferrer" className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-500 transition hover:border-gray-400 hover:text-gray-900"><Globe size={16} /></a>}
            {meta?.facebook && <a href={meta.facebook} target="_blank" rel="noopener noreferrer" className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-500 transition hover:border-blue-500 hover:text-blue-600"><Facebook size={16} /></a>}
            {meta?.instagram && <a href={meta.instagram} target="_blank" rel="noopener noreferrer" className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-500 transition hover:border-pink-500 hover:text-pink-600"><Instagram size={16} /></a>}
            {meta?.youtubeChannel && <a href={meta.youtubeChannel} target="_blank" rel="noopener noreferrer" className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-500 transition hover:border-red-500 hover:text-red-600"><Youtube size={16} /></a>}
          </div>

          <div className="grid gap-10 lg:grid-cols-5">
            <div className="space-y-8 lg:col-span-2">
              {meta?.quote && (
                <div className="relative rounded-2xl bg-[#192635] px-6 py-5 text-white overflow-hidden">
                  <div className="absolute -top-2 -left-1 opacity-20"><Quote size={64} /></div>
                  <p className="relative text-base font-medium leading-relaxed text-white/90 italic">"{meta.quote.text}"</p>
                  <p className="mt-3 text-sm font-semibold" style={{ background: "linear-gradient(90deg,#53F3A4,#AD47FF)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>— {meta.quote.author}</p>
                </div>
              )}
              {meta?.description && (
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">Par ražotāju</h2>
                  <p className="mt-3 text-sm leading-7 text-gray-600">{meta.description}</p>
                </div>
              )}
              {meta?.facts && meta.facts.length > 0 && (
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">Fakti</h2>
                  <dl className="mt-3 space-y-2">
                    {meta.facts.map((f) => (
                      <div key={f.label} className="flex gap-3 rounded-xl bg-gray-50 px-3 py-2.5 text-sm">
                        <dt className="w-28 shrink-0 font-semibold text-gray-500">{f.label}</dt>
                        <dd className="text-gray-800">{f.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
              {meta?.milestones && meta.milestones.length > 0 && (
                <div>
                  <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400"><Award size={13} /> Sasniegumi & Fakti</h2>
                  <ul className="mt-3 space-y-3">
                    {meta.milestones.map((m, i) => (
                      <li key={i} className="flex gap-3 text-sm text-gray-600">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-[#192635]" style={{ background: "linear-gradient(135deg,#53F3A4,#AD47FF)" }}>{i + 1}</span>
                        <span className="leading-relaxed">{m}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {meta?.events && meta.events.length > 0 && (
                <div>
                  <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400"><Calendar size={13} /> Notikumi & Aktivitātes</h2>
                  <div className="mt-3 space-y-3">
                    {meta.events.map((ev, i) => (
                      <div key={i} className="rounded-2xl border border-brand-100 bg-brand-50/50 p-4">
                        <p className="text-sm font-bold text-brand-800">{ev.title}</p>
                        <p className="mt-1 text-xs leading-relaxed text-gray-600">{ev.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">Produktu kategorijas</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {categories.map((cat) => (
                    <Link key={cat} href={`/catalog?seller=${id}&category=${encodeURIComponent(cat)}`}
                      className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 transition hover:bg-brand-100 hover:text-brand-700">{cat}</Link>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-8 lg:col-span-3">
              {meta?.youtubeVideoId && (
                <div>
                  <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-400">Video</h2>
                  <div className="overflow-hidden rounded-2xl shadow-md">
                    <div className="relative aspect-video w-full">
                      <iframe src={`https://www.youtube.com/embed/${meta.youtubeVideoId}?rel=0&modestbranding=1`}
                        title={`${seller.name} video`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen className="absolute inset-0 h-full w-full" />
                    </div>
                  </div>
                </div>
              )}
              {galleryImages.length > 0 && (
                <div>
                  <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-400">Foto galerija</h2>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {galleryImages.map((img, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src={img.src} alt={img.title}
                        className={`w-full rounded-xl object-cover transition hover:opacity-90 ${i === 0 ? "col-span-2 row-span-2 aspect-square" : "aspect-square"}`} />
                    ))}
                  </div>
                </div>
              )}
              <SellerProducts listings={sellerListings} categories={categories} />
            </div>
          </div>
        </div>
      </article>
    </>
  );
}
