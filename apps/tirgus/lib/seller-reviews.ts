import { supabase } from "./supabase";

export type SellerReviews = {
  rating: number;
  reviewCount: number;
  reviewsAvailable: boolean;
};

const unavailable: SellerReviews = { rating: 0, reviewCount: 0, reviewsAvailable: false };

export function isReviewStars(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;
}

/** Never publish averages from failed, malformed, or server-truncated reads. */
export async function fetchSellerReviews(ids: string[]): Promise<Map<string, SellerReviews>> {
  const sellerIds = [...new Set(ids.filter(Boolean))];
  const summaries = new Map(sellerIds.map(id => [id, unavailable]));
  if (!sellerIds.length) return summaries;
  try {
    const { data, error, count } = await supabase
      .from("reviews")
      .select("seller_id, stars", { count: "exact" })
      .in("seller_id", sellerIds);
    if (error || !data || count === null || count !== data.length) return summaries;
    const totals = new Map(sellerIds.map(id => [id, { total: 0, count: 0 }]));
    for (const row of data) {
      const total = totals.get(row.seller_id);
      if (!total || !isReviewStars(row.stars)) return summaries;
      total.total += row.stars;
      total.count++;
    }
    for (const [id, total] of totals) {
      summaries.set(id, {
        rating: total.count ? total.total / total.count : 0,
        reviewCount: total.count,
        reviewsAvailable: true,
      });
    }
  } catch {
    // Public discovery remains usable if the review service is unavailable.
  }
  return summaries;
}

export const unavailableSellerReviews = unavailable;
