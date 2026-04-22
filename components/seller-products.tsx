"use client";

import { useState, useMemo } from "react";
import { Search } from "lucide-react";
import { type Listing } from "@/lib/mock-data";
import { ListingCard } from "@/components/listing-card";
import { cn } from "@/lib/utils";

type Props = {
  listings: Listing[];
  categories: string[];
};

export function SellerProducts({ listings, categories }: Props) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("Visi");

  const filtered = useMemo(() => {
    let result = listings;
    if (activeCategory !== "Visi") result = result.filter((l) => l.category === activeCategory);
    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter((l) => l.title.toLowerCase().includes(q));
    }
    return result;
  }, [listings, activeCategory, query]);

  return (
    <div className="mt-8 pb-16">
      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-bold text-gray-900">
          Produkti · <span className="text-gray-400 font-normal">{filtered.length}</span>
        </h2>
        <div className="relative w-full max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Meklēt produktus..."
            className="input pl-9 w-full rounded-full border-gray-200 bg-gray-50 py-2 text-sm"
          />
        </div>
      </div>

      {/* Category pills */}
      <div className="mt-3 flex flex-wrap gap-2">
        {["Visi", ...categories].map((cat) => (
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
          <p className="text-gray-500">Nav atrasts neviens produkts.</p>
          <button
            className="btn-outline mt-3"
            onClick={() => { setQuery(""); setActiveCategory("Visi"); }}
          >
            Notīrīt
          </button>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((l) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </div>
      )}
    </div>
  );
}
