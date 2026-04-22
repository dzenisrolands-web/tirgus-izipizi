"use client";

import { useState, useMemo } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { listings } from "@/lib/mock-data";
import { ListingCard } from "@/components/listing-card";
import { FilterSidebar } from "@/components/filter-sidebar";
import { cn } from "@/lib/utils";

type Filters = {
  category: string;
  city: string;
  maxPrice: number;
};

const SORT_OPTIONS = [
  { value: "newest", label: "Jaunākie" },
  { value: "price_asc", label: "Cena: augšup" },
  { value: "price_desc", label: "Cena: lejup" },
];

export default function CatalogPage() {
  const [filters, setFilters] = useState<Filters>({
    category: "Visi",
    city: "",
    maxPrice: 50,
  });
  const [sort, setSort] = useState("newest");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const filtered = useMemo(() => {
    let result = [...listings];

    if (filters.category !== "Visi") {
      result = result.filter((l) => l.category === filters.category);
    }
    if (filters.city) {
      result = result.filter((l) => l.locker.city === filters.city);
    }
    result = result.filter((l) => l.price <= filters.maxPrice);

    if (sort === "price_asc") result.sort((a, b) => a.price - b.price);
    else if (sort === "price_desc") result.sort((a, b) => b.price - a.price);
    else result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return result;
  }, [filters, sort]);

  const activeFilterCount = [
    filters.category !== "Visi",
    filters.city !== "",
    filters.maxPrice < 50,
  ].filter(Boolean).length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Visi produkti</h1>
          <p className="mt-1 text-sm text-gray-500">{filtered.length} produkti</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Sort */}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-brand-500 focus:outline-none"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Mobile filter toggle */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={cn(
              "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm lg:hidden",
              activeFilterCount > 0
                ? "border-brand-500 bg-brand-50 text-brand-700"
                : "border-gray-200 text-gray-700"
            )}
          >
            <SlidersHorizontal size={15} />
            Filtri
            {activeFilterCount > 0 && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 text-[10px] text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="mt-6 flex gap-8">
        {/* Desktop sidebar */}
        <div className="hidden w-52 shrink-0 lg:block">
          <FilterSidebar filters={filters} onChange={setFilters} />
        </div>

        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div
              className="absolute inset-0 bg-black/30"
              onClick={() => setSidebarOpen(false)}
            />
            <div className="absolute bottom-0 left-0 right-0 max-h-[80vh] overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <p className="font-semibold text-gray-900">Filtri</p>
                <button onClick={() => setSidebarOpen(false)}>
                  <X size={20} className="text-gray-500" />
                </button>
              </div>
              <FilterSidebar filters={filters} onChange={setFilters} />
              <button
                className="btn-primary mt-4 w-full"
                onClick={() => setSidebarOpen(false)}
              >
                Rādīt {filtered.length} produktus
              </button>
            </div>
          </div>
        )}

        {/* Grid */}
        <div className="flex-1">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-lg font-semibold text-gray-500">Nav atrasts neviens produkts</p>
              <p className="mt-1 text-sm text-gray-400">Mēģini mainīt filtrus</p>
              <button
                className="btn-outline mt-4"
                onClick={() => setFilters({ category: "Visi", city: "", maxPrice: 50 })}
              >
                Notīrīt filtrus
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
              {filtered.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
