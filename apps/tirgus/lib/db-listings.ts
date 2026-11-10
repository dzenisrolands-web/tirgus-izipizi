import { supabase } from "./supabase";
import { lockers } from "./mock-data";
import type { Listing, Seller, Variant } from "./mock-data";
import type { SellerMeta } from "./sellers-meta";
import { isPublicReady, normalizeUrl } from "./utils";
import { publicProductImage } from "./product-image";

const LISTING_COLS = "id, title, description, price, unit, category, image_url, locker_id, seller_id, quantity, created_at, variants, storage_type, express_delivery, courier_delivery, dispatch_days, slug";

function isPublicListing(listing: Listing): boolean {
  return Number.isFinite(listing.price) && isPublicReady(listing);
}

export function normalizeCatalogSearch(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

/** RPC hits can rank canonical active rows, never introduce synthetic products. */
export function searchPublicListings(
  listings: Listing[],
  query: string,
  rpcRows: Array<{ id?: unknown; relevance?: unknown }> = [],
): Listing[] {
  const q = normalizeCatalogSearch(query);
  const publicListings = listings.filter(isPublicListing);
  if (!q) return publicListings;
  const words = q.split(/\s+/).filter(Boolean);
  const scores = new Map(rpcRows.filter(row => typeof row.id === "string")
    .map(row => [row.id, typeof row.relevance === "number" && Number.isFinite(row.relevance) ? row.relevance : 0]));
  return publicListings.flatMap(listing => {
    const title = normalizeCatalogSearch(listing.title);
    const fields = normalizeCatalogSearch(`${listing.title} ${listing.category} ${listing.seller.farmName} ${listing.seller.name}`);
    if (!scores.has(listing.id) && !words.every(word => fields.includes(word))) return [];
    const score = scores.get(listing.id) ?? (title.startsWith(q) ? 2 : title.includes(q) ? 1 : 0);
    return [{ listing, score }];
  }).sort((a, b) => b.score - a.score || a.listing.id.localeCompare(b.listing.id))
    .map(({ listing }) => listing);
}

function extractYoutubeId(url?: string | null): string | undefined {
  if (!url) return undefined;
  const m = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m?.[1];
}

function mapVariants(raw: unknown): Variant[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: Variant[] = [];
  for (const v of raw) {
    if (!v || typeof v !== "object") continue;
    const o = v as Record<string, unknown>;
    const title = typeof o.title === "string" ? o.title : "";
    const price = typeof o.price === "number" ? o.price : NaN;
    if (!title || !isFinite(price) || price <= 0) continue;
    out.push({
      id: typeof o.id === "string" ? o.id : `v${out.length + 1}`,
      title,
      price,
      quantity: typeof o.quantity === "number" ? o.quantity : 99,
    });
  }
  return out.length > 0 ? out : undefined;
}

function mapRow(item: Record<string, unknown>, s: Record<string, unknown> | null): Listing & { slug?: string } {
  const locker = lockers.find((l) => l.id === item.locker_id) ?? lockers[0];
  return {
    id: item.id as string,
    title: item.title as string,
    description: (item.description as string) ?? "",
    price: item.price as number,
    unit: item.unit as string,
    category: item.category as string,
    image: publicProductImage(item.image_url),
    lockerId: (item.locker_id as string) ?? locker.id,
    locker,
    sellerId: (s?.id as string) ?? (item.seller_id as string) ?? "",
    seller: {
      id: (s?.id as string) ?? "",
      name: (s?.name as string) ?? "",
      farmName: (s?.farm_name as string) ?? (s?.name as string) ?? "",
      avatar: (s?.logo_url as string) || (s?.avatar_url as string) || "",
      verified: s?.status === "approved",
      rating: 5.0,
      reviewCount: 0,
      location: (s?.location as string) ?? "",
    } as Seller,
    quantity: (item.quantity as number) ?? 1,
    // Required legacy presentation type; no verified shelf-life column is queried.
    freshnessDate: "",
    createdAt: item.created_at as string,
    variants: mapVariants(item.variants),
    storageType: item.storage_type === "frozen" ? "frozen"
      : item.storage_type === "chilled" || item.storage_type === "ambient" ? "chilled" : undefined,
    express_delivery: (item.express_delivery as boolean) ?? false,
    courier_delivery: (item.courier_delivery as boolean) ?? true,
    dispatch_days: Array.isArray(item.dispatch_days) ? (item.dispatch_days as string[]) : [],
    slug: (item.slug as string | undefined) ?? undefined,
  };
}

export async function fetchActiveListings(): Promise<Listing[]> {
  const { data: rows, error } = await supabase
    .from("listings")
    .select(LISTING_COLS)
    .eq("status", "active")
    .gt("price", 0)
    .order("created_at", { ascending: false });

  if (error || !rows || rows.length === 0) return [];

  const sellerIds = [...new Set(rows.map((r) => r.seller_id).filter(Boolean))];
  const { data: sellersData } = await supabase
    .from("sellers_public")
    .select("id, name, farm_name, avatar_url, logo_url, status, location")
    .in("id", sellerIds);

  const sellersMap = Object.fromEntries((sellersData ?? []).map((s) => [s.id, s]));

  return rows
    .map((item) => mapRow(item, sellersMap[item.seller_id] ?? null))
    .filter(isPublicListing);
}

/** Sales volume per listing id, aggregated from paid orders. */
export type SalesCounts = Record<string, number>;

/**
 * Fetch the sales aggregate from the API route.
 *
 * `orders` is not readable from the browser (RLS, migration 0030) — an
 * anonymous visitor sees nothing and a logged-in buyer sees only their own
 * orders. Both would produce a misleading ranking, so the aggregate is
 * computed server-side with the service-role key and exposed without any
 * buyer data attached.
 */
async function fetchSalesCounts(): Promise<SalesCounts> {
  try {
    const res = await fetch("/api/best-sellers");
    if (!res.ok) return {};
    return (await res.json()) as SalesCounts;
  } catch {
    return {};
  }
}

/**
 * Best sellers — listings with most paid orders in last 7 days.
 * Falls back to active listings sorted by rating if no orders.
 *
 * Server components should pass `counts` from `fetchSalesCountsServer()` to
 * avoid an extra round trip; in the browser the aggregate is fetched from
 * `/api/best-sellers`.
 */
export async function fetchBestSellers(
  limit = 6,
  counts?: SalesCounts,
): Promise<Listing[]> {
  const sales = counts ?? (typeof window === "undefined" ? {} : await fetchSalesCounts());

  const all = await fetchActiveListings();
  // Sort by sales count desc, then by rating
  const sorted = [...all].sort((a, b) => {
    const aCount = sales[a.id] ?? 0;
    const bCount = sales[b.id] ?? 0;
    if (aCount !== bCount) return bCount - aCount;
    return (b.seller.rating ?? 0) - (a.seller.rating ?? 0);
  });
  return sorted.slice(0, limit);
}

/**
 * Newest listings — most recently added active products.
 */
export async function fetchNewestListings(limit = 6): Promise<Listing[]> {
  const all = await fetchActiveListings();
  // fetchActiveListings already orders by created_at desc
  return all.slice(0, limit);
}

/**
 * Weekly featured — listings selected for current week's spotlight.
 */
export async function fetchWeeklyFeatured(limit = 7): Promise<Listing[]> {
  const today = new Date().toISOString().split("T")[0];
  const { data: featured } = await supabase
    .from("weekly_featured")
    .select("listing_id, position")
    .eq("status", "active")
    .lte("starts_at", today)
    .gte("ends_at", today)
    .order("position", { ascending: true })
    .limit(limit);

  if (!featured || featured.length === 0) return [];

  const listingIds = featured.map((f) => f.listing_id);
  const { data: rows } = await supabase
    .from("listings")
    .select(LISTING_COLS)
    .in("id", listingIds)
    .eq("status", "active")
    .gt("price", 0);

  if (!rows) return [];

  const sellerIds = [...new Set(rows.map((r) => r.seller_id).filter(Boolean))];
  const { data: sellersData } = await supabase
    .from("sellers_public")
    .select("id, name, farm_name, avatar_url, logo_url, status, location")
    .in("id", sellerIds);
  const sellersMap = Object.fromEntries((sellersData ?? []).map((s) => [s.id, s]));

  // Order by featured position
  const positionMap = new Map(featured.map((f) => [f.listing_id, f.position]));
  const mapped = rows.map((item) => mapRow(item, sellersMap[item.seller_id] ?? null)).filter(isPublicListing);
  return mapped.sort((a, b) =>
    (positionMap.get(a.id) ?? 99) - (positionMap.get(b.id) ?? 99)
  );
}

export async function fetchListingById(id: string): Promise<Listing | null> {
  const { data: item, error } = await supabase
    .from("listings")
    .select(LISTING_COLS)
    .eq("id", id)
    .eq("status", "active")
    .gt("price", 0)
    .single();
  if (error || !item) return null;
  const { data: s } = await supabase
    .from("sellers_public").select("id, name, farm_name, avatar_url, logo_url, status, location").eq("id", item.seller_id).single();
  const listing = mapRow(item, s);
  return isPublicListing(listing) ? listing : null;
}

export async function fetchListingBySlug(slug: string): Promise<Listing | null> {
  const { data: item, error } = await supabase
    .from("listings")
    .select(LISTING_COLS)
    .eq("slug", slug)
    .eq("status", "active")
    .gt("price", 0)
    .single();
  if (error || !item) return null;
  const { data: s } = await supabase
    .from("sellers_public").select("id, name, farm_name, avatar_url, logo_url, status, location").eq("id", item.seller_id).single();
  const listing = mapRow(item, s);
  return isPublicListing(listing) ? listing : null;
}

export type DbSellerProfile = {
  seller: Seller;
  meta: SellerMeta;
  listings: Listing[];
};

const SELLER_COLS = "id, name, farm_name, avatar_url, logo_url, cover_url, status, location, description, short_desc, website, facebook, instagram, tiktok, youtube_channel, youtube_video_url, quote_text, quote_author, facts, milestones, events";

function mapSellerMeta(s: Record<string, unknown>): SellerMeta {
  return {
    cover: (s.cover_url as string) || "",
    description: (s.description as string) ?? "",
    shortDesc: (s.short_desc as string) ?? "",
    quote: s.quote_text ? { text: s.quote_text as string, author: (s.quote_author as string) ?? "" } : undefined,
    website: normalizeUrl(s.website as string) || undefined,
    facebook: normalizeUrl(s.facebook as string) || undefined,
    instagram: normalizeUrl(s.instagram as string) || undefined,
    tiktok: normalizeUrl(s.tiktok as string) || undefined,
    youtubeChannel: normalizeUrl(s.youtube_channel as string) || undefined,
    youtubeVideoId: extractYoutubeId(s.youtube_video_url as string | null),
    facts: Array.isArray(s.facts) ? s.facts : [],
    milestones: Array.isArray(s.milestones) ? s.milestones : [],
    events: Array.isArray(s.events) ? s.events : [],
    keywords: [],
  };
}

function mapSellerRecord(s: Record<string, unknown>): Seller {
  return {
    id: s.id as string,
    name: (s.name as string) ?? "",
    farmName: (s.farm_name as string) ?? (s.name as string) ?? "",
    avatar: (s.logo_url as string) || (s.avatar_url as string) || "",
    verified: s.status === "approved",
    rating: 5.0,
    reviewCount: 0,
    location: (s.location as string) ?? "",
  };
}

export async function fetchDbSellerProfile(id: string): Promise<DbSellerProfile | null> {
  const { data: s, error } = await supabase
    .from("sellers_public")
    .select(SELLER_COLS)
    .eq("id", id)
    .single();
  if (error || !s) return null;

  const { data: listingsRows } = await supabase
    .from("listings")
    .select(LISTING_COLS)
    .eq("seller_id", id).eq("status", "active").gt("price", 0);

  return {
    seller: mapSellerRecord(s),
    meta: mapSellerMeta(s),
    listings: (listingsRows ?? []).map((item) => mapRow(item, s)).filter(isPublicListing),
  };
}

export async function fetchApprovedSellers(): Promise<DbSellerProfile[]> {
  const { data: rows } = await supabase
    .from("sellers_public")
    .select(SELLER_COLS)
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  if (!rows || rows.length === 0) return [];

  const sellerIds = rows.map((s) => s.id);
  const { data: listingsRows } = await supabase
    .from("listings")
    .select(LISTING_COLS)
    .eq("status", "active")
    .gt("price", 0)
    .in("seller_id", sellerIds);

  const byId: Record<string, Listing[]> = {};
  (listingsRows ?? []).forEach((item) => {
    const sellerRow = rows.find((r) => r.id === item.seller_id) ?? null;
    const mapped = mapRow(item, sellerRow);
    if (!isPublicListing(mapped)) return;
    if (!byId[item.seller_id]) byId[item.seller_id] = [];
    byId[item.seller_id].push(mapped);
  });

  return rows.map((s) => ({
    seller: mapSellerRecord(s),
    meta: mapSellerMeta(s),
    listings: byId[s.id] ?? [],
  }));
}
