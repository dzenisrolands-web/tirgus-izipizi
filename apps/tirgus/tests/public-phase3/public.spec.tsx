import "./react-runtime";
import { test, expect } from "@playwright/test";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Metadata } from "next";
import { createDefaultMetadata } from "next/dist/lib/metadata/default-metadata";
import { createMetadataElements } from "next/dist/lib/metadata/metadata-elements";
import { resolveAlternates } from "next/dist/lib/metadata/resolvers/resolve-basics";
import { resolveOpenGraph } from "next/dist/lib/metadata/resolvers/resolve-opengraph";
import Home from "../../app/page";
import Seller, { generateMetadata as sellerMetadata, generateStaticParams } from "../../app/seller/[id]/page";
import Producers from "../../app/razotaji/page";
import Lockers, { metadata as lockerMetadata } from "../../app/lockers/page";
import Contact, { metadata as contactMetadata } from "../../app/contact/page";
import { metadata as sellMetadata } from "../../app/sell/page";
import sitemap from "../../app/sitemap";
import { GET as llms } from "../../app/llms.txt/route";
import { CartProvider } from "../../lib/cart-context";
import { StorageTypesProvider } from "../../lib/storage-types-context";
import { openLockers } from "../../lib/locker-policy";
import { metadata as deliveryMetadata } from "../../app/piegade/page";
import { metadata as aboutMetadata } from "../../app/par-mums/page";
import { metadata as howMetadata } from "../../app/how-it-works/page";

type Handler = (url: URL, init?: RequestInit) => Response;
const source = (path: string) => readFileSync(resolve(__dirname, "../..", path), "utf8");
async function backend(handler: Handler, run: () => Promise<void>) {
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.origin !== "https://example.invalid") throw new Error("Non-dummy network forbidden");
    expect(init?.method ?? "GET").toBe("GET");
    return handler(url, init);
  };
  try { await run(); } finally { globalThis.fetch = original; }
}
const product = {
  id: "l1", slug: "fixture-slug", title: "Real fixture product", price: 125,
  unit: "gab.", image_url: "/images/fixture.jpg", quantity: 2,
  category: "Saldēta pārtika", seller_id: "fixture-seller", created_at: "2020-01-01T00:00:00.000Z",
};
const seller = {
  id: "fixture-seller", name: "Real fixture producer", farm_name: "Real fixture farm",
  status: "approved", logo_url: "/images/fixture-logo.jpg", location: "Rīga",
};
function fixtures(url: URL) {
  switch (url.pathname) {
    case "/rest/v1/orders": return Response.json([]);
    case "/rest/v1/weekly_featured": return Response.json([]);
    case "/rest/v1/listings": return Response.json([product]);
    case "/rest/v1/sellers_public":
      return Response.json(url.searchParams.has("id") && !url.searchParams.get("id")?.startsWith("in.")
        ? seller : [seller]);
    default: throw new Error(`Unexpected existing-schema request: ${url.pathname}`);
  }
}
function render(node: React.ReactNode) {
  return renderToStaticMarkup(<CartProvider><StorageTypesProvider>{node}</StorageTypesProvider></CartProvider>);
}

test("home renders only real DB identities, preserves slug links and uses truthful discovery labels", async () => {
  await backend(fixtures, async () => {
    const $ = load(render(await Home()));
    expect($("h1").text()).toContain("Tieši no savējiem");
    expect($("body").text()).not.toContain("Produkti šobrīd nav pieejami");
    expect($('a[href="/listing/fixture-slug"]').length).toBeGreaterThan(0);
    expect($("body").text()).toContain(product.title);
    expect($("body").text()).toContain(seller.name);
    expect($('a[href*="sort=popular"]')).toHaveLength(0);
    expect($("h2").text()).not.toContain("Šonedēļ visi pērk šo");
    expect($("h2").text()).toContain("Produkti, ko vērts iepazīt");
    expect($("body").text()).not.toContain("5 (0)");
    expect($("body").text()).not.toContain("24/7");
  });
});

test("empty or unavailable public DB never resurrects mock products/producers", async () => {
  for (const failure of [false, true]) await backend(() => failure
    ? Response.json({ message: "Fixture unavailable" }, { status: 500 }) : Response.json([]), async () => {
    const $ = load(render(await Home()));
    expect($('a[href^="/listing/"]')).toHaveLength(0);
    expect($('a[href^="/seller/"]')).toHaveLength(0);
    expect($("body").text()).toContain("Produkti šobrīd nav pieejami");
    expect($("h1").text()).toContain("Tieši no savējiem");
    const producers = load(render(await Producers()));
    expect(producers('a[href^="/seller/"]')).toHaveLength(0);
    expect(producers("h1").text()).toBe("Ražotāji");
  });
});

test("seller mock ID collision resolves real DB profile, not curated mock data", async () => {
  await backend(url => {
    if (url.pathname === "/rest/v1/sellers_public") return Response.json({ ...seller, id: "bujums" });
    if (url.pathname === "/rest/v1/listings") return Response.json([]);
    throw new Error("No private seller queries");
  }, async () => {
    expect(await generateStaticParams()).toEqual([]);
    const $ = load(render(await Seller({ params: Promise.resolve({ id: "bujums" }) })));
    expect($("h1").text()).toBe(seller.name);
    expect($('a[href^="/listing/"]')).toHaveLength(0);
    const metadata = await sellerMetadata({ params: Promise.resolve({ id: "bujums" }) });
    expect(metadata.title).toContain(seller.name);
  });
});

test("seller JSON-LD cannot break its script element with DB-controlled names", async () => {
  const malicious = "</script><script>globalThis.compromised=true</script>";
  await backend(url => url.pathname === "/rest/v1/sellers_public"
    ? Response.json({ ...seller, name: malicious, description: malicious }) : Response.json([]), async () => {
    const $ = load(render(await Seller({ params: Promise.resolve({ id: seller.id }) })));
    expect($("script:not([type='application/ld+json'])")).toHaveLength(0);
    const blocks = $("script[type='application/ld+json']").toArray().map(element => JSON.parse($(element).text()));
    expect(blocks[0].name).toBe(malicious);
    expect(blocks[1].itemListElement[2].name).toBe(malicious);
  });
});

test("missing seller returns actual notFound, not a mock profile", async () => {
  await backend(() => Response.json({ message: "No fixture profile" }, { status: 404 }), async () => {
    await expect(Seller({ params: Promise.resolve({ id: "bujums" }) })).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
    expect((await sellerMetadata({ params: Promise.resolve({ id: "bujums" }) })).robots).toMatchObject({ index: false });
  });
});

async function renderedMetadata(metadata: Metadata, path: string) {
  const base = new URL("https://tirgus.izipizi.lv");
  const context = { trailingSlash: false, isStaticMetadataRouteFile: false };
  const resolved = {
    ...createDefaultMetadata(), title: null,
    alternates: await resolveAlternates(metadata.alternates, base, Promise.resolve(path), context),
    openGraph: await resolveOpenGraph(metadata.openGraph, base, Promise.resolve(path), context, null),
  };
  // Next's public rendering representation stringifies resolved URL objects.
  return load(renderToStaticMarkup(<>{createMetadataElements(JSON.parse(JSON.stringify(resolved)))}</>));
}

test("actual Next metadata elements render route-specific canonical and OG URLs", async () => {
  for (const [metadata, path] of [
    [contactMetadata, "/contact"], [sellMetadata, "/sell"], [lockerMetadata, "/lockers"],
    [deliveryMetadata, "/piegade"], [aboutMetadata, "/par-mums"], [howMetadata, "/how-it-works"],
  ] as const) {
    const $ = await renderedMetadata(metadata, path);
    expect($('link[rel="canonical"]').attr("href")).toBe(`https://tirgus.izipizi.lv${path}`);
    expect($('meta[property="og:url"]').attr("content")).toBe(`https://tirgus.izipizi.lv${path}`);
  }
  expect(source("app/layout.tsx")).not.toContain("og-default.jpg");
  expect(source("app/layout.tsx")).toContain('url: "/opengraph-image"');
  expect(source("app/opengraph-image.tsx")).toContain('contentType = "image/png"');
});

test("sitemap uses publishable existing public columns and real modification dates, not photos or approval gates for listings", async () => {
  await backend((url, init) => {
    expect(new Headers(init?.headers).get("apikey")).toBe("dummy-publishable");
    if (url.pathname === "/rest/v1/listings") {
      expect(url.searchParams.get("status")).toBe("eq.active");
      expect(url.searchParams.get("price")).toBe("gt.0");
      expect(url.searchParams.has("seller_id")).toBe(false);
      return Response.json([
        { id: "fixture", slug: "real-slug", price: 125, updated_at: "2020-02-02T00:00:00.000Z" },
        { id: "no-photo", slug: null, price: 1, updated_at: "invalid" },
        { id: "zero", price: 0 }, { id: "negative", price: -1 }, { id: "missing", price: null },
      ]);
    }
    expect(url.pathname).toBe("/rest/v1/sellers_public");
    expect(url.searchParams.get("select")).toBe("id,updated_at");
    expect(url.searchParams.get("status")).toBe("eq.approved");
    return Response.json([{ id: "seller", updated_at: "2021-01-01T00:00:00.000Z" }]);
  }, async () => {
    const result = await sitemap();
    expect(result.find(item => item.url.endsWith("/listing/real-slug"))?.lastModified).toEqual(new Date("2020-02-02T00:00:00.000Z"));
    expect(result.find(item => item.url.endsWith("/seller/seller"))?.lastModified).toEqual(new Date("2021-01-01T00:00:00.000Z"));
    expect(result.find(item => item.url.endsWith("/listing/no-photo"))).toBeTruthy();
    expect(result.find(item => item.url.endsWith("/listing/no-photo"))?.lastModified).toBeUndefined();
    expect(result.some(item => /\/listing\/(zero|negative|missing)$/.test(item.url))).toBe(false);
    expect(result.filter(item => !/\/(listing|seller)\//.test(item.url)).every(item => !item.lastModified)).toBe(true);
    expect(result.some(item => /receptes|keriens|dashboard|admin/.test(item.url))).toBe(false);
  });
});

test("sitemap lists canonical delivery destination instead of redirected locker alias", async () => {
  await backend(() => Response.json([]), async () => {
    const urls = (await sitemap()).map(item => item.url);
    expect(urls).toContain("https://tirgus.izipizi.lv/piegade");
    expect(urls).not.toContain("https://tirgus.izipizi.lv/lockers");
  });
});

test("sitemap backend errors fall back to static public pages without fake DB pages", async () => {
  await backend(() => Response.json({ message: "Dummy failure" }, { status: 500 }), async () => {
    const result = await sitemap();
    expect(result.some(item => /\/(listing|seller)\//.test(item.url))).toBe(false);
    expect(result.some(item => item.url.endsWith("/contact"))).toBe(true);
  });
});

test("public location copy follows existing open policy and contact accurately offers mailto", async () => {
  const locations = load(render(<Lockers />));
  expect(locations("h2")).toHaveLength(openLockers.length);
  expect(locations("body").text()).not.toContain("Tukuma tirgus");
  expect(locations("body").text()).toContain("Ilūkstes");
  expect(locations("body").text()).not.toContain("aktīvs sludinājums");
  const body = await (await llms()).text();
  expect(body).toContain("confirms order within 72 h");
  expect(body).not.toContain("Tukuma tirgus");
  expect(body).toContain("Ilūkstes");
  expect(body).toContain(`currently ${openLockers.length} open locations`);
  const contact = load(render(<Contact />));
  expect(contact("form").attr("action")).toBe("mailto:tirgus@izipizi.lv");
  expect(contact('button[type="submit"]').text().trim()).toBe("Atvērt e-pasta lietotni");
  for (const file of ["app/piegade/page.tsx", "app/par-mums/page.tsx", "app/how-it-works/page.tsx"]) {
    expect(source(file)).not.toContain("24/7");
  }
});
