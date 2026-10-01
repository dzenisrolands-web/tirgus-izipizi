import { supabase } from "@/lib/supabase";
import { lockers } from "@/lib/mock-data";
import type {
  HotDrop, HotDropWithSeller, HotDropReservation, DropFormData,
} from "./types";

const DROP_COLS = `
  id, seller_id, user_id, title, description, category, unit, price_cents,
  total_quantity, reserved_quantity, sold_quantity, pickup_locker_id,
  temperature_zone, expires_at, cover_image_url, audio_url, location_text,
  posted_at, status, published_at, created_at, updated_at
`;

function attachLocker(drop: HotDrop): HotDropWithSeller {
  return {
    ...drop,
    seller: { id: "", name: "", farm_name: null, avatar_url: null },
    pickup_locker: lockers.find((l) => l.id === drop.pickup_locker_id) ?? null,
  };
}

async function enrichWithSellers(drops: HotDrop[]): Promise<HotDropWithSeller[]> {
  if (drops.length === 0) return [];
  const sellerIds = [...new Set(drops.map((d) => d.seller_id))];
  const { data: sellers } = await supabase
    .from("sellers")
    .select("id, name, farm_name, avatar_url")
    .in("id", sellerIds);
  const map = Object.fromEntries((sellers ?? []).map((s) => [s.id, s]));
  return drops.map((d) => ({
    ...attachLocker(d),
    seller: map[d.seller_id] ?? { id: d.seller_id, name: "Ražotājs", farm_name: null, avatar_url: null },
  }));
}

// ── PUBLIC ────────────────────────────────────────────────────────────────────

export async function fetchActiveDrops(): Promise<HotDropWithSeller[]> {
  const { data, error } = await supabase
    .from("hot_drops")
    .select(DROP_COLS)
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString())
    .order("published_at", { ascending: false });
  if (error || !data) return [];
  return enrichWithSellers(data as HotDrop[]);
}

export async function fetchDropById(id: string): Promise<HotDropWithSeller | null> {
  const { data, error } = await supabase
    .from("hot_drops")
    .select(DROP_COLS)
    .eq("id", id)
    .single();
  if (error || !data) return null;
  const [enriched] = await enrichWithSellers([data as HotDrop]);
  return enriched ?? null;
}

// ── SELLER DASHBOARD ─────────────────────────────────────────────────────────

export async function fetchSellerDrops(sellerId: string): Promise<HotDrop[]> {
  const { data, error } = await supabase
    .from("hot_drops")
    .select(DROP_COLS)
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data as HotDrop[];
}

export async function createDrop(
  sellerId: string,
  userId: string,
  form: DropFormData,
): Promise<HotDrop | null> {
  const { data, error } = await supabase
    .from("hot_drops")
    .insert({ ...form, seller_id: sellerId, user_id: userId })
    .select(DROP_COLS)
    .single();
  if (error || !data) { console.error(error); return null; }
  return data as HotDrop;
}

export async function updateDrop(
  id: string,
  fields: Partial<DropFormData>,
): Promise<boolean> {
  const { error } = await supabase
    .from("hot_drops")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id);
  return !error;
}

export async function cancelDrop(id: string): Promise<boolean> {
  const { error } = await supabase
    .from("hot_drops")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", id);
  return !error;
}

// ── RESERVATION ──────────────────────────────────────────────────────────────

export async function reserveDrop(
  dropId: string,
  buyerId: string,
  quantity: number,
  deliveryLockerId: string,
): Promise<HotDropReservation | null> {
  const { data, error } = await supabase.rpc("reserve_hot_drop", {
    p_drop_id: dropId,
    p_buyer_id: buyerId,
    p_quantity: quantity,
    p_delivery_locker_id: deliveryLockerId,
  });
  if (error) { console.error(error); return null; }
  return data as HotDropReservation;
}

export async function confirmReservation(
  reservationId: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("hot_drop_reservations")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", reservationId);
  if (error) return false;
  // Increase sold_quantity, decrease reserved_quantity
  const { data: res } = await supabase
    .from("hot_drop_reservations")
    .select("drop_id, quantity")
    .eq("id", reservationId)
    .single();
  if (res) {
    await supabase.rpc("confirm_hot_drop_sale", {
      p_drop_id: res.drop_id,
      p_quantity: res.quantity,
    });
  }
  return true;
}

// ── FOLLOW ────────────────────────────────────────────────────────────────────

export async function toggleFollow(
  userId: string,
  sellerId: string,
): Promise<"followed" | "unfollowed"> {
  const { data: existing } = await supabase
    .from("seller_followers")
    .select("user_id")
    .eq("user_id", userId)
    .eq("seller_id", sellerId)
    .single();
  if (existing) {
    await supabase.from("seller_followers").delete()
      .eq("user_id", userId).eq("seller_id", sellerId);
    return "unfollowed";
  }
  await supabase.from("seller_followers").insert({ user_id: userId, seller_id: sellerId });
  return "followed";
}

export async function isFollowing(userId: string, sellerId: string): Promise<boolean> {
  const { data } = await supabase
    .from("seller_followers")
    .select("user_id")
    .eq("user_id", userId)
    .eq("seller_id", sellerId)
    .single();
  return !!data;
}
