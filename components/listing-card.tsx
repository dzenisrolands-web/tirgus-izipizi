"use client";

import Link from "next/link";
import Image from "next/image";
import { MapPin, Star, CheckCircle, ShoppingCart, Check, Zap } from "lucide-react";
import { useState } from "react";
import { type Listing } from "@/lib/mock-data";
import { formatPrice, daysUntil, getStorageType, storageConfig } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useCart } from "@/lib/cart-context";
import { useStorageTypes } from "@/lib/storage-types-context";

export function ListingCard({ listing }: { listing: Listing }) {
  const days = daysUntil(listing.freshnessDate);
  const freshLabel = days <= 1 ? "Šodien" : days <= 3 ? `${days} dienas` : null;
  const freshUrgent = days <= 1;
  const expressAvailable = listing.express_delivery ?? listing.seller.location === "Rīga";
  const storageTypes = useStorageTypes();
  const rawStorageType = storageTypes[listing.id] ?? getStorageType(listing);
  // Defensive: if DB still has legacy "ambient" or unexpected value, fall back to chilled
  const storageType: "frozen" | "chilled" = rawStorageType === "frozen" ? "frozen" : "chilled";
  const storage = storageConfig[storageType];
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const hasVariants = (listing.variants?.length ?? 0) > 0;

  function handleAddToCart(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    // With variants the user must pick a size before adding — let the card
    // navigate to the listing page instead of adding the wrong/cheapest one.
    if (hasVariants) {
      window.location.href = `/listing/${listing.id}`;
      return;
    }
    addItem({
      id: listing.id,
      title: listing.title,
      price: listing.price,
      unit: listing.unit,
      image: listing.image,
      sellerName: listing.seller.farmName,
      sellerId: listing.sellerId,
      storageType: storageType,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  return (
    <Link href={`/listing/${listing.id}`} className="group block">
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-gray-100">
        {listing.image && !imageError ? (
          <Image src={listing.image} alt={listing.title} fill
            onError={() => setImageError(true)}
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1 bg-gradient-to-br from-gray-100 to-gray-200">
            <ShoppingCart size={32} className="text-gray-300" />
            <p className="text-[10px] font-medium text-gray-400">Bilde nav pieejama</p>
          </div>
        )}
        {freshLabel && (
          <span className={cn("absolute left-2 top-2 rounded-full px-2 py-0.5 text-xs font-semibold",
            freshUrgent ? "bg-red-500 text-white" : "bg-amber-400 text-amber-900")}>
            {freshLabel}
          </span>
        )}
        <span className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-xs font-medium text-gray-700 backdrop-blur-sm">
          {listing.category}
        </span>
        {expressAvailable && (
          <span className="absolute bottom-2 left-2 flex items-center gap-0.5 rounded-full bg-yellow-400/90 px-2 py-0.5 text-[10px] font-bold text-yellow-900 backdrop-blur-sm">
            <Zap size={9} /> Ekspres
          </span>
        )}
      </div>

      <div className="mt-2 space-y-1 px-0.5">
        <p className="truncate text-sm font-semibold text-gray-900 group-hover:text-brand-600">{listing.title}</p>

        <div className="flex items-center gap-1">
          {listing.seller.verified && <CheckCircle size={12} className="shrink-0 text-brand-600" />}
          <span className="truncate text-xs text-gray-500">{listing.seller.farmName}</span>
          <span className="ml-auto flex shrink-0 items-center gap-0.5 text-xs text-amber-500">
            <Star size={11} fill="currentColor" />{listing.seller.rating}
          </span>
        </div>

        {listing.seller.location && (
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <MapPin size={11} className="shrink-0" />
            <span className="truncate">no {listing.seller.location}</span>
          </div>
        )}

        <div className="flex items-center justify-between gap-1 pt-0.5">
          <div className="flex items-baseline gap-1 min-w-0">
            {hasVariants && <span className="text-xs font-medium text-gray-400">no</span>}
            <span className="text-base font-bold text-gray-900">{formatPrice(listing.price)}</span>
            {!hasVariants && <span className="text-xs text-gray-400 truncate">/ {listing.unit}</span>}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none", storage.cls)}>
              {storage.label}
            </span>
            <button onClick={handleAddToCart} title={added ? "Pievienots!" : "Ielikt grozā"}
              className={cn("flex h-8 w-8 items-center justify-center rounded-full transition-all",
                added ? "bg-green-500 text-white" : "bg-[#192635] text-white hover:bg-[#243647]")}>
              {added ? <Check size={13} /> : <ShoppingCart size={13} />}
            </button>
          </div>
        </div>
      </div>
    </Link>
  );
}
