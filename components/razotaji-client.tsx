"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, Star, MapPin, CheckCircle, Package } from "lucide-react";
import { sellers, listings } from "@/lib/mock-data";
import { sellersMeta } from "@/lib/sellers-meta";
import { cn } from "@/lib/utils";

export function RazotajiClient() {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("Visi");

  // Build enriched seller data
  const enriched = useMemo(() => {
    return sellers.map((seller) => {
      const sellerListings = listings.filter((l) => l.sellerId === seller.id);
      const cats = Array.from(new Set(sellerListings.map((l) => l.category))).sort();
      const meta = sellersMeta[seller.id] ?? { cover: "", description: "" };
      return { ...seller, listings: sellerListings, categories: cats, meta };
    });
  }, []);

  // All categories across all sellers
  const allCategories = useMemo(() => {
    const set = new Set<string>();
    enriched.forEach((s) => s.categories.forEach((c) => set.add(c)));
    return ["Visi", ...Array.from(set).sort()];
  }, [enriched]);

  const filtered = useMemo(() => {
    let result = enriched;
    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.farmName.toLowerCase().includes(q) ||
          s.location.toLowerCase().includes(q) ||
          s.categories.some((c) => c.toLowerCase().includes(q))
      );
    }
    if (activeCategory !== "Visi") {
      result = result.filter((s) => s.categories.includes(activeCategory));
    }
    return result;
  }, [enriched, query, activeCategory]);

  return (
    <div>
      {/* Search */}
      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Meklēt ražotājus..."
            className="input pl-10 w-full rounded-full border-gray-200 bg-gray-50 py-2 text-sm"
          />
        </div>
        <p className="text-sm text-gray-400 shrink-0">
          {filtered.length} ražotāj{filtered.length === 1 ? "s" : "i"}
        </p>
      </div>

      {/* Category pills */}
      <div className="mt-4 flex flex-wrap gap-2">
        {allCategories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition",
              activeCategory === cat
                ? "bg-brand-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="mt-16 text-center">
          <p className="text-gray-500">Neviens ražotājs neatbilst meklēšanai.</p>
          <button
            className="btn-outline mt-3"
            onClick={() => { setQuery(""); setActiveCategory("Visi"); }}
          >
            Notīrīt
          </button>
        </div>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((seller) => (
            <SellerCard key={seller.id} seller={seller} />
          ))}
        </div>
      )}
    </div>
  );
}

type EnrichedSeller = (typeof sellers)[0] & {
  listings: typeof listings;
  categories: string[];
  meta: { cover: string; description: string };
};

function SellerCard({ seller }: { seller: EnrichedSeller }) {
  const cover = seller.meta.cover;

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition hover:shadow-md">
      {/* Cover banner */}
      <div className="relative h-32 w-full overflow-hidden bg-gray-100">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt={seller.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-brand-600 to-brand-800" />
        )}
        {/* Logo overlay */}
        <div className="absolute bottom-0 left-4 translate-y-1/2">
          <div className="h-14 w-14 overflow-hidden rounded-xl border-2 border-white bg-white shadow">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={seller.avatar}
              alt={seller.name}
              className="h-full w-full object-contain p-1"
            />
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-4 pt-10">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="font-bold text-gray-900 leading-snug">{seller.name}</h2>
            <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
              {seller.verified && (
                <span className="flex items-center gap-0.5 text-brand-600">
                  <CheckCircle size={11} />
                  Verificēts
                </span>
              )}
              <span className="flex items-center gap-0.5">
                <MapPin size={11} />
                {seller.location}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className="flex items-center gap-0.5 text-xs text-amber-500 font-semibold">
              <Star size={12} fill="currentColor" />
              {seller.rating}
            </span>
            <span className="text-xs text-gray-400">{seller.reviewCount} atsauksmes</span>
          </div>
        </div>

        {/* Description */}
        {seller.meta.description && (
          <p className="mt-3 text-xs text-gray-500 line-clamp-2 leading-relaxed">
            {seller.meta.description}
          </p>
        )}

        {/* Category badges */}
        <div className="mt-3 flex flex-wrap gap-1">
          {seller.categories.slice(0, 4).map((cat) => (
            <span
              key={cat}
              className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
            >
              {cat}
            </span>
          ))}
          {seller.categories.length > 4 && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-400">
              +{seller.categories.length - 4}
            </span>
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 flex items-center justify-between border-t border-gray-50 pt-3">
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <Package size={12} />
            {seller.listings.length} produkti
          </span>
          <Link
            href={`/seller/${seller.id}`}
            className="rounded-full bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 transition"
          >
            Skatīt produktus →
          </Link>
        </div>
      </div>
    </div>
  );
}

