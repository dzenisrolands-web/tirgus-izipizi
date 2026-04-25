"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, Star, MapPin, CheckCircle, Package, Globe, Facebook, Instagram, Youtube } from "lucide-react";
import { sellers, listings } from "@/lib/mock-data";
import { sellersMeta, type SellerMeta } from "@/lib/sellers-meta";
import { cn } from "@/lib/utils";

export function RazotajiClient() {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("Visi");

  const enriched = useMemo(() => {
    return sellers.map((seller) => {
      const sellerListings = listings.filter((l) => l.sellerId === seller.id);
      const cats = Array.from(new Set(sellerListings.map((l) => l.category))).sort();
      const meta = sellersMeta[seller.id] ?? { cover: "", description: "", shortDesc: "", facts: [], milestones: [], keywords: [] };
      return { ...seller, listings: sellerListings, categories: cats, meta };
    });
  }, []);

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
        (s) => s.name.toLowerCase().includes(q) || s.farmName.toLowerCase().includes(q) ||
          s.location.toLowerCase().includes(q) || s.categories.some((c) => c.toLowerCase().includes(q))
      );
    }
    if (activeCategory !== "Visi") result = result.filter((s) => s.categories.includes(activeCategory));
    return result;
  }, [enriched, query, activeCategory]);

  return (
    <div>
      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Meklēt ražotājus..."
            className="input pl-10 w-full rounded-full border-gray-200 bg-gray-50 py-2 text-sm" />
        </div>
        <p className="text-sm text-gray-400 shrink-0">{filtered.length} ražotāj{filtered.length === 1 ? "s" : "i"}</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {allCategories.map((cat) => (
          <button key={cat} onClick={() => setActiveCategory(cat)}
            className={cn("rounded-full px-3 py-1 text-xs font-medium transition",
              activeCategory === cat ? "bg-brand-700 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>
            {cat}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="mt-16 text-center">
          <p className="text-gray-500">Neviens ražotājs neatbilst meklēšanai.</p>
          <button className="btn-outline mt-3" onClick={() => { setQuery(""); setActiveCategory("Visi"); }}>Notīrīt</button>
        </div>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((seller) => <SellerCard key={seller.id} seller={seller} />)}
        </div>
      )}
    </div>
  );
}

type EnrichedSeller = (typeof sellers)[0] & { listings: typeof listings; categories: string[]; meta: SellerMeta };

function SellerCard({ seller }: { seller: EnrichedSeller }) {
  return (
    <Link href={`/seller/${seller.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition hover:shadow-md hover:border-brand-200 cursor-pointer">
      <div className="relative h-32 w-full overflow-hidden bg-gray-100">
        {seller.meta.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={seller.meta.cover} alt={seller.name} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-brand-950 to-brand-800" />
        )}
        <div className="absolute bottom-0 left-4 translate-y-1/2">
          <div className="h-14 w-14 overflow-hidden rounded-full border-2 border-white bg-white shadow-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={seller.avatar} alt={seller.name} className="h-full w-full object-contain p-1" />
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent pb-2 pt-6 px-4">
          <p className="text-sm font-bold text-white drop-shadow ml-[4.5rem] leading-tight line-clamp-1">{seller.name}</p>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4 pt-10">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {seller.verified && (
              <span className="flex items-center gap-0.5 text-xs text-brand-600 font-medium">
                <CheckCircle size={11} /> Verificēts
              </span>
            )}
            <span className="flex items-center gap-0.5 text-xs text-gray-500"><MapPin size={11} />{seller.location}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Star size={11} fill="currentColor" className="text-amber-400" />
            <span className="text-xs text-amber-600 font-semibold">{seller.rating}</span>
            <span className="text-xs text-gray-400">({seller.reviewCount})</span>
          </div>
        </div>

        {(seller.meta.shortDesc || seller.meta.description) && (
          <p className="mt-3 text-xs text-gray-500 line-clamp-2 leading-relaxed">
            {seller.meta.shortDesc || seller.meta.description}
          </p>
        )}

        <div className="mt-2 flex items-center gap-2">
          {seller.meta.website && <a href={seller.meta.website} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-gray-400 hover:text-gray-700 transition"><Globe size={13} /></a>}
          {seller.meta.facebook && <a href={seller.meta.facebook} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-gray-400 hover:text-blue-600 transition"><Facebook size={13} /></a>}
          {seller.meta.instagram && <a href={seller.meta.instagram} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-gray-400 hover:text-pink-600 transition"><Instagram size={13} /></a>}
          {(seller.meta.youtubeChannel || seller.meta.youtubeVideoId) && (
            <a href={seller.meta.youtubeChannel || `https://youtube.com/watch?v=${seller.meta.youtubeVideoId}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-gray-400 hover:text-red-600 transition"><Youtube size={13} /></a>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-1">
          {seller.categories.slice(0, 4).map((cat) => (
            <span key={cat} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{cat}</span>
          ))}
          {seller.categories.length > 4 && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-400">+{seller.categories.length - 4}</span>}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-gray-50 pt-3">
          <span className="flex items-center gap-1 text-xs text-gray-400"><Package size={12} />{seller.listings.length} produkti</span>
          <span className="rounded-full bg-brand-700 px-4 py-1.5 text-xs font-semibold text-white group-hover:bg-brand-800 transition">Skatīt profilu →</span>
        </div>
      </div>
    </Link>
  );
}
