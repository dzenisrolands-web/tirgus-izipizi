import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  mapRow, searchPublicListings, fetchActiveListings,
  fetchListingById, fetchListingBySlug, fetchWeeklyFeatured,
} from "../../lib/db-listings";
import { PRODUCT_IMAGE_PLACEHOLDER } from "../../lib/product-image";
import CatalogPage from "../../app/catalog/page";
import ListingPage from "../../app/listing/[id]/page";
import sitemap from "../../app/sitemap";
import type { ReactElement, ReactNode } from "react";
import { addCardQuantity } from "../../components/listing-card";
import type { CartItem } from "../../lib/cart-context";

const app = resolve(__dirname, "../..");
const source = (path: string) => readFileSync(resolve(app, path), "utf8");
const row = {
  id: "ab000000-0000-0000-0000-000000000001", seller_id: "seller",
  title: "Ābolu sula", price: 3, image_url: null,
  created_at: "2025-01-01T00:00:00Z", slug: "abolu-sula",
  category: "Dzērieni", unit: "l", quantity: 8,
  variants: [{ id: "v1", title: "1 l", price: 3, quantity: 8 }],
  storage_type: "frozen", express_delivery: true, courier_delivery: false, dispatch_days: ["monday"],
};
const seller = { id: "seller", name: "Dārzs", farm_name: "Dārzs", status: "approved" };

function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const element = node as ReactElement<Record<string, unknown>>;
  return [element, ...elements(element.props.children as ReactNode)];
}

async function withBackend(
  run: (calls: URL[]) => Promise<void>,
  options: { rpc?: unknown[]; rpcFailure?: boolean; empty?: boolean } = {},
) {
  const calls: URL[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    calls.push(url);
    // Every backend request must remain on the dummy regression origin.
    expect(url.origin).toBe("https://example.invalid");
    if (url.pathname.endsWith("/rpc/search_products")) {
      return options.rpcFailure
        ? Response.json({ message: "unavailable" }, { status: 500 })
        : Response.json(options.rpc ?? []);
    }
    if (url.pathname.endsWith("/listings")) {
      const single = url.searchParams.has("slug") || url.searchParams.has("id") && !url.searchParams.get("id")?.startsWith("in.");
      return Response.json(single ? row : options.empty ? [] : [row]);
    }
    if (url.pathname.endsWith("/sellers_public")) {
      return Response.json(url.searchParams.has("id") && !url.searchParams.get("id")?.startsWith("in.") ? seller : [seller]);
    }
    if (url.pathname.endsWith("/weekly_featured")) {
      return Response.json(options.empty ? [] : [{ listing_id: row.id, position: 1 }]);
    }
    throw new Error(`Unexpected request: ${url.pathname}`);
  };
  try { await run(calls); } finally { globalThis.fetch = original; }
}

test("merge finds missing-photo products, keeps relevance and complete hydrated metadata", () => {
  const missingPhoto = mapRow(row, seller);
  const photo = mapRow({ ...row, id: "with-photo", title: "Ābolu dzēriens", image_url: "/images/apple.jpg" }, seller);
  const zero = mapRow({ ...row, id: "zero", price: 0 }, seller);
  const result = searchPublicListings([missingPhoto, photo, zero], "abolu", [
    { id: photo.id, relevance: 9 }, { id: "private-not-in-public-catalog", relevance: 99 },
    { id: zero.id, relevance: 99 },
  ]);
  expect(result.map(l => l.id)).toEqual([photo.id, missingPhoto.id]);
  expect(result[1]).toBe(missingPhoto);
  expect(result[1]).toMatchObject({
    image: PRODUCT_IMAGE_PLACEHOLDER, variants: row.variants, quantity: 8, storageType: "frozen",
    courier_delivery: false, express_delivery: true, dispatch_days: ["monday"],
    createdAt: row.created_at,
  });
});

test("card adds the selected quantity and clamps additions to available stock", () => {
  const item: Omit<CartItem, "quantity"> = {
    id: "product-v1", title: "Āboli — 1kg", price: 3, unit: "gab.",
    image: PRODUCT_IMAGE_PLACEHOLDER, sellerName: "Dārzs", storageType: "chilled" as const,
  };
  const added: typeof item[] = [];
  const add = (value: typeof item) => { added.push(value); };
  addCardQuantity(add, item, 3, 8);
  expect(added).toEqual([item, item, item]);
  added.length = 0;
  addCardQuantity(add, item, 10, 2);
  expect(added).toEqual([item, item]);
  added.length = 0;
  for (const stock of [0, -1, NaN]) addCardQuantity(add, item, 3, stock);
  expect(added).toEqual([]);
});

test("local search supports Latvian normalization, typos, seller and category without returning unrelated inventory", () => {
  const products = [mapRow(row, seller)];
  for (const query of ["ĀBOLU", "abolu", "abollu", "darzs", "dzerieni"]) {
    expect(searchPublicListings(products, query).map(l => l.id), query).toEqual([row.id]);
  }
  expect(searchPublicListings(products, "zzzxxyy")).toEqual([]);
  expect(searchPublicListings([], "abolu")).toEqual([]);
  expect(searchPublicListings(products, " ")).toEqual(products);
});

test("catalog RPC nonempty, empty and failure paths all find matching missing-photo products only", async () => {
  for (const options of [{ rpc: [{ id: row.id, relevance: 5 }] }, { rpc: [] }, { rpcFailure: true }]) {
    await withBackend(async () => {
      const result = await CatalogPage({ searchParams: Promise.resolve({ q: "abolu" }) });
      const client = elements(result).find(el => "listings" in el.props)!;
      expect(client.props.listings).toMatchObject([{ id: row.id, quantity: 8, variants: row.variants }]);
      const noMatch = await CatalogPage({ searchParams: Promise.resolve({ q: "zzzxxyy" }) });
      // The nonempty RPC fixture intentionally reports a hit independently of q.
      if (!options.rpc?.length) {
        expect(elements(noMatch).find(el => "listings" in el.props)!.props.listings).toEqual([]);
      }
    }, options);
  }
});

test("empty catalog does not substitute static mock products", async () => {
  await withBackend(async () => {
    const result = await CatalogPage({ searchParams: Promise.resolve({}) });
    expect(elements(result).find(el => "listings" in el.props)!.props.listings).toEqual([]);
  }, { empty: true });
  expect(source("app/page.tsx")).not.toContain("...listings]");
  expect(source("app/page.tsx")).toContain("const spotlightSellers = dbApproved");
});

test("public active, featured, UUID and slug queries retain positive-price filters and delivery fields", async () => {
  await withBackend(async (calls) => {
    const [active, featured, byId, bySlug] = await Promise.all([
      fetchActiveListings(), fetchWeeklyFeatured(), fetchListingById(row.id), fetchListingBySlug(row.slug),
    ]);
    for (const listing of [active[0], featured[0], byId, bySlug]) {
      expect(listing).toMatchObject({ id: row.id, courier_delivery: false, express_delivery: true, dispatch_days: ["monday"] });
    }
    const queries = calls.filter(url => url.pathname.endsWith("/listings"));
    expect(queries).toHaveLength(4);
    for (const query of queries) {
      expect(query.searchParams.get("status")).toBe("eq.active");
      expect(query.searchParams.get("price")).toBe("gt.0");
      expect(query.searchParams.get("select")).toContain("courier_delivery");
      expect(query.searchParams.get("select")).toContain("dispatch_days");
      expect(query.searchParams.get("select")).toContain("storage_type");
    }
    expect(calls.every(url => !url.pathname.endsWith("/sellers"))).toBe(true);
  });
});

test("old active product detail still resolves and review queries receive UUID rather than slug", async () => {
  await withBackend(async () => {
    const result = await ListingPage({ params: Promise.resolve({ id: row.slug }) });
    const tree = elements(result);
    expect(tree.some(el => el.props.listingId === row.id)).toBe(true);
    expect(tree.some(el => el.props.listingId === row.slug)).toBe(false);
    expect(source("app/listing/[id]/page.tsx")).not.toContain("daysUntil");
    expect(source("app/listing/[id]/page.tsx")).not.toContain('const mock = listings.find');
  });
});

test("listing structured-data script serialization cannot be closed by seller-controlled text", async () => {
  const originalTitle = row.title;
  row.title = "</script><script>alert(1)</script>";
  try {
    await withBackend(async () => {
      const result = await ListingPage({ params: Promise.resolve({ id: row.slug }) });
      const scripts = elements(result).filter(el => el.type === "script");
      expect(scripts).toHaveLength(2);
      for (const script of scripts) {
        const html = (script.props.dangerouslySetInnerHTML as { __html: string }).__html;
        expect(html).not.toContain("</script>");
        expect(html).toContain("\\u003c/script>");
      }
    });
  } finally { row.title = originalTitle; }
});

test("sitemap uses the same public active positive-price visibility boundary", async () => {
  await withBackend(async (calls) => {
    const pages = await sitemap();
    expect(pages.some(page => page.url.endsWith(`/listing/${row.slug}`))).toBe(true);
    const query = calls.find(url => url.pathname.endsWith("/listings"))!;
    expect(query.searchParams.get("status")).toBe("eq.active");
    expect(query.searchParams.get("price")).toBe("gt.0");
    expect(calls.some(url => url.pathname.endsWith("/sellers_public"))).toBe(true);
    expect(calls.some(url => url.pathname.endsWith("/sellers"))).toBe(false);
  });
});

test("card quantity and variant identities match detail; catalog refresh invalidates memo", () => {
  const card = source("components/listing-card.tsx");
  expect(card).toContain("addCardQuantity(addItem");
  expect(card).toContain("`${listing.id}-${activeVariant.id}`");
  expect(card).toContain("if (outOfStock) return");
  expect(card).toContain("disabled={outOfStock}");
  const catalog = source("app/catalog/catalog-client.tsx");
  expect(catalog).toContain("[listings, filters, query, sort, storageTypes]");
  expect(catalog).toContain('<option value="relevance">Atbilstība</option>');
  expect(catalog).not.toContain("!l.courier_delivery && !l.express_delivery");
});
