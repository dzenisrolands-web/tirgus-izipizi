import { test, expect } from "@playwright/test";
import React, { isValidElement, type ReactNode, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { AppRouterContext, type AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { SearchParamsContext, PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { ImageConfigContext } from "next/dist/shared/lib/image-config-context.shared-runtime";
import { imageConfigDefault } from "next/dist/shared/lib/image-config";
import { matchRemotePattern } from "next/dist/shared/lib/match-remote-pattern";
import nextConfig from "../../next.config";
import {
  fetchActiveListings, fetchWeeklyFeatured, fetchListingById, fetchListingBySlug,
  fetchDbSellerProfile, fetchApprovedSellers, searchPublicListings, normalizeCatalogSearch,
} from "../../lib/db-listings";
import { PRODUCT_IMAGE_PLACEHOLDER, publicProductImage } from "../../lib/product-image";
import type { Listing } from "../../lib/mock-data";
import { CartProvider } from "../../lib/cart-context";
import CatalogPage from "../../app/catalog/page";
import { CatalogClient } from "../../app/catalog/catalog-client";
import {
  catalogFilters, catalogFilterParams, clearedCatalogParams, catalogSort, catalogSellerOptions, catalogQuery,
  catalogPriceCeiling, activeCatalogFilterCount, filterAndSortCatalog,
} from "../../app/catalog/catalog-state";
import ListingPage, { generateMetadata, generateStaticParams } from "../../app/listing/[id]/page";
import { ProductPhoto } from "../../app/listing/[id]/product-photo";
import { ReviewsSectionDb } from "../../components/reviews-section-db";
import { VariantSelector } from "../../components/variant-selector";

const origin = "https://example.invalid";
const app = resolve(__dirname, "../..");
const source = (file: string) => readFileSync(resolve(app, file), "utf8");
const base = "0b0246bd687eb0618b3a27394ee5b54f3e0b2460";
const uuid = "2a718ac1-be6f-4248-b20f-ecff15312a09";
type Row = Record<string, unknown>;
const row = (values: Row = {}): Row => ({
  id: uuid, slug: "l164", title: "Ķirbju maize", description: "Reāls DB produkts",
  status: "active", price: 125, unit: "gab.", category: "Maize", image_url: null,
  locker_id: "brivibas", seller_id: "seller-real", quantity: 7, created_at: "2020-01-01T00:00:00Z",
  storage_type: "frozen", express_delivery: false, courier_delivery: false, dispatch_days: ["mon"],
  variants: [{ id: "legacy-variant", title: "500 g", price: 125, quantity: 7 }],
  ...values,
});
const seller = (values: Row = {}): Row => ({
  id: "seller-real", name: "Īstais ražotājs", farm_name: "Īstais ražotājs", status: "pending",
  location: "Rīga", avatar_url: PRODUCT_IMAGE_PLACEHOLDER, ...values,
});
const second = row({
  id: "53f73e7f-2307-4da8-8c99-0328c1b9c438", slug: "l163", title: "Ābolu sula", price: 4,
  seller_id: "seller-second", category: "Dzērieni", image_url: "https://business.izipizi.lv/",
  storage_type: "ambient", courier_delivery: true, express_delivery: true, dispatch_days: ["tue"],
  created_at: "2026-11-09T00:00:00Z", variants: [],
});

type Backend = (url: URL, init: RequestInit) => Response | Promise<Response>;
let route: Backend;
let originalFetch: typeof fetch;
let blocked: string[];
const calls: Array<{ url: URL; method: string }> = [];

// Playwright's default TSX transform serializes JSX for browser component tests.
// These tests run React SSR in Node, so use the real React element runtime.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const playwrightJsx = require("playwright/jsx-runtime");
const originalJsx = { ...playwrightJsx };
test.beforeAll(async () => { Object.assign(playwrightJsx, await import("react/jsx-runtime")); });
test.afterAll(() => { Object.assign(playwrightJsx, originalJsx); });

test.beforeEach(() => {
  calls.length = 0;
  blocked = [];
  route = () => { throw new Error("No dummy backend configured"); };
  originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.origin !== origin) {
      blocked.push(url.origin);
      throw new Error("Forbidden: all network requests must target example.invalid");
    }
    calls.push({ url, method: init?.method ?? "GET" });
    return route(url, init ?? {});
  };
});
test.afterEach(() => {
  globalThis.fetch = originalFetch;
  expect(blocked).toEqual([]);
});

function dummyDb(options: {
  rows?: Row[]; sellers?: Row[]; listingsFail?: boolean; sellersFail?: boolean;
  rpc?: Row[] | "error" | "missing" | "throw"; featured?: Array<{ listing_id: string; position: number }>;
} = {}): Backend {
  const rows = options.rows ?? [row(), second];
  const sellers = options.sellers ?? [seller(), seller({ id: "seller-second", name: "Sulas saimniecība", farm_name: "Sulas saimniecība", status: "approved" })];
  return (url, init) => {
    if (url.pathname === "/rest/v1/rpc/search_products") {
      expect(init.method).toBe("POST");
      if (options.rpc === "throw") throw new Error("Dummy transport failure");
      if (typeof options.rpc === "string") return Response.json({ code: options.rpc === "missing" ? "PGRST202" : "XX000" }, { status: 400 });
      return Response.json(options.rpc ?? []);
    }
    expect(init.method ?? "GET").toBe("GET"); // Never stock/order/schema writes.
    if (url.pathname === "/rest/v1/weekly_featured") return Response.json(options.featured ?? []);
    const singular = new Headers(init.headers).get("accept")?.includes("vnd.pgrst.object");
    const match = (candidate: Row, key: string) => {
      const value = url.searchParams.get(key);
      if (!value) return true;
      if (value.startsWith("eq.")) return candidate[key] === value.slice(3);
      if (value.startsWith("in.(")) return value.slice(4, -1).split(",").map(id => id.replace(/^"|"$/g, "")).includes(String(candidate[key]));
      return true;
    };
    const result = (found: Row[]) => singular
      ? found[0] ? Response.json(found[0]) : Response.json({ code: "PGRST116" }, { status: 406 })
      : Response.json(found);
    if (url.pathname === "/rest/v1/listings") {
      if (options.listingsFail) return Response.json({ code: "XX000" }, { status: 500 });
      expect(url.searchParams.get("status")).toBe("eq.active");
      expect(url.searchParams.get("price")).toBe("gt.0");
      for (const field of ["storage_type", "express_delivery", "courier_delivery", "dispatch_days", "variants", "quantity"]) {
        expect(url.searchParams.get("select")).toContain(field);
      }
      return result(rows.filter(candidate => candidate.status === "active"
        && typeof candidate.price === "number" && candidate.price > 0
        && ["id", "slug", "seller_id"].every(key => match(candidate, key))));
    }
    if (url.pathname === "/rest/v1/sellers_public") {
      if (options.sellersFail) return Response.json({ code: "XX000" }, { status: 500 });
      return result(sellers.filter(candidate => ["id", "status"].every(key => match(candidate, key))));
    }
    throw new Error(`Unexpected dummy path ${url.pathname}`);
  };
}

function providers(children: ReactNode, query = "") {
  const router = { push: () => {}, replace: () => {}, prefetch: () => {}, refresh: () => {}, back: () => {}, forward: () => {}, bfcacheId: "dummy" } as AppRouterInstance;
  return React.createElement(AppRouterContext.Provider, { value: router },
    React.createElement(SearchParamsContext.Provider, { value: new URLSearchParams(query) },
      React.createElement(PathnameContext.Provider, { value: "/catalog" },
        React.createElement(ImageConfigContext.Provider, { value: { ...imageConfigDefault, ...nextConfig.images } },
          React.createElement(CartProvider, null, children)))));
}
function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<Record<string, unknown>>(node)) return [];
  return [node, ...elements(node.props.children as ReactNode)];
}
async function catalog(query = "") {
  const queryParams = Object.fromEntries(new URLSearchParams(query));
  const tree = await CatalogPage({ searchParams: Promise.resolve(queryParams) });
  const client = elements(tree).find(element => element.type === CatalogClient)!;
  return { tree, client, listings: client.props.listings as Listing[], html: renderToStaticMarkup(providers(tree, query)) };
}

for (const image of [null, undefined, "", " ", "https://business.izipizi.lv", "https://business.izipizi.lv/",
  "https://foreign.example.invalid/product.jpg", "javascript:alert(1)", "data:image/svg+xml,<svg/>",
  "//business.izipizi.lv/image.png", "http://business.izipizi.lv/image.jpg", "https://user:pass@business.izipizi.lv/image.jpg",
  "https://business.izipizi.lv:8443/image.jpg", "/\\evil/image.jpg", "/images/x\u0000.jpg", "not-a-url"]) {
  test(`invalid/missing image ${String(image)} uses a neutral local asset`, () => {
    expect(publicProductImage(image)).toBe(PRODUCT_IMAGE_PLACEHOLDER);
  });
}
for (const image of ["/images/real.jpg", "https://images.unsplash.com/photo-1", "https://business.izipizi.lv/images/real.jpg", "https://project.supabase.co/storage/v1/object/public/image.jpg"]) {
  test(`Next-allowed safe image ${image} remains usable`, () => expect(publicProductImage(image)).toBe(image));
}
test("placeholder SVG is neutral, static and exists", () => {
  const svg = source(`public${PRODUCT_IMAGE_PLACEHOLDER}`);
  expect(svg).toContain("Attēls nav pieejams");
  expect(svg).not.toMatch(/<script|href=|<image|<foreignObject/g);
});

test("every accepted remote product image agrees with the actual Next image allowlist", () => {
  for (const image of [
    "https://images.unsplash.com/photo-1", "https://business.izipizi.lv/images/real.jpg",
    "https://project.supabase.co/storage/v1/object/public/image.jpg",
  ]) {
    const result = publicProductImage(image);
    expect(result).toBe(image);
    expect(nextConfig.images?.remotePatterns?.some(pattern => matchRemotePattern(pattern, new URL(result)))).toBe(true);
  }
  for (const image of ["https://izipizi.lv/image.jpg", "https://supabase.co/image.jpg"]) {
    expect(publicProductImage(image)).toBe(PRODUCT_IMAGE_PLACEHOLDER);
  }
});
test("nonfinite or malformed prices cannot enter public mapped results", async () => {
  route = dummyDb({ rows: [
    row({ id: "infinite", price: Infinity }), row({ id: "nan", price: NaN }),
    row({ id: "string", price: "125" }), row({ id: "null", price: null }),
  ] });
  expect(await fetchActiveListings()).toEqual([]);
});

test("active positive-priced DB rows survive absent photos, old dates, >100 price and pending seller status", async () => {
  route = dummyDb({ rows: [row(), second, row({ id: "inactive", status: "draft" }), row({ id: "zero", price: 0 }), row({ id: "negative", price: -1 })] });
  const listings = await fetchActiveListings();
  expect(listings.map(listing => listing.id)).toEqual([uuid, second.id]);
  expect(listings[0]).toMatchObject({
    id: uuid, slug: "l164", quantity: 7, price: 125, freshnessDate: "", storageType: "frozen",
    courier_delivery: false, express_delivery: false, dispatch_days: ["mon"], image: PRODUCT_IMAGE_PLACEHOLDER,
    variants: [{ id: "legacy-variant", title: "500 g", price: 125, quantity: 7 }],
  });
  expect(listings[1].storageType).toBe("chilled");
  expect(calls.every(call => call.method === "GET")).toBe(true);
});
test("empty or failed DB catalog never falls back to mock products", async () => {
  for (const options of [{ rows: [] }, { listingsFail: true }]) {
    route = dummyDb(options);
    const result = await catalog();
    expect(result.listings).toEqual([]);
    expect(result.html).toContain("Nav atrasts neviens produkts");
    expect(result.html).not.toContain("/listing/l1");
  }
});
test("seller directory remains approved-only but an existing pending public seller's active listings remain visible", async () => {
  route = dummyDb();
  expect(await fetchDbSellerProfile("seller-real")).toMatchObject({ seller: { id: "seller-real" }, listings: [{ id: uuid }] });
  const approved = await fetchApprovedSellers();
  expect(approved.map(profile => profile.seller.id)).toEqual(["seller-second"]);
  expect((await fetchActiveListings()).map(listing => listing.id)).toContain(uuid);
});
test("DB detail queries enforce active status/positive price and retain quantity/delivery/storage/variants", async () => {
  route = dummyDb();
  expect(await fetchListingById(uuid)).toMatchObject({ id: uuid, variants: [{ id: "legacy-variant" }], storageType: "frozen", quantity: 7 });
  expect(await fetchListingBySlug("l164")).toMatchObject({ id: uuid, slug: "l164" });
  expect(await fetchListingBySlug("missing")).toBeNull();
});
test("weekly featured uses canonical real rows, respects editor order and includes missing photos", async () => {
  route = dummyDb({ featured: [{ listing_id: String(second.id), position: 1 }, { listing_id: uuid, position: 2 }] });
  const featured = await fetchWeeklyFeatured();
  expect(featured.map(listing => listing.id)).toEqual([second.id, uuid]);
  expect(featured[0].image).toBe(PRODUCT_IMAGE_PLACEHOLDER);
});

for (const rpc of ["missing", "error", "throw", []] as const) {
  test(`nonmatching search remains empty when RPC is ${String(rpc) || "empty"}`, async () => {
    route = dummyDb({ rpc: Array.isArray(rpc) ? [] : rpc as "missing" | "error" | "throw" });
    const result = await catalog("q=zzzxxyy-no-such-product");
    expect(result.listings).toEqual([]);
    expect(result.html).toContain("Nav atrasts neviens produkts");
  });
}
for (const rpc of ["missing", "error", "throw", []] as const) {
  test(`diacritic-insensitive local search works when RPC is ${String(rpc) || "empty"}`, async () => {
    route = dummyDb({ rpc: Array.isArray(rpc) ? [] : rpc as "missing" | "error" | "throw" });
    const result = await catalog("q=kirbju");
    expect(result.listings.map(listing => listing.id)).toEqual([uuid]);
    expect(result.html).toContain("Ķirbju maize");
    expect(result.html).not.toContain("Ābolu sula");
  });
}
test("biased RPC missing photo hits cannot hide local matches; foreign IDs cannot introduce products", async () => {
  route = dummyDb({ rpc: [{ id: second.id, relevance: 10 }, { id: "inactive-or-mock", title: "Injected", price: 0 }] });
  const result = await catalog("q=kirbju");
  expect(result.listings.map(listing => listing.id).sort()).toEqual([uuid, second.id].sort());
  const actual = result.listings.find(listing => listing.id === uuid)!;
  expect(actual).toMatchObject({ quantity: 7, storageType: "frozen", courier_delivery: false, variants: [{ id: "legacy-variant" }] });
  expect(result.html).not.toContain("Injected");
});
test("search RPC only returns hydrated canonical fields, never quantity1/delivery/storage fabricated defaults", async () => {
  route = dummyDb({ rpc: [{ id: uuid, quantity: 1, price: 0, title: "RPC counterfeit", relevance: 99 }] });
  const listings = await fetchActiveListings();
  const result = searchPublicListings(listings, "unmatched", [{ id: uuid, relevance: 99 }]);
  expect(result).toEqual([listings[0]]);
  expect(normalizeCatalogSearch("  ĶIRBJU ĀBOLI  ")).toBe("kirbju aboli");
  expect(searchPublicListings(listings, "zzzxxyy")).toEqual([]);
});
test("one-character queries also filter rather than substituting the whole catalog", async () => {
  route = dummyDb();
  expect((await catalog("q=k")).listings.map(listing => listing.id)).toEqual([uuid]);
  expect(calls.some(call => call.url.pathname.includes("/rpc/"))).toBe(false);
});

test("query parser handles repeated, blank and malformed values and bounds external search requests", async () => {
  expect(catalogQuery([" kirbju ", "ignored"])).toBe("kirbju");
  for (const raw of [undefined, null, {}, 123, [], ["", "ignored"], [null, "ignored"], "  "]) expect(catalogQuery(raw)).toBe("");
  expect(catalogQuery("ā".repeat(1000))).toHaveLength(200);
  route = dummyDb({ rpc: "missing" });
  const tree = await CatalogPage({ searchParams: Promise.resolve({ q: ["kirbju", "ignored"] }) });
  const client = elements(tree).find(element => element.type === CatalogClient)!;
  expect((client.props.listings as Listing[]).map(listing => listing.id)).toEqual([uuid]);
  expect(renderToStaticMarkup(providers(tree, "q=kirbju&q=ignored"))).toContain("Ķirbju maize");
  const requestsBeforeEmpty = calls.filter(call => call.method === "POST").length;
  await CatalogPage({ searchParams: Promise.resolve({ q: ["", "ignored"] }) });
  expect(calls.filter(call => call.method === "POST")).toHaveLength(requestsBeforeEmpty);
  const db = dummyDb({ rpc: "missing" });
  route = (url, init) => {
    if (url.pathname.includes("/rpc/")) expect(JSON.parse(String(init.body)).query).toHaveLength(200);
    return db(url, init);
  };
  await CatalogPage({ searchParams: Promise.resolve({ q: "x".repeat(1000) }) });
});

test("old photo-less real slug wins over a colliding mock ID and uses actual review/listing IDs", async () => {
  route = dummyDb();
  const tree = await ListingPage({ params: Promise.resolve({ id: "l164" }) });
  const nodes = elements(tree);
  expect(nodes.find(node => node.type === ReviewsSectionDb)?.props.listingId).toBe(uuid);
  expect(nodes.find(node => node.type === VariantSelector)?.props).toMatchObject({ listingId: uuid, variants: [{ id: "legacy-variant" }] });
  const html = renderToStaticMarkup(providers(tree));
  expect(html).toContain("<h1");
  expect(html).toContain("Ķirbju maize");
  expect(html).toContain(PRODUCT_IMAGE_PLACEHOLDER);
  expect(html).not.toContain("Derīgs līdz");
  expect(html).not.toContain("Beidzies!");
  expect(html).not.toContain("merchantReturnDays");
  expect(calls.some(call => call.url.searchParams.get("slug") === "eq.l164")).toBe(true);
});
test("product details and metadata return no mock product when DB is empty or errored", async () => {
  for (const options of [{ rows: [] }, { listingsFail: true }]) {
    route = dummyDb(options);
    await expect(ListingPage({ params: Promise.resolve({ id: "l164" }) })).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
    expect(await generateMetadata({ params: Promise.resolve({ id: "l164" }) })).toEqual({});
  }
  expect(await generateStaticParams()).toEqual([]);
});
test("UUID requests permanently redirect to encoded canonical slug; canonical metadata agrees", async () => {
  route = dummyDb({ rows: [row({ slug: "ķirbju maize" })] });
  await expect(ListingPage({ params: Promise.resolve({ id: uuid }) })).rejects.toMatchObject({
    digest: "NEXT_REDIRECT;replace;/listing/%C4%B7irbju%20maize;308;",
  });
  expect(await generateMetadata({ params: Promise.resolve({ id: uuid }) })).toMatchObject({
    alternates: { canonical: "/listing/%C4%B7irbju%20maize" },
    openGraph: { url: "https://tirgus.izipizi.lv/listing/%C4%B7irbju%20maize" },
  });
});
test("photo-less product sharing uses the existing raster OG image without changing UI placeholders or real photos", async () => {
  for (const image of [null, "https://business.izipizi.lv/", "https://business.izipizi.lv/images/real.jpg"]) {
    route = dummyDb({ rows: [row({ image_url: image })] });
    const expected = image?.endsWith("real.jpg") ? image : "/opengraph-image";
    expect(await generateMetadata({ params: Promise.resolve({ id: "l164" }) })).toMatchObject({
      openGraph: { images: [{ url: expected, alt: "Ķirbju maize" }] },
      twitter: { card: "summary_large_image", images: [{ url: expected, alt: "Ķirbju maize" }] },
    });
    const tree = await ListingPage({ params: Promise.resolve({ id: "l164" }) });
    expect(elements(tree).find(node => node.type === ProductPhoto)?.props.src)
      .toBe(expected === "/opengraph-image" ? PRODUCT_IMAGE_PLACEHOLDER : image);
  }
});
test("UUID products with no slug render their real DB record without a redirect", async () => {
  route = dummyDb({ rows: [row({ slug: null })] });
  const tree = await ListingPage({ params: Promise.resolve({ id: uuid }) });
  expect(renderToStaticMarkup(providers(tree))).toContain("Ķirbju maize");
});
test("related product recommendations come only from active real rows from the same DB seller", async () => {
  route = dummyDb({ rows: [row(), second, row({ id: "related-uuid", slug: "related", title: "Īsts saistīts produkts" }), row({ id: "hidden", status: "draft", title: "Hidden product" })] });
  const tree = await ListingPage({ params: Promise.resolve({ id: "l164" }) });
  const html = renderToStaticMarkup(providers(tree));
  expect(html).toContain("/listing/related");
  expect(html).toContain("Īsts saistīts produkts");
  expect(html).not.toContain("Hidden product");
  expect(html).not.toContain("/listing/l163");
});
test("product and breadcrumb JSON-LD escape raw < while retaining valid JSON", async () => {
  const malicious = "</script><script>alert(1)</script>";
  route = dummyDb({ rows: [row({ title: malicious, description: malicious })] });
  const tree = await ListingPage({ params: Promise.resolve({ id: "l164" }) });
  const scripts = elements(tree).filter(node => node.type === "script");
  expect(scripts).toHaveLength(2);
  for (const script of scripts) {
    const text = (script.props.dangerouslySetInnerHTML as { __html: string }).__html;
    expect(text).not.toContain("<");
    expect(text).toContain("\\u003c");
    expect(() => JSON.parse(text)).not.toThrow();
  }
});
test("product photo SSR uses the neutral placeholder for unsupported origins", () => {
  const html = renderToStaticMarkup(providers(React.createElement(ProductPhoto, { src: "https://foreign.example.invalid/image.jpg", title: "Fixture" })));
  expect(html).toContain(PRODUCT_IMAGE_PLACEHOLDER);
  expect(html).not.toContain("foreign.example.invalid");
});

test("default catalog filters are uncapped and SSR includes products above100", async () => {
  route = dummyDb();
  const result = await catalog();
  expect(catalogFilters(new URLSearchParams()).maxPrice).toBeNull();
  expect(catalogPriceCeiling(result.listings)).toBe(125);
  expect(result.html).toContain("Ķirbju maize");
  expect(result.html).toContain("Bez cenas ierobežojuma");
  expect(result.html).toContain("max=\"125\"");
});
test("real seller options are derived from complete DB catalog, including search-with-no-results", async () => {
  route = dummyDb();
  const result = await catalog("q=zzzxxyy-no-such-product");
  expect(result.client.props.sellers).toEqual([
    { id: "seller-real", name: "Īstais ražotājs" }, { id: "seller-second", name: "Sulas saimniecība" },
  ]);
  expect(result.html).toContain("Īstais ražotājs");
  expect(result.html).not.toContain("WILD");
  expect(catalogSellerOptions(await fetchActiveListings())).toEqual(result.client.props.sellers);
});
for (const sort of ["newest", "alpha_asc", "alpha_desc", "price_asc", "price_desc"]) {
  test(`URL sort ${sort} is honored consistently by SSR and pure filtering`, async () => {
    route = dummyDb();
    const result = await catalog(`sort=${sort}`);
    const ordered = filterAndSortCatalog(result.listings, catalogFilters(new URLSearchParams()), catalogSort(sort));
    const titles = ordered.map(listing => result.html.indexOf(`>${listing.title}</p>`));
    expect(titles.every(position => position >= 0)).toBe(true);
    expect(titles[0]).toBeLessThan(titles[1]);
    expect(result.html).toContain(`<option value="${sort}" selected="">`);
  });
}
test("unknown sort does not invent popularity ordering", () => {
  expect(catalogSort("popular")).toBe("newest");
  expect(catalogSort(null)).toBe("newest");
});
for (const query of ["seller=seller-real", "category=Maize", "storage=frozen", "delivery=courier", "delivery=locker", "day=mon", "maxPrice=10", "q=kirbju"]) {
  test(`weekly feature is hidden for active filter ${query}`, async () => {
    route = dummyDb({ featured: [{ listing_id: uuid, position: 1 }] });
    const result = await catalog(query);
    expect(result.html).not.toContain("Nedēļas piedāvājums");
    expect(activeCatalogFilterCount(catalogFilters(new URLSearchParams(query)), new URLSearchParams(query).get("q") ?? "")).toBeGreaterThan(0);
  });
}
test("weekly feature is shown for clean browsing and sorting is not treated as a filter", async () => {
  route = dummyDb({ featured: [{ listing_id: uuid, position: 1 }] });
  expect((await catalog("sort=price_asc&utm_source=fixture")).html).toContain("Nedēļas piedāvājums");
});
test("URL filter clearing removes q/seller/category and all filters but preserves campaign and sort", () => {
  const current = new URLSearchParams("q=x&seller=seller-real&category=Maize&storage=frozen&delivery=courier&day=mon&maxPrice=10&utm_source=razotajs&utm_campaign=starter&sort=price_desc");
  expect(clearedCatalogParams(current).toString()).toBe("utm_source=razotajs&utm_campaign=starter&sort=price_desc");
  const next = catalogFilterParams(current, catalogFilters(new URLSearchParams("seller=seller-second&category=Dzērieni")));
  expect(next.get("seller")).toBe("seller-second");
  expect(next.get("category")).toBe("Dzērieni");
  expect(next.get("q")).toBe("x");
  expect(next.get("utm_source")).toBe("razotajs");
  expect(next.get("storage")).toBeNull();
  expect(current.get("seller")).toBe("seller-real"); // Immutable URL helper.
});
test("filter parser ignores invalid price/day/service settings without hiding default products", () => {
  const filters = catalogFilters(new URLSearchParams("maxPrice=NaN&day=noday&storage=unknown&delivery=unknown"));
  expect(filters).toMatchObject({ maxPrice: null, day: "", storageType: "all", delivery: "all" });
});
test("local filtering respects real storage/service/day data and lockers remain available with courier flags", async () => {
  route = dummyDb();
  const listings = await fetchActiveListings();
  const ids = (query: string) => filterAndSortCatalog(listings, catalogFilters(new URLSearchParams(query)), "newest", { [uuid]: "chilled", [String(second.id)]: "ambient" }).map(listing => listing.id);
  expect(ids("storage=frozen")).toEqual([uuid]); // Canonical storage wins over late context.
  expect(ids("storage=chilled")).toEqual([second.id]);
  expect(ids("delivery=courier")).toEqual([second.id]);
  expect(ids("delivery=express")).toEqual([second.id]);
  expect(ids("delivery=locker")).toEqual([second.id, uuid]);
  expect(ids("day=mon")).toEqual([uuid]);
  expect(ids("maxPrice=10")).toEqual([second.id]);
});
test("changed server listings cannot be held by a stale memo dependency", () => {
  const client = source("app/catalog/catalog-client.tsx");
  expect(client).toContain("[listings, filters, sort, storageTypes]");
  expect(client).not.toContain("setQuery");
  expect(client).not.toContain("setSort");
  expect(client).toContain("catalogSort(params.get(\"sort\"))");
  expect(client).toContain("clearedCatalogParams");
});
test("variant/cart quantity mechanisms and frozen fee/mock sources remain byte-compatible", () => {
  const original = (file: string) => execFileSync("git", ["show", `${base}:apps/tirgus/${file}`], { cwd: app, encoding: "utf8" });
  for (const file of ["lib/utils.ts", "lib/mock-data.ts", "lib/cart-context.tsx", "components/variant-selector.tsx", "components/add-to-cart-button.tsx"]) {
    expect(source(file), file).toBe(original(file));
  }
  const cardHandler = (text: string) => text.slice(text.indexOf("  function handleAddToCart"), text.indexOf("\n  const url ="));
  expect(cardHandler(source("components/listing-card.tsx"))).toBe(cardHandler(original("components/listing-card.tsx")));
  const mapper = (text: string) => text.slice(text.indexOf("function mapVariants"), text.indexOf("\nfunction mapRow"));
  expect(mapper(source("lib/db-listings.ts"))).toBe(mapper(original("lib/db-listings.ts")));
  expect(source("app/listing/[id]/page.tsx")).not.toContain("merchantReturnDays");
  expect(source("app/listing/[id]/page.tsx")).toContain('shippingRate: { "@type": "MonetaryAmount", value: 3, currency: "EUR" }');
});
