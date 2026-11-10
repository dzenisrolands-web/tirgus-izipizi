import type { Listing } from "@/lib/mock-data";
import type { Filters } from "@/components/filter-sidebar";
import { getStorageType } from "@/lib/utils";

export type CatalogSeller = { id: string; name: string };
export const CATALOG_SORTS = ["newest", "alpha_asc", "alpha_desc", "price_asc", "price_desc"] as const;
export type CatalogSort = typeof CATALOG_SORTS[number];

/** Match URLSearchParams.get: repeated values use the first, including empty. */
export function catalogQuery(raw: unknown): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === "string" ? [...value.trim()].slice(0, 200).join("") : "";
}

export function catalogSort(value: string | null): CatalogSort {
  return CATALOG_SORTS.find(sort => sort === value) ?? "newest";
}

export function catalogFilters(params: Pick<URLSearchParams, "get">): Filters {
  const price = params.get("maxPrice");
  const parsedPrice = price !== null && price.trim() !== "" ? Number(price) : NaN;
  const storage = params.get("storage");
  const delivery = params.get("delivery");
  const day = params.get("day");
  return {
    category: params.get("category") || "Visi",
    seller: params.get("seller") || "",
    maxPrice: Number.isFinite(parsedPrice) && parsedPrice >= 0 ? parsedPrice : null,
    storageType: storage === "frozen" || storage === "chilled" ? storage : "all",
    delivery: delivery === "courier" || delivery === "express" || delivery === "locker" ? delivery : "all",
    day: day && ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].includes(day) ? day : "",
  };
}

export function catalogFilterParams(current: URLSearchParams, filters: Filters): URLSearchParams {
  const next = new URLSearchParams(current);
  const values = {
    seller: filters.seller, category: filters.category === "Visi" ? "" : filters.category,
    storage: filters.storageType === "all" ? "" : filters.storageType,
    delivery: filters.delivery === "all" ? "" : filters.delivery,
    day: filters.day, maxPrice: filters.maxPrice === null ? "" : String(filters.maxPrice),
  };
  for (const [key, value] of Object.entries(values)) {
    if (value) next.set(key, value); else next.delete(key);
  }
  return next;
}

/** Remove filters, not campaign attribution or an explicitly selected sort. */
export function clearedCatalogParams(current: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(current);
  for (const key of ["q", "seller", "category", "storage", "delivery", "day", "maxPrice"]) next.delete(key);
  return next;
}

export function catalogSellerOptions(listings: Listing[]): CatalogSeller[] {
  const sellers = new Map<string, CatalogSeller>();
  for (const listing of listings) {
    if (!listing.sellerId) continue;
    sellers.set(listing.sellerId, {
      id: listing.sellerId,
      name: listing.seller.farmName || listing.seller.name || "Ražotājs",
    });
  }
  return [...sellers.values()].sort((a, b) => a.name.localeCompare(b.name, "lv") || a.id.localeCompare(b.id));
}

export function catalogPriceCeiling(listings: Listing[]): number {
  return listings.reduce((max, listing) => Number.isFinite(listing.price) ? Math.max(max, Math.ceil(listing.price)) : max, 100);
}

export function activeCatalogFilterCount(filters: Filters, query: string): number {
  return [filters.category !== "Visi", !!filters.seller, filters.storageType !== "all",
    filters.delivery !== "all", !!filters.day, filters.maxPrice !== null, !!query.trim()].filter(Boolean).length;
}

export function filterAndSortCatalog(
  listings: Listing[], filters: Filters, sort: CatalogSort, storageTypes: Record<string, string> = {},
): Listing[] {
  const result = listings.filter(listing => {
    if (filters.category !== "Visi" && listing.category !== filters.category) return false;
    if (filters.seller && listing.sellerId !== filters.seller) return false;
    const storage = getStorageType({ ...listing, storageType: listing.storageType ?? storageTypes[listing.id] });
    if (filters.storageType !== "all" && storage !== filters.storageType) return false;
    if (filters.delivery === "courier" && !listing.courier_delivery) return false;
    if (filters.delivery === "express" && !listing.express_delivery) return false;
    // Courier/express flags describe additional services, not locker exclusion.
    if (filters.day && !listing.dispatch_days?.includes(filters.day)) return false;
    return filters.maxPrice === null || listing.price <= filters.maxPrice;
  });
  return result.sort((a, b) => {
    const tie = a.id.localeCompare(b.id);
    if (sort === "price_asc") return a.price - b.price || tie;
    if (sort === "price_desc") return b.price - a.price || tie;
    if (sort === "alpha_asc") return a.title.localeCompare(b.title, "lv") || tie;
    if (sort === "alpha_desc") return b.title.localeCompare(a.title, "lv") || tie;
    return (b.createdAt ?? "").localeCompare(a.createdAt ?? "") || tie;
  });
}
