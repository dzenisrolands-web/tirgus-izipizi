"use client";

import Link from "next/link";
import Image from "next/image";
import { Minus, Plus, MapPin, CheckCircle, ShoppingCart, Check, Zap } from "lucide-react";
import { useState } from "react";
import { type Listing } from "@/lib/mock-data";
import { formatPrice, daysUntil, getStorageType, storageConfig, listingUrl } from "@/lib/utils";
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
  const storageType: "frozen" | "chilled" = rawStorageType === "frozen" ? "frozen" : "chilled";
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [qty, setQty] = useState(1);

  const hasVariants = (listing.variants?.length ?? 0) > 0;
  const variants = listing.variants ?? [];
  const [selectedVariantIdx, setSelectedVariantIdx] = useState(0);
  const activeVariant = hasVariants ? variants[selectedVariantIdx] : null;
  const activePrice = activeVariant?.price ?? listing.price;
  const activeTitle = activeVariant ? `${listing.title} — ${activeVariant.title}` : listing.title;
  const activeUnit = hasVariants ? (activeVariant?.title ?? listing.unit) : listing.unit;

  function handleAddToCart(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    addItem({
      id: activeVariant?.id ?? listing.id,
      title: activeTitle,
      price: activePrice,
      unit: activeUnit,
      image: listing.image,
      sellerName: listing.seller.farmName,
      sellerId: listing.sellerId,
      storageType,
      express_delivery: listing.express_delivery ?? false,
    });
    // If qty > 1, add remaining via updateQty after first add
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  const url = listingUrl(listing);

  return (
    <div className="group flex h-full flex-col rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden hover:shadow-md transition">
      {/* Image */}
      <Link href={url} className="relative aspect-square w-full overflow-hidden bg-gray-100 block">
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
      </Link>

      {/* Content */}
      <div className="flex flex-1 flex-col p-3">
        {/* Title + seller */}
        <Link href={url} className="flex-1">
          <p className="line-clamp-2 text-sm font-bold leading-snug text-gray-900 group-hover:text-brand-600">{listing.title}</p>
          <div className="mt-1 flex items-center gap-1">
            {listing.seller.verified && <CheckCircle size={11} className="shrink-0 text-brand-600" />}
            <span className="truncate text-xs text-gray-500">{listing.seller.farmName}</span>
          </div>
          {listing.seller.location && (
            <div className="mt-0.5 flex items-center gap-1 text-xs text-gray-400">
              <MapPin size={10} className="shrink-0" />
              <span className="truncate">no {listing.seller.location}</span>
            </div>
          )}
        </Link>

        {/* Variant selector */}
        {hasVariants && variants.length > 1 && (
          <div className="mt-2">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Izmērs</p>
            <div className="flex flex-wrap gap-1">
              {variants.map((v, i) => (
                <button
                  key={v.id}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedVariantIdx(i); }}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[10px] font-semibold transition border",
                    i === selectedVariantIdx
                      ? "border-brand-500 bg-brand-50 text-brand-800"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                  )}>
                  {v.title}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom: price row + action row */}
      <div className="mt-auto border-t border-gray-100 px-3 pb-3 pt-2 space-y-2">
        {/* Price */}
        <div className="flex items-baseline gap-1">
          {hasVariants && <span className="text-xs font-medium text-gray-400">no</span>}
          <span className="text-xl font-extrabold text-gray-900">{formatPrice(activePrice)}</span>
          {!hasVariants && <span className="text-xs text-gray-400">/ {listing.unit}</span>}
        </div>
        {/* Qty + Cart */}
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center rounded-full border border-gray-200">
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setQty(Math.max(1, qty - 1)); }}
              className="flex h-8 w-8 items-center justify-center text-gray-500 hover:bg-gray-50 rounded-l-full transition">
              <Minus size={14} />
            </button>
            <span className="w-7 text-center text-sm font-bold text-gray-900">{qty}</span>
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setQty(qty + 1); }}
              className="flex h-8 w-8 items-center justify-center text-gray-500 hover:bg-gray-50 rounded-r-full transition">
              <Plus size={14} />
            </button>
          </div>
          <button
            onClick={handleAddToCart}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-sm font-bold transition-all",
              added
                ? "bg-green-500 text-white"
                : "bg-brand-500 text-white hover:bg-brand-600"
            )}>
            {added ? <><Check size={14} /> Pievienots!</> : <><ShoppingCart size={14} /> Grozā</>}
          </button>
        </div>
      </div>
    </div>
  );
}
