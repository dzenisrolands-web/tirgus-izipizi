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
      result = result.filter((l) => l.title.toLowerCase().includes(q) || l.description.toLowerCase().includes(q));
    }
    return result;
  }, [listings, query, activeCategory]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">Produkti ({listings.length})</h2>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {["Visi", ...categories].map((cat) => (
          <button key={cat} onClick={() => setActiveCategory(cat)}
            className={cn("rounded-full px-3 py-1 text-xs font-medium transition",
              activeCategory === cat ? "bg-[#192635] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>
            {cat}
          </button>
        ))}
      </div>

      <div className="relative mt-3">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Meklēt produktu..."
          className="input pl-8 py-2 text-sm rounded-xl w-full" />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {filtered.map((l) => <ListingCard key={l.id} listing={l} />)}
      </div>

      {filtered.length === 0 && (
        <p className="mt-8 text-center text-sm text-gray-400">Nav atrasts neviens produkts</p>
      )}
    </div>
  );
}
