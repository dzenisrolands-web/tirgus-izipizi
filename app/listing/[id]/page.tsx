import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  MapPin,
  Star,
  CheckCircle,
  Clock,
  ShoppingCart,
  ArrowLeft,
  Thermometer,
} from "lucide-react";
import { listings, reviews } from "@/lib/mock-data";
import { formatPrice, formatDate, daysUntil } from "@/lib/utils";
import { ListingCard } from "@/components/listing-card";
import { ReviewsSection } from "@/components/reviews-section";

export async function generateStaticParams() {
  return listings.map((l) => ({ id: l.id }));
}

export default async function ListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const listing = listings.find((l) => l.id === id);

  if (!listing) notFound();

  const days = daysUntil(listing.freshnessDate);
  const listingReviews = reviews.filter((r) => r.listingId === id);
  const otherListings = listings
    .filter((l) => l.sellerId === listing.sellerId && l.id !== listing.id)
    .slice(0, 3);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Back */}
      <Link
        href="/catalog"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900"
      >
        <ArrowLeft size={16} />
        Atpakaļ uz katalogu
      </Link>

      <div className="grid gap-10 lg:grid-cols-2">
        {/* Image */}
        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-gray-100">
          <Image
            src={listing.image}
            alt={listing.title}
            fill
            className="object-cover"
            priority
          />
          <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-sm font-medium text-gray-700 backdrop-blur-sm">
            {listing.category}
          </span>
        </div>

        {/* Info */}
        <div className="flex flex-col gap-5">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900">{listing.title}</h1>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-gray-900">
                {formatPrice(listing.price)}
              </span>
              <span className="text-base text-gray-400">/ {listing.unit}</span>
            </div>
          </div>

          {/* Freshness */}
          <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3">
            <Clock size={16} className="shrink-0 text-amber-600" />
            <div>
              <p className="text-sm font-semibold text-amber-800">
                Derīgs līdz: {formatDate(listing.freshnessDate)}
              </p>
              <p className="text-xs text-amber-600">
                {days <= 0 ? "Beidzies!" : `Vēl ${days} diena${days === 1 ? "" : "s"}`}
              </p>
            </div>
          </div>

          {/* Description */}
          <div>
            <p className="text-sm font-semibold text-gray-700">Apraksts</p>
            <p className="mt-1.5 text-sm leading-relaxed text-gray-600">
              {listing.description}
            </p>
          </div>

          {/* Quantity */}
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span className="font-medium">Pieejams:</span>
            <span>{listing.quantity} {listing.unit}</span>
          </div>

          {/* Locker */}
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Saņemšanas vieta
            </p>
            <div className="mt-2 flex items-center gap-2">
              <MapPin size={16} className="shrink-0 text-brand-600" />
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {listing.locker.name}
                </p>
                <p className="text-xs text-gray-500">{listing.locker.address}</p>
              </div>
              <span className="ml-auto flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                <Clock size={10} />
                {listing.locker.hours}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-400">
              <Thermometer size={12} />
              Temperatūras kontrole: +2°C līdz +6°C
            </div>
          </div>

          {/* Add to cart */}
          <button className="btn-primary w-full py-3 text-base">
            <ShoppingCart size={18} className="mr-2" />
            Pievienot grozam
          </button>

          {/* Seller */}
          <div className="rounded-xl border border-gray-100 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Pārdevējs
            </p>
            <Link
              href={`/seller/${listing.sellerId}`}
              className="mt-3 flex items-center gap-3 hover:opacity-80"
            >
              <img
                src={listing.seller.avatar}
                alt={listing.seller.name}
                className="h-10 w-10 rounded-full object-cover"
              />
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-semibold text-gray-900">
                    {listing.seller.farmName}
                  </p>
                  {listing.seller.verified && (
                    <CheckCircle size={13} className="text-brand-600" />
                  )}
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

      {/* Reviews */}
      <section className="mt-14">
        <ReviewsSection reviews={listingReviews} />
      </section>

      {/* More from seller */}
      {otherListings.length > 0 && (
        <section className="mt-16">
          <h2 className="text-lg font-bold text-gray-900">
            Vairāk no {listing.seller.farmName}
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {otherListings.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
