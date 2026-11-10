"use client";

import { useState, useMemo } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { SlidersHorizontal, X, Star } from "lucide-react";
import { type Listing } from "@/lib/mock-data";
import { ListingCard } from "@/components/listing-card";
import { FilterSidebar, type Filters } from "@/components/filter-sidebar";
import { cn } from "@/lib/utils";
import { useStorageTypes } from "@/lib/storage-types-context";
import {
  catalogFilters, catalogFilterParams, clearedCatalogParams, catalogSort, catalogQuery,
  catalogSellerOptions, catalogPriceCeiling, activeCatalogFilterCount, filterAndSortCatalog,
  type CatalogSeller,
} from "./catalog-state";

const SORT_OPTIONS = [
  { value: "newest", label: "Jaunākie" },
  { value: "alpha_asc", label: "Alfabētiski (A–Z)" },
  { value: "alpha_desc", label: "Alfabētiski (Z–A)" },
  { value: "price_asc", label: "Cena: augšup" },
  { value: "price_desc", label: "Cena: lejup" },
];

export function CatalogClient({
  listings,
  weeklyFeatured = [],
  sellers,
}: {
  listings: Listing[];
  weeklyFeatured?: Listing[];
  sellers?: CatalogSeller[];
}) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const storageTypes = useStorageTypes();

  function navigate(next: URLSearchParams) {
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function clearQuery() {
    const next = new URLSearchParams(params.toString());
    next.delete("q");
    navigate(next);
  }

  const filters = useMemo(() => catalogFilters(params), [params]);
  const query = catalogQuery(params.get("q"));
  const sort = catalogSort(params.get("sort"));
  const sellerOptions = useMemo(() => sellers ?? catalogSellerOptions(listings), [listings, sellers]);
  const priceCeiling = useMemo(() => catalogPriceCeiling(listings), [listings]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  function setFilters(next: Filters | ((current: Filters) => Filters)) {
    navigate(catalogFilterParams(new URLSearchParams(params.toString()), typeof next === "function" ? next(filters) : next));
  }

  function clearFilters() {
    navigate(clearedCatalogParams(new URLSearchParams(params.toString())));
  }

  const filtered = useMemo(() => filterAndSortCatalog(listings, filters, sort, storageTypes),
    [listings, filters, sort, storageTypes]);

  const activeFilterCount = activeCatalogFilterCount(filters, query);
  const showFeatured = weeklyFeatured.length > 0 && activeFilterCount === 0;

  const activeSeller = filters.seller ? sellerOptions.find((s) => s.id === filters.seller) : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Weekly featured strip — only on clean catalog view */}
      {showFeatured && (
        <section className="mb-8 rounded-2xl bg-gradient-to-br from-yellow-50 via-white to-purple-50 p-5 sm:p-6 ring-1 ring-amber-100">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ background: "linear-gradient(135deg,#fef3c7,#e9d5ff)" }}>
              <Star size={18} className="text-amber-600" fill="currentColor" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700">Redaktoru izvēle</p>
              <h2 className="text-lg font-extrabold text-gray-900">Nedēļas piedāvājums</h2>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
            {weeklyFeatured.map((listing) => (
              <ListingCard key={`featured-${listing.id}`} listing={listing} />
            ))}
          </div>
        </section>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {activeSeller ? activeSeller.name : "Visi produkti"}
          </h1>
          <p className="mt-1 text-sm text-gray-500">{filtered.length} produkti</p>
        </div>

        <div className="flex items-center gap-3">
          <select aria-label="Kārtot produktus" value={sort} onChange={(e) => {
            const next = new URLSearchParams(params.toString());
            next.set("sort", catalogSort(e.target.value));
            navigate(next);
          }}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-brand-500 focus:outline-none">
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <button onClick={() => setSidebarOpen(!sidebarOpen)}
            className={cn(
              "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm lg:hidden",
              activeFilterCount > 0 ? "border-brand-500 bg-brand-50 text-brand-700" : "border-gray-200 text-gray-700"
            )}>
            <SlidersHorizontal size={15} />
            Filtri
            {activeFilterCount > 0 && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand-700 text-[10px] text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {(activeSeller || query.trim()) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {query.trim() && (
            <span className="flex items-center gap-2 rounded-full border border-gray-200 bg-gray-100 px-3 py-1 text-sm text-gray-700">
              Meklēts: <strong>{query}</strong>
              <button onClick={clearQuery}><X size={14} /></button>
            </span>
          )}
          {activeSeller && (
            <span className="flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-sm text-brand-700">
              {activeSeller.name}
              <button onClick={() => setFilters((f) => ({ ...f, seller: "" }))}><X size={14} /></button>
            </span>
          )}
        </div>
      )}

      <div className="mt-6 flex gap-8">
        <div className="hidden w-52 shrink-0 lg:block">
          <FilterSidebar filters={filters} onChange={setFilters} sellers={sellerOptions} priceCeiling={priceCeiling} onClear={clearFilters} />
        </div>

        {sidebarOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-black/30" onClick={() => setSidebarOpen(false)} />
            <div className="absolute bottom-0 left-0 right-0 max-h-[80vh] overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <p className="font-semibold text-gray-900">Filtri</p>
                <button onClick={() => setSidebarOpen(false)}><X size={20} className="text-gray-500" /></button>
              </div>
              <FilterSidebar filters={filters} onChange={setFilters} sellers={sellerOptions} priceCeiling={priceCeiling} onClear={clearFilters} />
              <button className="btn-primary mt-4 w-full" onClick={() => setSidebarOpen(false)}>
                Rādīt {filtered.length} produktus
              </button>
            </div>
          </div>
        )}

        <div className="flex-1">
          <div className="mb-4 flex flex-wrap gap-2">
            {([
              { value: "all",     label: "Visi" },
              { value: "frozen",  label: "❄ -18°C" },
              { value: "chilled", label: "🌡 +2°C – +6°C" },
            ] as const).map((opt) => (
              <button key={opt.value}
                onClick={() => setFilters(f => ({ ...f, storageType: opt.value }))}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold transition",
                  filters.storageType === opt.value
                    ? opt.value === "frozen"  ? "bg-blue-600 text-white"
                    : opt.value === "chilled" ? "bg-cyan-600 text-white"
                    : "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}>
                {opt.label}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-lg font-semibold text-gray-500">Nav atrasts neviens produkts</p>
              <p className="mt-1 text-sm text-gray-400">Mēģini mainīt filtrus</p>
              <button className="btn-outline mt-4" onClick={clearFilters}>Notīrīt filtrus</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
