import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { MapPin, Star, CheckCircle, Clock, ArrowLeft } from "lucide-react";
import { listings, sellerHomeLockers } from "@/lib/mock-data";
import { fetchListingById } from "@/lib/db-listings";
import { formatPrice, formatDate, daysUntil, getStorageType, storageConfig } from "@/lib/utils";
import { ListingCard } from "@/components/listing-card";
import { DeliveryChoice } from "@/components/delivery-choice";
import { ReviewsSectionDb } from "@/components/reviews-section-db";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { VariantSelector } from "@/components/variant-selector";

export const dynamicParams = true;

export async function generateStaticParams() {
  return listings.map((l) => ({ id: l.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const listing = listings.find((l) => l.id === id) ?? await fetchListingById(id);
  if (!listing) return {};
  const title = `${listing.title} — ${listing.seller.farmName} | tirgus.izipizi.lv`;
  const description = listing.description
    ? `${listing.description.slice(0, 140)}…`
    : `${listing.title} no ${listing.seller.farmName}. ${formatPrice(listing.price)} / ${listing.unit}. Saņem izipizi pakomātā.`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: listing.image, alt: listing.title }],
      type: "website",
      siteName: "tirgus.izipizi.lv",
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function ListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listing = listings.find((l) => l.id === id) ?? await fetchListingById(id);
  if (!listing) notFound();

  const days = daysUntil(listing.freshnessDate);
  const storage = storageConfig[getStorageType(listing)];
  const isHomeLocker = (sellerHomeLockers[listing.sellerId] ?? []).includes(listing.lockerId);
  const otherListings = listings.filter((l) => l.sellerId === listing.sellerId && l.id !== listing.id).slice(0, 3);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: listing.title,
    description: listing.description,
    image: listing.image,
    offers: {
      "@type": "Offer",
      price: listing.price,
      priceCurrency: "EUR",
      availability: listing.quantity > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      seller: { "@type": "Organization", name: listing.seller.farmName },
    },
    brand: { "@type": "Brand", name: listing.seller.farmName },
    aggregateRating: undefined,
  };

  return (
    <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/catalog" className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900">
        <ArrowLeft size={16} /> Atpakaļ uz katalogu
      </Link>

      <div className="grid gap-6 lg:gap-10 lg:grid-cols-2">
        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-gray-100">
          <Image src={listing.image} alt={listing.title} fill className="object-cover" priority />
          <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-sm font-medium text-gray-700 backdrop-blur-sm">
            {listing.category}
          </span>
        </div>

        <div className="flex flex-col gap-5">
          <div>
            <h1 className="text-xl font-extrabold text-gray-900 sm:text-2xl">{listing.title}</h1>
            {!listing.variants?.length && (
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-gray-900 sm:text-3xl">{formatPrice(listing.price)}</span>
                <span className="text-sm text-gray-400 sm:text-base">/ {listing.unit}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex flex-1 items-center gap-2 rounded-xl bg-amber-50 px-4 py-3">
              <Clock size={16} className="shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Derīgs līdz: {formatDate(listing.freshnessDate)}</p>
                <p className="text-xs text-amber-600">{days <= 0 ? "Beidzies!" : `Vēl ${days} diena${days === 1 ? "" : "s"}`}</p>
              </div>
            </div>
            <div className={`flex items-center gap-2 rounded-xl px-4 py-3 ${storage.cls}`}>
              <div>
                <p className="text-sm font-semibold">{storage.label}</p>
                <p className="text-xs opacity-70">Uzglabāšana</p>
              </div>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-700">Apraksts</p>
            <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{listing.description}</p>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span className="font-medium">Pieejams:</span>
            <span>{listing.quantity} {listing.unit}</span>
          </div>

          <DeliveryChoice locker={listing.locker} price={listing.price} isHomeLocker={isHomeLocker} />

          {listing.variants && listing.variants.length > 0 ? (
            <VariantSelector
              listingId={listing.id}
              title={listing.title}
              image={listing.image}
              sellerName={listing.seller.farmName}
              storageType={getStorageType(listing)}
              variants={listing.variants}
            />
          ) : (
            <AddToCartButton
              id={listing.id}
              title={listing.title}
              price={listing.price}
              unit={listing.unit}
              image={listing.image}
              sellerName={listing.seller.farmName}
              storageType={getStorageType(listing)}
            />
          )}

          <div className="rounded-xl border border-gray-100 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Pārdevējs</p>
            <Link href={`/seller/${listing.sellerId}`} className="mt-3 flex items-center gap-3 hover:opacity-80">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={listing.seller.avatar} alt={listing.seller.name} className="h-10 w-10 rounded-full object-cover" />
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-semibold text-gray-900">{listing.seller.farmName}</p>
                  {listing.seller.verified && <CheckCircle size={13} className="text-brand-600" />}
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Star size={11} fill="currentColor" className="text-amber-400" />
                  <span>{listing.seller.rating}</span>
                  <span className="text-gray-300">·</span>
                  <span>{listing.seller.reviewCount} atsauksmes</span>
                </div>
              </div>
              <span className="text-xs text-brand-600">Skatīt →</span>
            </Link>
          </div>
        </div>
      </div>

      <section className="mt-14"><ReviewsSectionDb listingId={id} /></section>

      {otherListings.length > 0 && (
        <section className="mt-16">
          <h2 className="text-lg font-bold text-gray-900">Vairāk no {listing.seller.farmName}</h2>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {otherListings.map((l) => <ListingCard key={l.id} listing={l} />)}
          </div>
        </section>
      )}
    </div>
    </>
  );
}
