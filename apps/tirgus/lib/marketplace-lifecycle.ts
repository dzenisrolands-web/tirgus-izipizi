import type { SupabaseClient } from "@supabase/supabase-js";
import { CheckoutError } from "./checkout-items";

export const MARKETPLACE_LIFECYCLE_VERSION = "marketplace-v1";
/** Default-off rollout boundary. Never expose as a NEXT_PUBLIC setting. */
export function marketplaceLifecycleEnabled(): boolean {
  return process.env.MARKETPLACE_LIFECYCLE_V1 === "enabled";
}

export async function reserveMarketplaceOrder(sb: SupabaseClient, order: Record<string, unknown>) {
  const { data, error } = await sb.rpc("marketplace_reserve_v1", { p_order: order });
  if (error || !data || typeof data.order_id !== "string" || data.order_number !== order.order_number
      || !Number.isFinite(Date.parse(data.reserved_until))) {
    // No direct-insert fallback, DB error text, private records or provider calls.
    throw new CheckoutError(error?.code === "22023" ? 409 : 503,
      "RESERVATION_UNAVAILABLE", "Preču rezervācija neizdevās. Atjauno grozu un mēģini vēlreiz.");
  }
  return data as { order_id: string; order_number: string; reserved_until: string };
}
