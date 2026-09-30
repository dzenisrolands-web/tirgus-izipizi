import { NextResponse } from "next/server";
import { fetchSalesCountsServer } from "@/lib/best-sellers-server";

/**
 * Public aggregate of paid sales per listing (last 7 days).
 *
 * Returns only `{ [listingId]: quantity }` — no buyer data. This replaces the
 * browser reading `orders` directly, which RLS (migration 0030) now blocks.
 */
export const revalidate = 60;

export async function GET() {
  const counts = await fetchSalesCountsServer();
  return NextResponse.json(counts, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
