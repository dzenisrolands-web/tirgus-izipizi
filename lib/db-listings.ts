import { supabase } from "./supabase";
import { lockers } from "./mock-data";
import type { Listing } from "./mock-data";

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

  return rows.map((item) => {
    const locker = lockers.find((l) => l.id === item.locker_id) ?? lockers[0];
    const s = sellersMap[item.seller_id];
    const freshnessDate = new Date(
      new Date(item.created_at).getTime() + 60 * 24 * 60 * 60 * 1000
    ).toISOString().split("T")[0];

    return {
      id: item.id,
      title: item.title,
      description: item.description ?? "",
      price: item.price,
      unit: item.unit,
      category: item.category,
      image: item.image_url ?? "",
      lockerId: item.locker_id ?? locker.id,
      locker,
      sellerId: s?.id ?? item.seller_id ?? "",
      seller: {
        id: s?.id ?? "",
        name: s?.name ?? "",
        farmName: s?.farm_name ?? s?.name ?? "",
        avatar: s?.avatar_url ?? "",
        verified: s?.status === "approved",
        rating: 5.0,
        reviewCount: 0,
        location: s?.location ?? "",
      },
      quantity: item.quantity ?? 1,
      freshnessDate,
      createdAt: item.created_at,
    } as Listing;
  });
}
