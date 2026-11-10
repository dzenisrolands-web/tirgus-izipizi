import type { SupabaseClient } from "@supabase/supabase-js";

export type ReservedOrder = { order_id: string; order_number: string; reserved_until: string };
export type Settlement = {
  outcome: "paid" | "already_paid" | "review"; order_id: string; review_reason?: string | null;
};

/** Never fall back to direct inserts/stock writes: a missing migration is a closed gate. */
export async function createReservedOrder(sb: SupabaseClient, order: Record<string, unknown>) {
  const { data, error } = await sb.rpc("create_reserved_marketplace_order", { p_order: order });
  if (error || !data?.order_id || !data?.reserved_until) {
    throw new Error(error?.code === "22023" ? error.message : "Rezervācijas pakalpojums nav pieejams");
  }
  return data as ReservedOrder;
}

export async function settleReservedOrder(sb: SupabaseClient, orderNumber: string, amountCents: number) {
  const { data, error } = await sb.rpc("settle_reserved_marketplace_order", {
    p_order_number: orderNumber, p_amount_cents: amountCents,
  });
  if (error || !data?.order_id || !["paid", "already_paid", "review"].includes(data.outcome)) {
    throw new Error("Payment settlement unavailable");
  }
  return data as Settlement;
}

export function hasLiveReservation(order: { reservation_expires_at?: string | null }, now = Date.now()) {
  const expiry = Date.parse(order.reservation_expires_at ?? "");
  return Number.isFinite(expiry) && expiry > now;
}
