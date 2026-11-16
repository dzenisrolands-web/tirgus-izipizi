import "../public-phase3/react-runtime";
import { test, expect } from "@playwright/test";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import {
  fetchActiveListings, fetchBestSellers, fetchNewestListings, fetchWeeklyFeatured,
  fetchListingById, fetchListingBySlug, fetchDbSellerProfile, fetchApprovedSellers,
} from "../../lib/db-listings";
import SellerPage from "../../app/seller/[id]/page";
import ListingPage from "../../app/listing/[id]/page";
import { ListingCard } from "../../components/listing-card";
import { CartProvider } from "../../lib/cart-context";
import { StorageTypesProvider } from "../../lib/storage-types-context";
import { fetchSellerReviews } from "../../lib/seller-reviews";
import { hooks } from "../cart-phase4/hook-harness";
import { ReviewsSectionDb } from "../../components/reviews-section-db";
import { supabase } from "../../lib/supabase";
import { AuthSessionMissingError } from "@supabase/supabase-js";

// Deliberately collide with curated mock identities: those review counts must
// never leak into a real public record without a persisted review summary.
const seller = {
  id: "s7", name: "Fixture producer", farm_name: "Fixture farm",
  status: "approved", location: "Rīga", avatar_url: "/images/fixture-logo.jpg",
};
const listing = {
  id: "l1", slug: "fixture-product", seller_id: seller.id, title: "Fixture product",
  description: "Fixture description", category: "Saldēta pārtika", price: 4,
  unit: "gab.", quantity: 2, image_url: "/images/fixture.jpg", locker_id: "brivibas",
  created_at: "2026-01-01T00:00:00Z", storage_type: "frozen",
};
let original: typeof fetch;
let reviewResponse: () => Response;
function reviews(stars: number[], count = stars.length) {
  return Response.json(stars.map(star => ({ seller_id: seller.id, stars: star })), {
    headers: { "content-range": stars.length ? `0-${stars.length - 1}/${count}` : `*/${count}` },
  });
}
test.beforeEach(() => {
  original = globalThis.fetch;
  reviewResponse = () => reviews([]);
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    expect(url.origin).toBe("https://example.invalid");
    expect(init?.method ?? "GET").toBe("GET");
    const single = new Headers(init?.headers).get("accept")?.includes("vnd.pgrst.object");
    if (url.pathname === "/rest/v1/reviews") {
      expect(url.searchParams.get("select")).toBe("seller_id,stars");
      expect(url.searchParams.get("seller_id")).toBe("in.(s7)");
      expect(new Headers(init?.headers).get("prefer")).toContain("count=exact");
      return reviewResponse();
    }
    if (url.pathname === "/rest/v1/listings") return Response.json(single ? listing : [listing]);
    if (url.pathname === "/rest/v1/sellers_public") return Response.json(single ? seller : [seller]);
    if (url.pathname === "/rest/v1/weekly_featured") return Response.json([{ listing_id: listing.id, position: 1 }]);
    throw new Error(`Unexpected review-test request: ${url.pathname}`);
  };
});

test("all public fetch paths use persisted reviews rather than mock aggregates", async () => {
  reviewResponse = () => reviews([5, 4, 3]);
  const summary = { rating: 4, reviewCount: 3, reviewsAvailable: true };
  for (const record of await allListingPaths()) expect(record?.seller).toMatchObject(summary);
  for (const profile of [await fetchDbSellerProfile(seller.id), ...await fetchApprovedSellers()]) {
    expect(profile?.seller).toMatchObject(summary);
    expect(profile?.listings[0].seller).toMatchObject(summary);
  }
});

test("real seller reviews render stars and seller JSON-LD, never product aggregate ratings", async () => {
  reviewResponse = () => reviews([5, 4, 4]);
  const sellerPage = render(await SellerPage({ params: Promise.resolve({ id: seller.id }) }));
  expect(sellerPage("article").text()).toContain("4.3 (3 atsauksmes)");
  expect(sellerPage("article .lucide-star")).toHaveLength(1);
  expect(sellerPage("article").text()).not.toContain("Vēl nav atsauksmju");
  const establishment = sellerPage('script[type="application/ld+json"]').toArray()
    .map(script => JSON.parse(sellerPage(script).text())).find(block => block["@type"] === "FoodEstablishment");
  expect(establishment.aggregateRating).toMatchObject({ ratingValue: 13 / 3, reviewCount: 3 });
  const productPage = render(await ListingPage({ params: Promise.resolve({ id: listing.slug }) }));
  const sellerLink = productPage(`a[href="/seller/${seller.id}"]`);
  expect(sellerLink.text()).toContain("4.3");
  expect(sellerLink.text()).toContain("3 atsauksmes");
  expect(sellerLink.find(".lucide-star")).toHaveLength(1);
  for (const script of productPage('script[type="application/ld+json"]').toArray()) {
    expect(JSON.parse(productPage(script).text())).not.toHaveProperty("aggregateRating");
  }
});

for (const [name, response] of [
  ["error", () => Response.json({ message: "Unavailable" }, { status: 403 })],
  ["network", () => { throw new DOMException("Fixture offline", "AbortError"); }],
  ["invalid high", () => reviews([6])],
  ["invalid low", () => reviews([0])],
  ["invalid fractional", () => reviews([3.5])],
  ["invalid type", () => Response.json([{ seller_id: seller.id, stars: "5" }], { headers: { "content-range": "0-0/1" } })],
  ["truncated", () => reviews([5], 1001)],
  ["unconfirmed count", () => Response.json([])],
] as const) {
  test(`${name} review read is unavailable, not empty or an invented aggregate`, async () => {
    reviewResponse = response;
    expect((await fetchSellerReviews([seller.id])).get(seller.id)?.reviewsAvailable).toBe(false);
    const sellerPage = render(await SellerPage({ params: Promise.resolve({ id: seller.id }) }));
    const productPage = render(await ListingPage({ params: Promise.resolve({ id: listing.slug }) }));
    const sellerLink = productPage(`a[href="/seller/${seller.id}"]`);
    for (const text of [sellerPage("article").text(), sellerLink.text()]) {
      expect(text).toContain("Atsauksmes pašlaik nav pieejamas");
      expect(text).not.toContain("Vēl nav atsauksmju");
      expect(text).not.toContain("0 atsauksmes");
    }
    expect(sellerPage("article .lucide-star")).toHaveLength(0);
    expect(sellerLink.find(".lucide-star")).toHaveLength(0);
    for (const page of [sellerPage, productPage]) {
      for (const script of page('script[type="application/ld+json"]').toArray()) {
        expect(JSON.parse(page(script).text())).not.toHaveProperty("aggregateRating");
      }
    }
  });
}
test.afterEach(() => { globalThis.fetch = original; });

function render(node: React.ReactNode) {
  return load(renderToStaticMarkup(
    <CartProvider><StorageTypesProvider>{node}</StorageTypesProvider></CartProvider>,
  ));
}

async function allListingPaths() {
  return [
    ...await fetchActiveListings(), ...await fetchBestSellers(6, {}),
    ...await fetchNewestListings(), ...await fetchWeeklyFeatured(),
    await fetchListingById(listing.id), await fetchListingBySlug(listing.slug),
  ];
}

test("all listing fetch paths map a confirmed empty review read to unrated, never five stars", async () => {
  const records = [
    ...await fetchActiveListings(),
    ...await fetchBestSellers(6, {}),
    ...await fetchNewestListings(),
    ...await fetchWeeklyFeatured(),
    await fetchListingById(listing.id),
    await fetchListingBySlug(listing.slug),
  ];
  expect(records).toHaveLength(6);
  for (const record of records) {
    expect(record?.seller).toMatchObject({ id: seller.id, rating: 0, reviewCount: 0, reviewsAvailable: true });
  }
});

test("seller profile and directory mapping cannot reuse curated mock aggregates", async () => {
  const profiles = [await fetchDbSellerProfile(seller.id), ...await fetchApprovedSellers()];
  expect(profiles).toHaveLength(2);
  for (const profile of profiles) {
    expect(profile?.seller).toMatchObject({ id: seller.id, rating: 0, reviewCount: 0, reviewsAvailable: true });
    expect(profile?.listings[0].seller).toMatchObject({ rating: 0, reviewCount: 0, reviewsAvailable: true });
  }
});

test("product seller block shows no stars or numeric rating for zero reviews", async () => {
  const $ = render(await ListingPage({ params: Promise.resolve({ id: listing.slug }) }));
  const sellerLink = $(`a[href="/seller/${seller.id}"]`);
  expect(sellerLink.text()).toContain("Vēl nav atsauksmju");
  expect(sellerLink.find(".lucide-star")).toHaveLength(0);
  expect(sellerLink.text()).not.toMatch(/(?:^|\s)[05](?:\.0)?(?:\s|$)/);
  expect(sellerLink.text()).not.toContain("0 atsauksmes");
  for (const script of $('script[type="application/ld+json"]').toArray()) {
    expect(JSON.parse($(script).text())).not.toHaveProperty("aggregateRating");
  }
});

test("seller page shows confirmed empty state and omits aggregateRating JSON-LD", async () => {
  const $ = render(await SellerPage({ params: Promise.resolve({ id: seller.id }) }));
  expect($("article").text()).toContain("Vēl nav atsauksmju");
  expect($("article .lucide-star")).toHaveLength(0);
  const blocks = $('script[type="application/ld+json"]').toArray().map(script => JSON.parse($(script).text()));
  const establishment = blocks.find(block => block["@type"] === "FoodEstablishment");
  expect(establishment).toBeTruthy();
  expect(establishment).not.toHaveProperty("aggregateRating");
});

test("listing cards do not advertise star ratings or fabricated review counts", async () => {
  const record = await fetchListingById(listing.id);
  expect(record).not.toBeNull();
  const $ = render(<ListingCard listing={record!} />);
  expect($(".lucide-star")).toHaveLength(0);
  expect($("body").text()).not.toContain("atsauksmes");
  expect($("body").text()).not.toContain("5 (0)");
});

for (const state of ["empty", "real", "error", "invalid"] as const) {
  test(`client review section handles ${state} persisted data without invented ratings`, async () => {
    const originalGetUser = supabase.auth.getUser;
    supabase.auth.getUser = async () => ({ data: { user: null }, error: new AuthSessionMissingError() });
    globalThis.fetch = async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      expect(url.origin).toBe("https://example.invalid");
      expect(init?.method ?? "GET").toBe("GET");
      expect(url.pathname).toBe("/rest/v1/reviews");
      expect(url.searchParams.get("listing_id")).toBe(`eq.${listing.id}`);
      if (state === "error") return Response.json({ message: "Fixture denied" }, { status: 403 });
      return Response.json(state === "empty" ? [] : [{
        id: "review-1", listing_id: listing.id, buyer_name: "Fixture buyer",
        stars: state === "invalid" ? 6 : 4, comment: "Fixture review comment",
        verified_purchase: false, created_at: "2026-01-01T00:00:00Z",
      }]);
    };
    const runner = hooks(() => ReviewsSectionDb({ listingId: listing.id }));
    try {
      await runner.flush();
      const $ = render(runner.output);
      const text = $("body").text();
      if (state === "error" || state === "invalid") {
        expect(text).toContain("Atsauksmes pašlaik nav pieejamas");
        expect(text).not.toContain("Vēl nav atsauksmju");
        expect($(".lucide-star")).toHaveLength(0);
      } else if (state === "empty") {
        expect(text).toContain("Vēl nav atsauksmju");
        expect($(".lucide-star")).toHaveLength(0);
      } else {
        expect(text).toContain("4.0");
        expect(text).toContain("Atsauksmes (1)");
        expect(text).not.toContain("Vēl nav atsauksmju");
        expect($(".lucide-star").length).toBeGreaterThan(0);
      }
    } finally {
      runner.dispose();
      supabase.auth.getUser = originalGetUser;
    }
  });
}
