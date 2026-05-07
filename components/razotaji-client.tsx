"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, MapPin, CheckCircle, Package } from "lucide-react";
import { type Seller, type Listing } from "@/lib/mock-data";
import { type SellerMeta } from "@/lib/sellers-meta";
import type { DbSellerProfile } from "@/lib/db-listings";
import { cn } from "@/lib/utils";

type EnrichedSeller = Seller & { listings: Listing[]; categories: string[]; meta: SellerMeta };

export function RazotajiClient({ dbSellers = [] }: { dbSellers?: DbSellerProfile[] }) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("Visi");

  const enriched = useMemo<EnrichedSeller[]>(() => {
    return dbSellers.map((d) => {
      const cats = Array.from(new Set(d.listings.map((l) => l.category))).sort();
      return { ...d.seller, listings: d.listings, categories: cats, meta: d.meta };
    });
  }, [dbSellers]);

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

function SellerCard({ seller }: { seller: EnrichedSeller }) {
  const profileHref = `/seller/${seller.id}`;
  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition hover:shadow-md hover:border-brand-200">
      {/* Hero is its own Link → clicking image/avatar/name navigates to profile */}
      <Link href={profileHref} aria-label={`Skatīt ${seller.name} profilu`} className="block">
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
      </Link>

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
          {/* Reitings + atsauksmju skaits paslēpts pirms launch — atgriezts, kad būs atsauksmju lapa */}
        </div>

        {(seller.meta.shortDesc || seller.meta.description) && (
          <Link href={profileHref} className="mt-3 block text-xs text-gray-500 line-clamp-2 leading-relaxed hover:text-gray-700">
            {seller.meta.shortDesc || seller.meta.description}
          </Link>
        )}

        <div className="mt-3 flex flex-wrap gap-1">
          {seller.categories.slice(0, 4).map((cat) => (
            <span key={cat} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{cat}</span>
          ))}
          {seller.categories.length > 4 && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-400">+{seller.categories.length - 4}</span>}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-gray-50 pt-3">
          <span className="flex items-center gap-1 text-xs text-gray-400"><Package size={12} />{seller.listings.length} produkti</span>
          <Link href={profileHref} className="rounded-full bg-brand-700 px-4 py-1.5 text-xs font-semibold text-white group-hover:bg-brand-800 transition">Skatīt profilu →</Link>
        </div>
      </div>
    </div>
  );
}
