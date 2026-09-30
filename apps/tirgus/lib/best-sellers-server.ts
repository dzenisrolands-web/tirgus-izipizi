import { createServerClient } from "./supabase";
import type { SalesCounts } from "./db-listings";

/**
 * Aggregate paid-order sales counts per listing for the last 7 days.
 *
 * SERVER ONLY — uses the service-role key. Do not import from a client
 * component; use the `/api/best-sellers` route instead.
 *
 * Why this exists: before migration 0030 the browser could read the whole
 * `orders` table with the publishable key, so `fetchBestSellers()` aggregated
 * it client-side. That was the same hole that exposed buyer PII. Once RLS
 * restricts `orders` to the buyer and the seller, that query returns either
 * nothing (anonymous) or only the current buyer's own orders — which would
 * have silently turned "best sellers" into "what you bought last week".
 *
 * Only the aggregate (listing id → quantity) ever leaves the server. No buyer
 * data is exposed.
 */
export async function fetchSalesCountsServer(): Promise<SalesCounts> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const supabase = createServerClient();
  const { data: orders, error } = await supabase
    .from("orders")
    .select("items")
    .eq("payment_status", "paid")
    .gte("paid_at", sevenDaysAgo);

  if (error || !orders) return {};

  const counts: SalesCounts = {};
  for (const o of orders) {
    const items = o.items as Array<{ id?: string; quantity?: number }> | null;
    for (const it of items ?? []) {
      if (!it.id) continue;
      counts[it.id] = (counts[it.id] ?? 0) + (it.quantity ?? 1);
    }
  }
  return counts;
}
