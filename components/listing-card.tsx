import Link from "next/link";
import Image from "next/image";
import { MapPin, Star, CheckCircle } from "lucide-react";
import { type Listing } from "@/lib/mock-data";
import { formatPrice, daysUntil } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function ListingCard({ listing }: { listing: Listing }) {
  const days = daysUntil(listing.freshnessDate);
  const freshLabel =
    days <= 1 ? "Šodien" : days <= 3 ? `${days} dienas` : null;
  const freshUrgent = days <= 1;

  return (
    <Link href={`/listing/${listing.id}`} className="group block">
      {/* Image */}
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-gray-100">
        <Image
          src={listing.image}
          alt={listing.title}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        />
        {freshLabel && (
          <span
            className={cn(
              "absolute left-2 top-2 rounded-full px-2 py-0.5 text-xs font-semibold",
              freshUrgent
                ? "bg-red-500 text-white"
                : "bg-amber-400 text-amber-900"
            )}
          >
            {freshLabel}
          </span>
        )}
        <span className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-xs font-medium text-gray-700 backdrop-blur-sm">
          {listing.category}
        </span>
      </div>

      {/* Content */}
      <div className="mt-2 space-y-1 px-0.5">
        <p className="truncate text-sm font-semibold text-gray-900 group-hover:text-brand-600">
          {listing.title}
        </p>

        {/* Seller */}
        <div className="flex items-center gap-1">
          {listing.seller.verified && (
            <CheckCircle size={12} className="shrink-0 text-brand-600" />
          )}
          <span className="truncate text-xs text-gray-500">
            {listing.seller.farmName}
          </span>
          <span className="ml-auto flex shrink-0 items-center gap-0.5 text-xs text-amber-500">
            <Star size={11} fill="currentColor" />
            {listing.seller.rating}
          </span>
        </div>

        {/* Locker */}
        <div className="flex items-center gap-1 text-xs text-gray-400">
          <MapPin size={11} className="shrink-0" />
          <span className="truncate">{listing.locker.city} · {listing.locker.name}</span>
        </div>

        {/* Price */}
        <div className="flex items-baseline gap-1">
          <span className="text-base font-bold text-gray-900">
            {formatPrice(listing.price)}
          </span>
          <span className="text-xs text-gray-400">/ {listing.unit}</span>
        </div>
      </div>
    </Link>
  );
}
