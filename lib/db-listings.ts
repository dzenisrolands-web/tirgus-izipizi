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

export async function fetchDbSellerProfile(id: string): Promise<DbSellerProfile | null> {
  const { data: s, error } = await supabase
    .from("sellers")
    .select("id, name, farm_name, avatar_url, cover_url, status, location, description, short_desc, website, facebook, instagram, youtube_channel, youtube_video_url")
    .eq("id", id)
    .single();
  if (error || !s) return null;

  const seller: Seller = {
    id: s.id,
    name: s.name ?? "",
    farmName: s.farm_name ?? s.name ?? "",
    avatar: s.avatar_url ?? "",
    verified: s.status === "approved",
    rating: 5.0,
    reviewCount: 0,
    location: s.location ?? "",
  };

  const meta: SellerMeta = {
    cover: s.cover_url ?? "",
    description: s.description ?? "",
    shortDesc: s.short_desc ?? "",
    website: s.website ?? undefined,
    facebook: s.facebook ?? undefined,
    instagram: s.instagram ?? undefined,
    youtubeChannel: s.youtube_channel ?? undefined,
    youtubeVideoId: extractYoutubeId(s.youtube_video_url),
    facts: [],
    milestones: [],
    events: [],
    keywords: [],
  };

  const { data: listingsRows } = await supabase
    .from("listings")
    .select("id, title, description, price, unit, category, image_url, locker_id, seller_id, quantity, created_at")
    .eq("seller_id", id).eq("status", "active");

  const listings = (listingsRows ?? []).map((item) => mapRow(item, s));
  return { seller, meta, listings };
}
