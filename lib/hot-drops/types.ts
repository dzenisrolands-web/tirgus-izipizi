import type { Locker } from "@/lib/mock-data";

export type TemperatureZone = "ambient" | "chilled" | "frozen";
export type DropStatus = "active" | "expired" | "sold_out" | "cancelled";
export type ReservationStatus = "pending" | "paid" | "expired" | "cancelled";

export type HotDrop = {
  id: string;
  seller_id: string;
  user_id: string;
  title: string;
  description: string | null;
  category: string;
  unit: string;
  price_cents: number;
  total_quantity: number;
  reserved_quantity: number;
  sold_quantity: number;
  pickup_locker_id: string;
  temperature_zone: TemperatureZone;
  expires_at: string;
  cover_image_url: string | null;
  status: DropStatus;
  published_at: string;
  created_at: string;
  updated_at: string;
};

export type DropSeller = {
  id: string;
  name: string;
  farm_name: string | null;
  avatar_url: string | null;
};

export type HotDropWithSeller = HotDrop & {
  seller: DropSeller;
  pickup_locker: Locker | null;
};

export type HotDropReservation = {
  id: string;
  drop_id: string;
  buyer_id: string;
  quantity: number;
  delivery_locker_id: string;
  payment_session_id: string | null;
  status: ReservationStatus;
  expires_at: string;
  created_at: string;
  paid_at: string | null;
};

export type DropFormData = {
  title: string;
  description: string;
  category: string;
  unit: string;
  price_cents: number;
  total_quantity: number;
  pickup_locker_id: string;
  temperature_zone: TemperatureZone;
  expires_at: string;
  cover_image_url: string;
};

export type DropBadge = {
  key: "new" | "hot" | "ending" | "almost_gone";
  label: string;
  emoji: string;
};

export function availableQuantity(drop: HotDrop): number {
  return Math.max(0, drop.total_quantity - drop.reserved_quantity - drop.sold_quantity);
}
