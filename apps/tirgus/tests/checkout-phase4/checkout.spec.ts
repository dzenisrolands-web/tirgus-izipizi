import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { POST as quoteApi } from "../../app/api/checkout/quote/route";
import { POST as checkout } from "../../app/api/checkout/create-session/route";
import { GET as orderRead } from "../../app/api/orders/[orderNumber]/route";
import { POST as retry } from "../../app/api/checkout/retry-payment/route";
import { buildCheckoutQuote } from "../../lib/checkout-quote";
import { CheckoutError, loadCheckoutListings, normalizeCheckoutItems, orderItemSnapshot, parseItemReferences, priceCents, type CheckoutListing } from "../../lib/checkout-items";
import { validatePromoCode } from "../../lib/promo";
import { canonicalCartId } from "../../lib/cart-identity";
import { hasOrderCapability } from "../../lib/order-access";
import type { CheckoutQuote, CheckoutQuoteResponse } from "../../lib/checkout-contract";
import { calculateDeliveryQuote } from "../../lib/delivery-policy";

const origin = "https://example.invalid";
const app = resolve(__dirname, "../..");
const contractBase = "cd56b0483da410a71d8c586e03525ef5ba0cca4f";
const a = "aa000000-0000-4000-8000-000000000001";
const b = "aa000000-0000-4000-8000-000000000002";
const v = "bb000000-0000-4000-8000-000000000001";
const s = "cc000000-0000-4000-8000-000000000001";
const otherSeller = "cc000000-0000-4000-8000-000000000002";
type Row = Record<string, unknown>;
const listing = (extra: Partial<CheckoutListing> = {}): CheckoutListing => ({
  id: a, slug: "l164", title: "Real product", price: 12.5, quantity: 10, unit: "kg",
  image_url: null, seller_id: s, status: "active", variants: [],
  storage_type: "chilled", category: "Maize", courier_delivery: true, express_delivery: true,
  ...extra,
});
const variant = (id = v, extra: Row = {}) => ({ id, title: "Large", price: 20, quantity: 5, ...extra });
const seller = (extra: Row = {}): Row => ({ id: s, name: "Real seller", home_locker_ids: ["brivibas"], ...extra });
const baseBody = (extra: Row = {}): Row => ({
  items: [{ id: a, listingId: a, variantId: null, quantity: 2 }],
  deliveryType: "locker", deliveryInfo: { locker_id: "brivibas" },
  contact: { name: " Fixture Buyer ", email: "BUYER@example.invalid", phone: "+37120000000" },
  ...extra,
});
const request = (body: unknown, headers: Record<string, string> = {}) => new Request(`${origin}/checkout`, {
  method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body),
});
const service = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
let backend: (url: URL, init: RequestInit) => Response | Promise<Response>;
let originalFetch: typeof fetch;
let forbidden: string[];
let unexpected: string[];
let calls: Array<{ path: string; method: string; url: URL }>;

test.beforeEach(() => {
  forbidden = []; unexpected = []; calls = [];
  backend = () => { unexpected.push("unconfigured"); return Response.json({ code: "XX000" }, { status: 500 }); };
  originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.origin !== origin) {
      forbidden.push(url.origin);
      throw new Error("Non-example.invalid request forbidden");
    }
    calls.push({ path: url.pathname, method: init?.method ?? "GET", url });
    return backend(url, init ?? {});
  };
});
test.afterEach(() => {
  globalThis.fetch = originalFetch;
  expect(forbidden).toEqual([]);
  expect(unexpected).toEqual([]);
});

function fixture(options: {
  rows?: CheckoutListing[]; sellers?: Row[]; listingError?: boolean; sellerError?: boolean;
  count?: number; missingCount?: boolean; pageCap?: number; reverse?: boolean;
  promo?: Row | null; promoError?: boolean; redemptionError?: boolean; redeemed?: boolean;
  auth?: Row | null; insertError?: boolean; missingInsert?: boolean;
} = {}) {
  const rows = options.rows ?? [listing()];
  const sellers = options.sellers ?? [seller()];
  const saved: Row[] = [];
  const handler = (url: URL, init: RequestInit) => {
    const method = init.method ?? "GET";
    if (url.pathname === "/auth/v1/user") return options.auth
      ? Response.json(options.auth) : Response.json({ message: "Fixture invalid token" }, { status: 401 });
    if (url.pathname === "/rest/v1/listings") {
      expect(method).toBe("GET");
      expect(url.searchParams.get("status")).toBe("eq.active");
      expect(url.searchParams.get("order")).toBe("id.asc");
      expect(new Headers(init.headers).get("prefer")).toContain("count=exact");
      expect(url.searchParams.get("select")).not.toMatch(/vat_rate|delivery_mode|commission_rate/);
      if (options.listingError) return Response.json({ code: "XX000" }, { status: 503 });
      const active = rows.filter(row => row.status === "active").sort((left, right) => left.id.localeCompare(right.id));
      const offset = Number(url.searchParams.get("offset") ?? 0);
      const limit = Math.min(Number(url.searchParams.get("limit") ?? 200), options.pageCap ?? 200);
      const page = active.slice(offset, offset + limit);
      if (options.reverse) page.reverse();
      const count = options.count ?? active.length;
      return Response.json(page, {
        headers: options.missingCount ? {} : { "content-range": `${page.length ? `${offset}-${offset + page.length - 1}` : "*"}/${count}` },
      });
    }
    if (url.pathname === "/rest/v1/sellers_public") {
      expect(method).toBe("GET");
      expect(url.searchParams.get("select")).toBe("id,name,home_locker_ids");
      expect(url.searchParams.has("status")).toBe(false);
      if (options.sellerError) return Response.json({ code: "XX000" }, { status: 503 });
      const ids = url.searchParams.get("id") ?? "";
      const result = sellers.filter(seller => ids.includes(String(seller.id)));
      return Response.json(options.reverse ? [...result].reverse() : result);
    }
    if (url.pathname === "/rest/v1/promo_codes") {
      expect(method).toBe("GET");
      return options.promoError ? Response.json({ code: "XX000" }, { status: 503 }) : Response.json(options.promo ? [options.promo] : []);
    }
    if (url.pathname === "/rest/v1/promo_redemptions") {
      expect(method).toBe("GET");
      return options.redemptionError ? Response.json({ code: "XX000" }, { status: 503 }) : Response.json(options.redeemed ? [{ id: "used" }] : []);
    }
    if (url.pathname === "/rest/v1/orders") {
      if (method === "POST") {
        if (options.insertError) return Response.json({ code: "XX000" }, { status: 503 });
        if (options.missingInsert) return Response.json(null);
        const order = JSON.parse(String(init.body));
        saved.push({ id: "fixture-order", ...order });
        return Response.json({ id: "fixture-order", order_number: order.order_number }, { status: 201 });
      }
      if (method === "GET") return Response.json(saved[0] ?? null);
    }
    unexpected.push(`${method} ${url.pathname}`);
    return Response.json({ code: "UNEXPECTED" }, { status: 500 });
  };
  backend = handler;
  return { saved, handler, rows, sellers };
}
async function quoted(body: Row = baseBody(), headers: Record<string, string> = {}): Promise<CheckoutQuote> {
  const response = await quoteApi(request(body, headers));
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  const result = await response.json() as CheckoutQuoteResponse;
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("Missing quote");
  return result.quote;
}
const expectedBody = (body: Row, quote: CheckoutQuote) => ({
  ...body, expectedTotalCents: quote.totalCents, quoteFingerprint: quote.fingerprint,
});
const mutations = () => calls.filter(call => call.method !== "GET");

test("quote API and central pipeline return the identical canonical contract", async () => {
  fixture();
  expect(parseItemReferences(baseBody().items)).toHaveLength(1);
  const api = await quoted();
  expect(await buildCheckoutQuote(service(), baseBody(), null)).toEqual(api);
  expect(mutations()).toEqual([]);
});

for (const body of [null, [], 1, "text", {}, { items: "not-array" }, { items: [] }]) {
  test(`malformed quote body ${JSON.stringify(body)} is400 without writes`, async () => {
    fixture();
    expect((await quoteApi(request(body))).status).toBe(400);
    expect(calls).toEqual([]);
  });
}
for (const quantity of [0, -1, 0.5, 1000, Number.MAX_SAFE_INTEGER, "2", null]) {
  test(`quantity ${quantity} fails before product lookup`, async () => {
    fixture();
    const body = baseBody({ items: [{ id: a, quantity }] });
    expect((await quoteApi(request(body))).status).toBe(400);
    expect(calls).toEqual([]);
  });
}
test("oversized or malformed JSON bodies are bounded before any backend access", async () => {
  fixture();
  const invalidJson = new Request(`${origin}/quote`, { method: "POST", body: "{" });
  expect((await quoteApi(invalidJson)).status).toBe(400);
  expect((await quoteApi(request({ big: "x".repeat(65536) }))).status).toBe(413);
  expect((await quoteApi(request(baseBody(), { "content-length": "100000" }))).status).toBe(413);
  expect(calls).toEqual([]);
});
test("unknown delivery method/scalar delivery info/too many lines are400 before lookup", async () => {
  fixture();
  for (const extra of [
    { deliveryType: "teleport" }, { deliveryType: null }, { deliveryInfo: null }, { deliveryInfo: [] }, { locker: "brivibas" },
    { items: Array.from({ length: 101 }, () => ({ id: a, quantity: 1 })) },
    { promoCode: { code: "BAD" } }, { deliveryType: "courier", deliveryInfo: { postal_code: {} } },
  ]) expect((await quoteApi(request(baseBody(extra)))).status).toBe(400);
  expect(calls).toEqual([]);
});

for (const id of [a, "l164"]) {
  test(`real base ID/DB slug alias ${id} resolves with no client metadata authority`, () => {
    const result = normalizeCheckoutItems([{ id, quantity: 2 }], [listing()]);
    expect(result[0]).toMatchObject({ id: a, listingId: a, variantId: null, unitCents: 1250, quantity: 2, sellerId: s });
  });
}
for (const id of [v, canonicalCartId(a, v), canonicalCartId("l164", v), a, "l164"]) {
  test(`unique legacy variant alias ${id} resolves declared DB variant`, () => {
    const result = normalizeCheckoutItems([{ id, quantity: 1 }], [listing({ variants: [variant()] })]);
    expect(result[0]).toMatchObject({ id: canonicalCartId(a, v), listingId: a, variantId: v, price: 20 });
  });
}
test("repeated v1 across real listings is ambiguous despite forged seller/title/price", async () => {
  fixture({ rows: [listing({ variants: [variant("v1")] }), listing({ id: b, variants: [variant("v1")], seller_id: otherSeller })] });
  const response = await quoteApi(request(baseBody({ items: [{ id: "v1", quantity: 1, sellerId: s, title: "Real product", price: 20 }] })));
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({ ok: false, issues: [{ id: "v1", code: "AMBIGUOUS_ITEM" }] });
  expect(mutations()).toEqual([]);
});
test("a bare UUID colliding with a listing and another listing's variant never guesses", () => {
  expect(() => normalizeCheckoutItems([{ id: b, quantity: 1 }], [
    listing({ variants: [variant(b)] }), listing({ id: b }),
  ])).toThrow(CheckoutError);
});
test("multiple variants require explicit choice, one variant plain legacy remains supported", () => {
  const rows = [listing({ variants: [variant("v1"), variant("v2")] })];
  expect(() => normalizeCheckoutItems([{ id: a, quantity: 1 }], rows)).toThrow();
  expect(normalizeCheckoutItems([{ id: canonicalCartId(a, "v2"), listingId: a, variantId: "v2", quantity: 1 }], rows)[0].variantId).toBe("v2");
});
for (const extra of [
  { id: canonicalCartId(a, v), listingId: b, variantId: v }, { id: a, listingId: a, variantId: v },
  { id: canonicalCartId(a, "unknown"), listingId: a, variantId: "unknown" }, { id: a, variantId: v },
  { id: v, listingId: a }, { id: canonicalCartId(a, "forged") },
]) {
  test(`explicit/forged identity ${JSON.stringify(extra)} cannot bypass declared membership`, async () => {
    fixture({ rows: [listing({ variants: [variant()] })] });
    const response = await quoteApi(request(baseBody({ items: [{ ...extra, quantity: 1 }] })));
    expect([400, 409]).toContain(response.status);
    expect(mutations()).toEqual([]);
  });
}
for (const variants of [
  [{ title: "No ID", price: 1, quantity: 1 }], [variant("v1"), variant("v1")],
  [variant(v, { price: null })], [variant(v, { quantity: null })], [variant(v, { price: -1 })],
  [variant(v, { quantity: 1.5 })], { bad: true },
]) {
  test(`malformed variant data ${JSON.stringify(variants)} fails closed`, () => {
    expect(() => normalizeCheckoutItems([{ id: a, quantity: 1 }], [listing({ variants })])).toThrow();
  });
}
test("duplicate aliases aggregate into one SKU and cannot evade the stock or max quantity bound", () => {
  const rows = [listing({ variants: [variant(v, { quantity: 3 })] })];
  expect(normalizeCheckoutItems([{ id: v, quantity: 1 }, { id: canonicalCartId(a, v), quantity: 2 }], rows)[0].quantity).toBe(3);
  expect(() => normalizeCheckoutItems([{ id: v, quantity: 2 }, { id: a, quantity: 2 }], rows)).toThrow();
  expect(() => normalizeCheckoutItems([{ id: a, quantity: 600 }, { id: "l164", quantity: 600 }], [listing({ quantity: 2000 })])).toThrow();
});
test("two explicit variants remain separate canonical lines with real listing IDs in snapshots", () => {
  const items = normalizeCheckoutItems([
    { id: canonicalCartId(a, "v1"), listingId: a, variantId: "v1", quantity: 1 },
    { id: canonicalCartId(a, "v2"), listingId: a, variantId: "v2", quantity: 1 },
  ], [listing({ variants: [variant("v1"), variant("v2")] })]);
  expect(new Set(items.map(item => item.id)).size).toBe(2);
  for (const item of items) expect(orderItemSnapshot(item)).toMatchObject({ id: a, listing_id: a, variant_id: item.variantId, cart_item_id: item.id });
  expect(readFileSync(resolve(app, "app/cart/success/page.tsx"), "utf8")).toContain('it.cart_item_id ?? `${it.id ?? "item"}-${idx}`');
});
for (const price of [0, -1, NaN, Infinity, 1.005, "12.50", Number.MAX_SAFE_INTEGER]) {
  test(`malformed/unsafe DB price ${price} is not silently coerced`, () => expect(() => priceCents(price)).toThrow());
}
for (const options of [
  { listingError: true }, { missingCount: true }, { count: 2 }, { count: 5001 }, { pageCap: 1, rows: [listing(), listing({ id: b })] },
  { sellerError: true },
]) {
  test(`lookup/completeness failure ${JSON.stringify(options)} returns503 and never writes`, async () => {
    fixture(options);
    expect((await quoteApi(request(baseBody()))).status).toBe(503);
    expect(mutations()).toEqual([]);
  });
}
test("full counted pagination detects ambiguity on later pages rather than assuming first-page uniqueness", async () => {
  const rows = Array.from({ length: 201 }, (_, index) => listing({
    id: `ab000000-0000-4000-8000-${String(index).padStart(12, "0")}`, slug: `product-${index}`,
    variants: index === 0 || index === 200 ? [variant("v1")] : [],
  }));
  fixture({ rows });
  const loaded = await loadCheckoutListings(service());
  expect(loaded).toHaveLength(201);
  expect(calls.filter(call => call.path === "/rest/v1/listings")).toHaveLength(2);
  expect(() => normalizeCheckoutItems([{ id: "v1", quantity: 1 }], loaded)).toThrow();
});

test("quote is strictly read-only, derives real metadata, and ignores fee/audience/internal forgeries", async () => {
  fixture();
  const quote = await quoted(baseBody({
    items: [{ id: a, quantity: 2, title: "Fake", price: 0.01, sellerId: "intruder", storageType: "frozen", drop_id: "drop" }],
    totalCents: 1, sellerIds: ["intruder"], deliveryFeeCents: -999,
    deliveryInfo: { locker_id: "brivibas", locker_name: "Fake", delivery_fee_cents: -999, paid_at: "forged" },
  }));
  expect(quote).toMatchObject({
    available: true, subtotalCents: 2500, deliveryFeeCents: 300, totalCents: 2800,
    sellerIds: [s], items: [{ title: "Real product", sellerId: s, storageType: "chilled" }],
    deliveryInfo: { locker_id: "brivibas", locker_name: "Brīvības iela 253" },
  });
  expect(quote.deliveryInfo).not.toHaveProperty("paid_at");
  expect(mutations()).toEqual([]);
});
test("fingerprint is stable under request/DB/seller reorder and changes with authoritative facts", async () => {
  const rows = [listing(), listing({ id: b, slug: "second", seller_id: otherSeller })];
  const sellers = [seller(), seller({ id: otherSeller, name: "Second", home_locker_ids: ["ikskile", "salaspils"] })];
  fixture({ rows, sellers });
  const body = baseBody({ items: [{ id: a, quantity: 1 }, { id: b, quantity: 1 }] });
  const first = await quoted(body);
  fixture({ rows: [...rows].reverse(), sellers: [...sellers].reverse(), reverse: true });
  const second = await quoted({ ...body, items: [{ id: b, quantity: 1 }, { id: a, quantity: 1 }] });
  expect(first.fingerprint).toBe(second.fingerprint);
  fixture({ rows: [listing({ price: 13 }), rows[1]], sellers });
  expect((await quoted(body)).fingerprint).not.toBe(first.fingerprint);
});
for (const extra of [
  { deliveryInfo: {} }, { deliveryInfo: { locker_id: "tukums" } }, { deliveryInfo: { locker_id: "saga" } },
  { deliveryInfo: { locker_id: "unknown" } }, { deliveryType: "courier", deliveryInfo: {} },
  { deliveryType: "courier", deliveryInfo: { postal_code: "LV-9999" } },
  { deliveryType: "express", deliveryInfo: { postal_code: "LV-2105" } },
]) {
  test(`unpriceable selection ${JSON.stringify(extra)} returns null fees/totals, never free shipping`, async () => {
    fixture();
    const body = baseBody(extra);
    const quote = await quoted(body);
    expect(quote).toMatchObject({ available: false, delivery: { ok: false }, deliveryFeeCents: null, preDiscountTotalCents: null, totalCents: null });
    const closed = "locker_id" in extra.deliveryInfo && extra.deliveryInfo.locker_id === "tukums";
    expect((await checkout(request({ ...body, totalCents: 2500 }))).status).toBe(closed ? 400 : 409);
    expect(mutations()).toEqual([]);
  });
}
test("valid postcode can preview fees without address/contact; final submit still needs complete address", async () => {
  fixture();
  const body = baseBody({ contact: undefined, deliveryType: "courier", deliveryInfo: { postal_code: "LV-1002" } });
  const quote = await quoted(body);
  expect(quote.available).toBe(true);
  expect((await checkout(request(expectedBody(body, quote)))).status).toBe(400);
  expect((await checkout(request(expectedBody({ ...body, contact: baseBody().contact }, quote)))).status).toBe(400);
  expect(mutations()).toEqual([]);
});
test("all item delivery flags are required; missing legacy flags cannot permit courier/express", async () => {
  for (const deliveryType of ["courier", "express"]) {
    fixture({ rows: [listing(), listing({ id: b, slug: "second", courier_delivery: false, express_delivery: false })] });
    const quote = await quoted(baseBody({
      items: [{ id: a, quantity: 1 }, { id: b, quantity: 1 }],
      deliveryType, deliveryInfo: { postal_code: "LV-1002" },
    }));
    expect(quote.available).toBe(false);
  }
});
test("flat locker fee is once per real seller even dual temperature; two sellers pay two shipments", async () => {
  const rows = [listing(), listing({ id: b, slug: "second", storage_type: "frozen" })];
  fixture({ rows });
  const body = baseBody({ items: [{ id: a, quantity: 1 }, { id: b, quantity: 1 }] });
  expect(await quoted(body)).toMatchObject({ deliveryFeeCents: 300, delivery: { breakdown: [{ temperature: "dual" }] } });
  fixture({ rows: [rows[0], { ...rows[1], seller_id: otherSeller }], sellers: [seller(), seller({ id: otherSeller })] });
  expect((await quoted(body)).deliveryFeeCents).toBe(600);
});
test("pickup-only destination requires every real seller permission and recipient metadata is canonical", async () => {
  fixture({ rows: [listing(), listing({ id: b, slug: "second", seller_id: otherSeller })], sellers: [
    seller({ home_locker_ids: ["dundaga"] }), seller({ id: otherSeller, home_locker_ids: ["brivibas"] }),
  ] });
  expect((await quoted(baseBody({ items: [{ id: a, quantity: 1 }, { id: b, quantity: 1 }], deliveryInfo: { locker_id: "dundaga" } }))).available).toBe(false);
});
test("courier charge depends on published destination only, never changed sender home lockers", async () => {
  const body = baseBody({ deliveryType: "courier", deliveryInfo: { postal_code: "LV-1002" } });
  fixture({ sellers: [seller({ home_locker_ids: ["sigulda"] })] });
  const first = await quoted(body);
  fixture({ sellers: [seller({ home_locker_ids: ["brivibas"] })] });
  const second = await quoted(body);
  expect(first.deliveryFeeCents).toBe(second.deliveryFeeCents);
  const direct = calculateDeliveryQuote({
    method: "courier", buyerPostalCode: "LV-1002",
    sellers: [{ sellerId: s, homeLockerIds: [], items: [{ category: "Maize", storageType: "chilled", courierDelivery: true }] }],
  });
  expect(direct.ok && direct.totalCents).toBe(first.deliveryFeeCents);
});
for (const deliveryType of ["locker", "courier", "express"]) {
  test(`final ${deliveryType} checkout persists the same normalized delivery quote and ignores supplied fees/zones`, async () => {
    const db = fixture();
    const body = baseBody({
      deliveryType,
      deliveryInfo: deliveryType === "locker"
        ? { locker_id: "brivibas", locker_city: "Fake", delivery_fee_cents: -999 }
        : { postal_code: "LV-1002", address: " Fixture street ", city: " Rīga ", zone: 3, delivery_fee_cents: -999, paid_at: "forged" },
      deliveryFeeCents: -999, deliveryFeesBySeller: [{ sellerId: "intruder", feeCents: -999 }],
    });
    const quote = await quoted(body);
    expect(quote.available).toBe(true);
    expect((await checkout(request(expectedBody(body, quote)))).status).toBe(200);
    expect(db.saved[0]).toMatchObject({
      total_cents: quote.totalCents,
      delivery_info: { ...quote.deliveryInfo, delivery_fee_cents: quote.deliveryFeeCents, zone_policy: "published-destination-postcode-v1" },
    });
    expect(db.saved[0].delivery_info).not.toHaveProperty("paid_at");
    expect((db.saved[0].delivery_info as Row).delivery_fees_by_seller).toEqual([
      { ...quote.delivery.breakdown[0], sellerName: "Real seller", feeCents: quote.deliveryFeeCents },
    ]);
  });
}
test("missing sellers or missing delivery flags never become free/authorized shipping", async () => {
  fixture({ sellers: [] });
  expect((await quoteApi(request(baseBody()))).status).toBe(409);
  fixture({ rows: [listing({ courier_delivery: undefined, express_delivery: undefined })] });
  for (const deliveryType of ["courier", "express"]) {
    expect((await quoted(baseBody({ deliveryType, deliveryInfo: { postal_code: "LV-1002" } }))).available).toBe(false);
  }
  expect(mutations()).toEqual([]);
});
test("duplicate catalog IDs or changing counts across pages fail503 before any write", async () => {
  fixture({ rows: [listing(), listing()] });
  expect((await quoteApi(request(baseBody()))).status).toBe(503);
  const rows = Array.from({ length: 201 }, (_, index) => listing({
    id: `ab000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
  }));
  const initial = fixture({ rows }).handler;
  const changed = fixture({ rows, count: 202 }).handler;
  backend = (url, init) => Number(url.searchParams.get("offset") ?? 0) > 0 ? changed(url, init) : initial(url, init);
  expect((await quoteApi(request(baseBody()))).status).toBe(503);
  expect(mutations()).toEqual([]);
});

const promo = (extra: Row = {}): Row => ({
  id: "promo", code: "SAVE", type: "free_delivery", discount_cents: 0,
  discount_percent: 0, max_uses: 0, used_count: 0, expires_at: null, ...extra,
});
for (const [type, fields, discount] of [
  ["free_delivery", {}, 300], ["fixed", { discount_cents: 1000 }, 1000], ["percent", { discount_percent: 50 }, 150],
] as Array<[string, Row, number]>) {
  test(`promo ${type} uses authoritative fee exactly once without any quote writes`, async () => {
    const db = fixture({ promo: promo({ type, ...fields }) });
    const body = baseBody({ promoCode: " save ", deliveryFeeCents: 999999 });
    const quote = await quoted(body);
    expect(quote).toMatchObject({ discountCents: discount, preDiscountTotalCents: 2800, totalCents: 2800 - discount });
    expect(mutations()).toEqual([]);
    const legacy = await checkout(request({ ...body, totalCents: 2800 }));
    expect(legacy.status).toBe(409);
    expect(await legacy.json()).toMatchObject({ code: "quote_confirmation_required", quote: { totalCents: 2800 - discount } });
    expect(db.saved).toEqual([]);
    expect((await checkout(request(expectedBody(body, quote)))).status).toBe(200);
    expect(db.saved[0]).toMatchObject({ total_cents: 2800 - discount, promo_discount_cents: discount, promo_code: "SAVE" });
  });
}
for (const options of [{ promoError: true }, { redemptionError: true, auth: { id: "buyer" } }]) {
  test(`strict promo read failure ${JSON.stringify(options)} returns503, no inserts/redemptions`, async () => {
    fixture({ promo: promo(), ...options });
    expect((await quoteApi(request(baseBody({ promoCode: "SAVE" }), options.auth ? { authorization: "Bearer fixture" } : {}))).status).toBe(503);
    expect(mutations()).toEqual([]);
  });
}
test("legacy promo helper default read-error behavior remains backward-compatible; new strict option rejects", async () => {
  fixture({ promoError: true });
  expect((await validatePromoCode("SAVE", null, 300)).valid).toBe(false);
  await expect(validatePromoCode("SAVE", null, 300, "locker", { supabase: service(), strictReadErrors: true })).rejects.toThrow();
});
test("disabled PIRMAIS never queries promo storage and expired/used/invalid promos do not discount", async () => {
  fixture({ promo: promo() });
  expect((await quoted(baseBody({ promoCode: " pirmais " }))).discountCents).toBe(0);
  expect(calls.some(call => call.path.includes("promo_"))).toBe(false);
  fixture({ promo: promo({ expires_at: "2020-01-01" }) });
  expect((await quoted(baseBody({ promoCode: "SAVE" }))).promo.valid).toBe(false);
  fixture({ promo: promo(), redeemed: true, auth: { id: "buyer" } });
  expect((await quoted(baseBody({ promoCode: "SAVE" }), { authorization: "Bearer fixture" })).promo.valid).toBe(false);
});
test("legacy expired/missing/disabled promos require409 review with zero orders; informed fingerprint confirmation can proceed", async () => {
  for (const [promoCode, configured] of [["SAVE", promo({ expires_at: "2020-01-01" })], ["SAVE", null], ["PIRMAIS", promo()]] as Array<[string, Row | null]>) {
    const db = fixture({ promo: configured });
    const body = baseBody({ promoCode, totalCents: 2800 });
    const quote = await quoted(body);
    const response = await checkout(request(body));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "quote_confirmation_required", quote: { totalCents: 2800, discountCents: 0 } });
    expect(db.saved).toEqual([]);
    expect((await checkout(request(expectedBody(body, quote)))).status).toBe(200);
  }
});
test("promo cannot create a negative/free payment flow; malformed configuration fails503", async () => {
  const db = fixture({ promo: promo({ type: "fixed", discount_cents: 99999 }) });
  const body = baseBody({ promoCode: "SAVE" });
  const quote = await quoted(body);
  expect(quote).toMatchObject({ discountCents: 2800, totalCents: 0 });
  expect((await checkout(request(expectedBody(body, quote)))).status).toBe(400);
  expect(db.saved).toEqual([]);
  fixture({ promo: promo({ type: "fixed", discount_cents: -1 }) });
  expect((await quoteApi(request(body))).status).toBe(503);
});

test("guest quote-to-checkout persists only canonical whitelisted snapshot and keeps read/retry capability", async () => {
  const db = fixture({ rows: [listing({ variants: [variant()] })] });
  const body = baseBody({ items: [{
    id: canonicalCartId(a, v), listingId: a, variantId: v, quantity: 2,
    seller_id: "intruder", sellerId: "intruder", title: "Fake", storageType: "frozen",
    drop_id: "injected-drop", reservation_id: "injected", paid_at: "fake", vat_rate: 0, commission_rate: 0,
  }], sellerIds: ["intruder"], deliveryFeeCents: -999 });
  const quote = await quoted(body);
  const response = await checkout(request(expectedBody(body, quote), { host: "evil.example.invalid", "x-forwarded-proto": "http" }));
  expect(response.status).toBe(200);
  const result = await response.json();
  expect(result.orderId).toMatch(/^TRG-\d{8}-[a-f0-9]{24}$/);
  expect(result.paymentUrl).toContain(`${origin}/cart/success?`);
  expect(db.saved).toHaveLength(1);
  const order = db.saved[0];
  expect(order).toMatchObject({
    seller_ids: [s], total_cents: 4300, status: "pending", payment_status: "awaiting",
    items: [{ id: a, listing_id: a, variant_id: v, cart_item_id: canonicalCartId(a, v), title: "Real product — Large", price: 20, seller_id: s, commission_rate: 15 }],
  });
  for (const field of ["drop_id", "reservation_id", "paid_at", "vat_rate"]) expect((order.items as Row[])[0]).not.toHaveProperty(field);
  const cookie = response.headers.get("set-cookie")!.split(";")[0];
  const access = new Request(`${origin}/order`, { headers: { cookie } });
  expect(hasOrderCapability(access, result.orderId)).toBe(true);
  expect((await orderRead(access, { params: Promise.resolve({ orderNumber: result.orderId }) })).status).toBe(200);
  expect((await retry(new Request(`${origin}/retry`, { method: "POST", headers: { cookie }, body: JSON.stringify({ orderNumber: result.orderId }) }))).status).toBe(200);
});
for (const mode of ["new-total", "new-fingerprint", "legacy-total", "legacy-unit-price"]) {
  test(`stale/tampered ${mode} is409 with replacement quote before any insert`, async () => {
    const db = fixture();
    const body = baseBody();
    const quote = await quoted(body);
    const requestBody = mode.startsWith("new") ? expectedBody(body, quote) as Row : { ...body, totalCents: 2800 };
    if (mode === "new-total") requestBody.expectedTotalCents = 1;
    if (mode === "new-fingerprint") requestBody.quoteFingerprint = "0".repeat(64);
    if (mode === "legacy-total") requestBody.totalCents = 1;
    if (mode === "legacy-unit-price") requestBody.items = [{ id: a, quantity: 2, price: 0.01 }];
    const response = await checkout(request(requestBody));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "QUOTE_CHANGED", quote: { totalCents: 2800 } });
    expect(db.saved).toEqual([]);
  });
}
test("price/address/promo changes between quote and submit require explicit reconfirmation", async () => {
  fixture({ promo: promo() });
  const body = baseBody({ promoCode: "SAVE" });
  const first = await quoted(body);
  for (const changed of [
    { options: { rows: [listing({ price: 13 })], promo: promo() }, body },
    { options: { promo: null }, body },
    { options: { promo: promo() }, body: { ...body, deliveryType: "courier", deliveryInfo: { postal_code: "LV-1002", address: "Street", city: "Rīga" } } },
  ]) {
    const db = fixture(changed.options);
    expect((await checkout(request(expectedBody(changed.body, first)))).status).toBe(409);
    expect(db.saved).toEqual([]);
  }
});
for (const auth of ["", "fixture", "Basic bad", "Bearer invalid"]) {
  test(`provided invalid auth '${auth}' is401 while guest requires no auth`, async () => {
    fixture();
    expect((await quoteApi(request(baseBody(), { authorization: auth }))).status).toBe(401);
    expect((await checkout(request({ ...baseBody(), totalCents: 2800 }, { authorization: auth }))).status).toBe(401);
    expect(mutations()).toEqual([]);
  });
}
test("verified buyer ID comes from auth.getUser, not buyer-supplied identity", async () => {
  const db = fixture({ auth: { id: "real-buyer" } });
  const body = baseBody({ buyerId: "intruder", totalCents: 2800 });
  expect((await checkout(request(body, { authorization: "Bearer fixture" }))).status).toBe(200);
  expect(db.saved[0].buyer_id).toBe("real-buyer");
});
test("bad contact or incomplete expectations never insert", async () => {
  const db = fixture();
  for (const extra of [
    { contact: null }, { contact: { name: "Buyer", email: "not-email", phone: "123" } },
    { contact: { name: "Bad\nName", email: "buyer@example.invalid", phone: "123" } },
    {}, { expectedTotalCents: 2800 }, { quoteFingerprint: "0".repeat(64) },
  ]) {
    const response = await checkout(request(baseBody(extra)));
    expect(response.status).toBe(400);
  }
  expect(db.saved).toEqual([]);
});
test("payment configuration is validated before insert; insert errors return503 and never grant access", async () => {
  const previous = process.env.PAYSERA_MODE;
  const db = fixture();
  try {
    process.env.PAYSERA_MODE = "invalid";
    expect((await checkout(request({ ...baseBody(), totalCents: 2800 }))).status).toBe(503);
    expect(db.saved).toEqual([]);
  } finally { process.env.PAYSERA_MODE = previous; }
  fixture({ insertError: true });
  const response = await checkout(request({ ...baseBody(), totalCents: 2800 }));
  expect(response.status).toBe(503);
  expect(response.headers.get("set-cookie")).toBeNull();
});
test("unchanged phase2 protocol/access and promo redemption contracts remain byte-compatible", () => {
  const original = (file: string) => execFileSync("git", ["show", `${contractBase}:apps/tirgus/${file}`], { cwd: app, encoding: "utf8" });
  // Callback/retry now have explicit default-off lifecycle branches, covered by
  // signed API regressions; the protocol and access primitive files stay frozen.
  for (const file of ["lib/paysera.ts", "lib/order-access.ts",
    "app/api/checkout/confirm-arrival/route.ts",
    "lib/checkout-contract.ts", "lib/cart-identity.ts"]) expect(readFileSync(resolve(app, file), "utf8"), file).toBe(original(file));
  const redemption = (text: string) => text.slice(text.indexOf("export async function redeemPromoCode"));
  expect(redemption(readFileSync(resolve(app, "lib/promo.ts"), "utf8"))).toBe(redemption(original("lib/promo.ts")));
});
