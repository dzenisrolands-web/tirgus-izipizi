import { supabase } from "./supabase";
import { lockers } from "./mock-data";
import type { Listing, Seller } from "./mock-data";
import type { SellerMeta } from "./sellers-meta";

function extractYoutubeId(url?: string | null): string | undefined {
  if (!url) return undefined;
  const m = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m?.[1];
}

function mapRow(item: Record<string, unknown>, s: Record<string, unknown> | null): Listing {
  const locker = lockers.find((l) => l.id === item.locker_id) ?? lockers[0];
  const freshnessDate = new Date(
    new Date(item.created_at as string).getTime() + 60 * 24 * 60 * 60 * 1000
  ).toISOString().split("T")[0];
  return {
    id: item.id as string,
    title: item.title as string,
    description: (item.description as string) ?? "",
    price: item.price as number,
    unit: item.unit as string,
    category: item.category as string,
    image: (item.image_url as string) ?? "",
    lockerId: (item.locker_id as string) ?? locker.id,
    locker,
    sellerId: (s?.id as string) ?? (item.seller_id as string) ?? "",
    seller: {
      id: (s?.id as string) ?? "",
      name: (s?.name as string) ?? "",
      farmName: (s?.farm_name as string) ?? (s?.name as string) ?? "",
      avatar: (s?.avatar_url as string) ?? "",
      verified: s?.status === "approved",
      rating: 5.0,
      reviewCount: 0,
      location: (s?.location as string) ?? "",
    } as Seller,
    quantity: (item.quantity as number) ?? 1,
    freshnessDate,
    createdAt: item.created_at as string,
  };
}

export async function fetchActiveListings(): Promise<Listing[]> {
  const { data: rows, error } = await supabase
    .from("listings")
    .select("id, title, description, price, unit, category, image_url, locker_id, seller_id, quantity, created_at")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error || !rows || rows.length === 0) return [];

  const sellerIds = [...new Set(rows.map((r) => r.seller_id).filter(Boolean))];
  const { data: sellersData } = await supabase
    .from("sellers")
    .select("id, name, farm_name, avatar_url, status, location")
    .in("id", sellerIds);

  const sellersMap = Object.fromEntries((sellersData ?? []).map((s) => [s.id, s]));

  return rows.map((item) => mapRow(item, sellersMap[item.seller_id] ?? null));
}

export async function fetchListingById(id: string): Promise<Listing | null> {
  const { data: item, error } = await supabase
    .from("listings")
    .select("id, title, description, price, unit, category, image_url, locker_id, seller_id, quantity, created_at")
    .eq("id", id)
    .single();
  if (error || !item) return null;
  const { data: s } = await supabase
    .from("sellers").select("id, name, farm_name, avatar_url, status, location").eq("id", item.seller_id).single();
  return mapRow(item, s);
}

export type DbSellerProfile = {
  seller: Seller;
  meta: SellerMeta;
  listings: Listing[];
};

const SELLER_COLS = "id, name, farm_name, avatar_url, cover_url, status, location, description, short_desc, website, facebook, instagram, youtube_channel, youtube_video_url, quote_text, quote_author, facts, milestones, events";

function mapSellerMeta(s: Record<string, unknown>): SellerMeta {
  return {
    cover: (s.cover_url as string) ?? "",
    description: (s.description as string) ?? "",
    shortDesc: (s.short_desc as string) ?? "",
    quote: s.quote_text ? { text: s.quote_text as string, author: (s.quote_author as string) ?? "" } : undefined,
    website: (s.website as string) ?? undefined,
    facebook: (s.facebook as string) ?? undefined,
    instagram: (s.instagram as string) ?? undefined,
    youtubeChannel: (s.youtube_channel as string) ?? undefined,
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
    avatar: (s.avatar_url as string) ?? "",
    verified: s.status === "approved",
    rating: 5.0,
    reviewCount: 0,
    location: (s.location as string) ?? "",
  };
}

export async function fetchDbSellerProfile(id: string): Promise<DbSellerProfile | null> {
  const { data: s, error } = await supabase
    .from("sellers")
    .select(SELLER_COLS)
    .eq("id", id)
    .single();
  if (error || !s) return null;

  const { data: listingsRows } = await supabase
    .from("listings")
    .select("id, title, description, price, unit, category, image_url, locker_id, seller_id, quantity, created_at")
    .eq("seller_id", id).eq("status", "active");

  return {
    seller: mapSellerRecord(s),
    meta: mapSellerMeta(s),
    listings: (listingsRows ?? []).map((item) => mapRow(item, s)),
  };
}

export async function fetchApprovedSellers(): Promise<DbSellerProfile[]> {
  const { data: rows } = await supabase
    .from("sellers")
    .select(SELLER_COLS)
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  if (!rows || rows.length === 0) return [];

  const sellerIds = rows.map((s) => s.id);
  const { data: listingsRows } = await supabase
    .from("listings")
    .select("id, title, description, price, unit, category, image_url, locker_id, seller_id, quantity, created_at")
    .eq("status", "active")
    .in("seller_id", sellerIds);

  const byId: Record<string, Listing[]> = {};
  (listingsRows ?? []).forEach((item) => {
    const sellerRow = rows.find((r) => r.id === item.seller_id) ?? null;
    if (!byId[item.seller_id]) byId[item.seller_id] = [];
    byId[item.seller_id].push(mapRow(item, sellerRow));
  });

  return rows.map((s) => ({
    seller: mapSellerRecord(s),
    meta: mapSellerMeta(s),
    listings: byId[s.id] ?? [],
  }));
}
