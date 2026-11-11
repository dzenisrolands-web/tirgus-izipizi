import { test, expect } from "@playwright/test";
import React, { isValidElement, type ReactElement, type ReactNode } from "react";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { hooks } from "./hook-harness";
import { CartProvider, useCart } from "../../lib/cart-context";
import { BuyerAddressProvider } from "../../lib/buyer-address-context";
import { cartIdentity, canonicalCartId } from "../../lib/cart-identity";
import { cartReferences, hydrateCart, parseCart, type CartItem } from "../../lib/cart-state";
import { currentQuote, payableQuote, QUOTE_MAX_AGE_MS, QUOTE_DEBOUNCE_MS, useCheckoutQuote } from "../../lib/use-checkout-quote";
import type { CanonicalCartItem, CheckoutQuote, CheckoutQuoteRequest } from "../../lib/checkout-contract";
import { calculateDeliveryQuote } from "../../lib/delivery-policy";
import { supabase } from "../../lib/supabase";
import { ListingCard } from "../../components/listing-card";
import { VariantSelector } from "../../components/variant-selector";
import { RecipeAddToCart } from "../../components/recipe-add-to-cart";
import { CartPage } from "../../components/cart-page";
import { listings, type Listing } from "../../lib/mock-data";

const origin = "https://example.invalid";
const jsxRuntime = createRequire(__filename)("playwright/jsx-runtime");
const originalJsx = { ...jsxRuntime };
const originalFetch = globalThis.fetch;
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const originalSession = supabase.auth.getSession;
const disposers: (() => void)[] = [];
let storage: Map<string, string>;
let writes: string[];
let blocked: string[];
let requests: { url: URL; init: RequestInit }[];
let backend: (url: URL, init: RequestInit) => Response | Promise<Response>;
let writeBlocked = false;
const source = (file: string) => readFileSync(resolve(__dirname, "../..", file), "utf8");

test.beforeAll(async () => { Object.assign(jsxRuntime, await import("react/jsx-runtime")); });
test.afterAll(() => { Object.assign(jsxRuntime, originalJsx); });
test.beforeEach(() => {
  storage = new Map(); writes = []; blocked = []; requests = []; writeBlocked = false;
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (writeBlocked) throw new Error("storage denied");
      storage.set(key, value);
      if (key === "cart") writes.push(value);
    },
    removeItem: (key: string) => storage.delete(key),
  } });
  supabase.auth.getSession = async () => ({ data: { session: null }, error: null });
  backend = (url, init) => {
    if (url.pathname.startsWith("/rest/") && (init.method ?? "GET") === "GET") return Response.json([]);
    if (url.pathname === "/api/best-sellers") return Response.json({});
    throw new Error(`Unexpected dummy request: ${url.pathname}`);
  };
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(input instanceof Request ? input.url : String(input), origin);
    if (url.origin !== origin) { blocked.push(url.origin); throw new Error("Only example.invalid is permitted"); }
    requests.push({ url, init });
    return backend(url, init);
  };
});
test.afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose();
  globalThis.fetch = originalFetch;
  supabase.auth.getSession = originalSession;
  if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage);
  else Reflect.deleteProperty(globalThis, "localStorage");
  if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
  else Reflect.deleteProperty(globalThis, "window");
  expect(blocked).toEqual([]);
});

function run<T>(component: () => T, contexts?: Map<unknown, unknown>) {
  const runner = hooks(component, contexts); disposers.push(runner.dispose); return runner;
}
function item(overrides: Partial<CartItem> = {}): CartItem {
  return { ...cartIdentity("listing-a", "v1"), title: "Saved title", price: 2, unit: "gab.", image: "/images/product-placeholder.svg",
    sellerName: "Saved seller", sellerId: "untrusted", quantity: 1, storageType: "chilled", ...overrides };
}
function canonical(overrides: Partial<CanonicalCartItem> = {}): CanonicalCartItem {
  return { ...item(), listingId: "listing-a", variantId: "v1", title: "Canonical title", price: 4, unitCents: 400,
    availableQuantity: 20, sellerId: "seller-a", sellerName: "Canonical seller", category: "Maize",
    courier_delivery: true, express_delivery: false, ...overrides };
}
function quoted(request: CheckoutQuoteRequest, overrides: Partial<CheckoutQuote> = {}): CheckoutQuote {
  const items = request.items.map(reference => canonical({ ...reference, listingId: reference.listingId ?? "listing-a", variantId: reference.variantId ?? "v1" }));
  const sellers = [...new Set(items.map(item => item.sellerId))].map(id => ({ id, name: "Canonical seller", homeLockerIds: ["dundaga"] }));
  const method = request.deliveryType ?? "locker";
  const delivery = calculateDeliveryQuote({
    method, lockerId: String(request.deliveryInfo?.locker_id ?? ""), buyerPostalCode: String(request.deliveryInfo?.postal_code ?? ""),
    sellers: sellers.map(seller => ({ sellerId: seller.id, homeLockerIds: seller.homeLockerIds, items: items.filter(item => item.sellerId === seller.id).map(item => ({
      category: item.category, storageType: item.storageType, courierDelivery: item.courier_delivery, expressDelivery: item.express_delivery,
    })) })),
  });
  const subtotalCents = items.reduce((sum, item) => sum + item.unitCents * item.quantity, 0);
  const discountCents = request.promoCode === "PIRMAIS" && delivery.ok && method === "locker" ? delivery.totalCents : 0;
  return { version: "dummy-v1", fingerprint: JSON.stringify(request), available: delivery.ok,
    items, sellers, sellerIds: sellers.map(seller => seller.id), deliveryType: method, deliveryInfo: request.deliveryInfo ?? {},
    delivery, subtotalCents, deliveryFeeCents: delivery.totalCents, discountCents,
    preDiscountTotalCents: delivery.ok ? subtotalCents + delivery.totalCents : null,
    totalCents: delivery.ok ? subtotalCents + delivery.totalCents - discountCents : null,
    promo: { valid: discountCents > 0, discountCents }, ...overrides };
}
const request = (): CheckoutQuoteRequest => ({ items: cartReferences([item()]), deliveryType: "locker", deliveryInfo: { locker_id: "brivibas" } });
function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<Record<string, unknown>>(node)) return [];
  return [node, ...elements(node.props.children as ReactNode)];
}
function text(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(text).join("");
  return isValidElement<{ children?: ReactNode }>(node) ? text(node.props.children) : "";
}
function button(node: ReactNode, label: string) {
  const found = elements(node).find(element => element.type === "button" && text(element).includes(label));
  expect(found, `button ${label}`).toBeTruthy(); return found!;
}
function click(node: ReactNode, label: string) {
  const control = button(node, label);
  expect(control.props.disabled).not.toBe(true);
  return (control.props.onClick as (event: unknown) => unknown)({ preventDefault() {}, stopPropagation() {} });
}
async function settle<T>(runner: { flush: () => Promise<T> }) {
  await new Promise(resolve => setTimeout(resolve, QUOTE_DEBOUNCE_MS + 20));
  return runner.flush();
}
async function provider(saved = [item()]) {
  storage.set("cart", JSON.stringify(saved));
  const runner = run(() => CartProvider({ children: null }));
  await runner.flush();
  return runner;
}
function contextValue(runner: ReturnType<typeof hooks<ReturnType<typeof CartProvider>>>) {
  return runner.output.props.value as ReturnType<typeof useCart>;
}
function contextMap(runner: ReturnType<typeof hooks<ReturnType<typeof CartProvider>>>) {
  return new Map<unknown, unknown>([[runner.output.type, contextValue(runner)]]);
}

test("canonical identity distinguishes repeated v1/v2 and UUID variants across listings", () => {
  expect(canonicalCartId("a")).toBe("a");
  expect(cartIdentity("a", "v1")).toEqual({ id: "a-v1", listingId: "a", variantId: "v1" });
  expect(new Set(["v1", "v2", "ce61c2e9-746b-45c9-9f67-46a83eb7617d"].flatMap(variant => ["a", "b"].map(id => canonicalCartId(id, variant)))).size).toBe(6);
});
for (const raw of ["null", "{}", "\"cart\"", "[null]", "[1]", "garbage"]) {
  test(`invalid cart container is rejected without silently returning empty: ${raw}`, () => expect(() => parseCart(raw)).toThrow());
}
for (const changes of [{ price: Infinity }, { price: -1 }, { quantity: NaN }, { quantity: 0 }, { quantity: 1000 }, { quantity: 1.2 }, { title: 42 }, { sellerId: {} }, { express_delivery: "true" }]) {
  test(`invalid cart fields rejected: ${JSON.stringify(changes)}`, () => expect(() => parseCart(JSON.stringify([item(changes as Partial<CartItem>)]))).toThrow());
}
test("nonfinite and overflow totals and duplicate stored keys are blocked", () => {
  expect(() => parseCart(JSON.stringify([item({ price: Number.MAX_VALUE })]))).toThrow();
  expect(() => parseCart(JSON.stringify([item(), item()]))).toThrow();
});
test("legacy raw references survive parsing, without metadata-based identity guesses", () => {
  const legacy = item({ id: "v1", listingId: undefined, variantId: undefined });
  expect(cartReferences(parseCart(JSON.stringify([legacy])))).toEqual([{ id: "v1", quantity: 1 }]);
  expect(hydrateCart([legacy], [canonical(), canonical({ ...cartIdentity("other", "v1") })])).toEqual([legacy]);
});
test("proven aliases combine quantities but different variants remain distinct", () => {
  const aliases = [item({ id: "v1", listingId: undefined, variantId: undefined, quantity: 2 }), item({ quantity: 3 }), item({ ...cartIdentity("listing-a", "v2"), quantity: 4 })];
  const next = [canonical({ quantity: 5 }), canonical({ ...cartIdentity("listing-a", "v2"), quantity: 4 })];
  expect(hydrateCart(aliases, next)).toEqual(next);
  expect(hydrateCart(aliases, [canonical({ quantity: 1 })])).toBe(aliases);
  expect(hydrateCart(aliases, next.slice(0, 1))).toBe(aliases);
});
test("legacy slug aliases hydrate using unique canonical server references only", () => {
  const listingId = "ce61c2e9-746b-45c9-9f67-46a83eb7617d";
  const legacy = [item({ id: "l164", listingId: undefined, variantId: undefined, quantity: 2 })];
  const next = [canonical({ ...cartIdentity(listingId), slug: "l164", quantity: 2 })];
  expect(hydrateCart(legacy, next)).toEqual(next);
  expect(hydrateCart(legacy, [{ ...next[0], slug: "different" }])).toBe(legacy);
});
test("legacy plain listing reference can recover one canonical variant but never choose between two", () => {
  const legacy = [item({ id: "listing-a", listingId: undefined, variantId: undefined, quantity: 2 })];
  expect(hydrateCart(legacy, [canonical({ quantity: 2 })])).toEqual([canonical({ quantity: 2 })]);
  const ambiguous = [canonical(), canonical({ ...cartIdentity("listing-a", "v2") })];
  expect(hydrateCart(legacy, ambiguous)).toBe(legacy);
  expect(hydrateCart(legacy, [canonical({ quantity: 1 })])).toBe(legacy);
});
test("legacy slug-variant aliases hydrate only a unique declared server variant", () => {
  const legacy = [item({ id: "old-slug-v1", listingId: undefined, variantId: undefined })];
  const next = [canonical({ slug: "old-slug" })];
  expect(hydrateCart(legacy, next)).toEqual(next);
  expect(hydrateCart(legacy, [canonical({ slug: "another-slug" })])).toBe(legacy);
});
test("omitted legacy variant identity is not rewritten as an explicit base selection", () => {
  const legacy = [item({ variantId: undefined })];
  expect(cartReferences(legacy)).toEqual([{ id: "listing-a-v1", listingId: "listing-a", quantity: 1 }]);
  expect(hydrateCart(legacy, [canonical()])).toEqual([canonical()]);
  expect(hydrateCart([item({ variantId: null })], [canonical()])[0].variantId).toBeNull();
});
test("hydration replaces only canonical metadata without changing reference signature", () => {
  const before = [item({ quantity: 3 })];
  const hydrated = hydrateCart(before, [canonical({ quantity: 3 })]);
  expect(hydrated[0].sellerId).toBe("seller-a");
  expect(hydrated[0].price).toBe(4);
  expect(cartReferences(hydrated)).toEqual(cartReferences(before));
});
test("initial hydration never persists the initial empty array over saved cart", async () => {
  const saved = JSON.stringify([item({ quantity: 3 })]);
  storage.set("cart", saved);
  const cart = run(() => CartProvider({ children: null }));
  expect(writes).toEqual([]);
  await cart.flush();
  expect(writes.length).toBeGreaterThan(0);
  expect(writes.every(value => value === saved)).toBe(true);
  expect(contextValue(cart).count).toBe(3);
});
test("malformed storage remains byte-for-byte saved until an explicit reset", async () => {
  storage.set("cart", "{broken");
  const cart = run(() => CartProvider({ children: null }));
  await cart.flush();
  expect(contextValue(cart).storageError).toContain("Dati nav dzēsti");
  expect(storage.get("cart")).toBe("{broken");
  expect(writes).toEqual([]);
  contextValue(cart).clear(); await cart.flush();
  expect(storage.get("cart")).toBe("[]");
});
test("blocked writes retain current quantities in memory and show a recoverable warning", async () => {
  const cart = await provider();
  writeBlocked = true;
  contextValue(cart).updateQty(item().id, 4); await cart.flush();
  expect(contextValue(cart).items[0].quantity).toBe(4);
  expect(contextValue(cart).storageError).toContain("nevar saglabāt");
  expect(JSON.parse(storage.get("cart")!)[0].quantity).toBe(1);
  writeBlocked = false;
  contextValue(cart).updateQty(item().id, 5); await cart.flush();
  expect(contextValue(cart).storageError).toBe("");
});
test("quantity controls are bounded and addItem accepts the selected quantity", async () => {
  const cart = await provider([]);
  contextValue(cart).addItem(item(), 4); await cart.flush();
  expect(contextValue(cart).items[0].quantity).toBe(4);
  contextValue(cart).updateQty(item().id, Infinity); await cart.flush();
  expect(contextValue(cart).items[0].quantity).toBe(4);
  contextValue(cart).addItem(item(), 998); await cart.flush();
  expect(contextValue(cart).items[0].quantity).toBe(4);
});
test("listing card and detail selector add the same SKU; listing quantity controls actually apply", async () => {
  const cart = await provider([]);
  const contexts = contextMap(cart);
  const listing: Listing = { ...listings[0], id: "listing-a", image: "/images/product-placeholder.svg", variants: [
    { id: "v1", title: "500 g", price: 4, quantity: 10 }, { id: "v2", title: "1 kg", price: 7, quantity: 10 },
  ] };
  const card = run(() => ListingCard({ listing }), contexts);
  const qtyButtons = elements(card.output).filter(element => element.type === "button" && text(element) === "");
  (qtyButtons[1].props.onClick as (event: unknown) => void)({ preventDefault() {}, stopPropagation() {} });
  await card.flush(); click(card.output, "Grozā"); await cart.flush();
  expect(contextValue(cart).items[0]).toMatchObject({ ...cartIdentity("listing-a", "v1"), quantity: 2 });
  contexts.set(cart.output.type, contextValue(cart));
  const detail = run(() => VariantSelector({ listingId: listing.id, title: listing.title, image: listing.image, sellerName: "Farm", storageType: "chilled", variants: listing.variants! }), contexts);
  click(detail.output, "Pievienot grozam"); await cart.flush();
  expect(contextValue(cart).items).toHaveLength(1);
  expect(contextValue(cart).items[0].quantity).toBe(3);
  click(card.output, "1 kg"); await card.flush(); click(card.output, "Grozā"); await cart.flush();
  expect(contextValue(cart).items.map(item => item.variantId)).toEqual(["v1", "v2"]);
});
test("recipe multi-variant products point at selection rather than unspecified cheapest/base SKU", async () => {
  const cart = await provider([]);
  const recipe = run(() => RecipeAddToCart({ product: listings[0] }), contextMap(cart));
  expect(text(recipe.output)).toContain("Izvēlēties variantu");
  expect(elements(recipe.output).some(element => element.type === "button")).toBe(false);
  expect(contextValue(cart).items).toEqual([]);
});
test("available=false/null totals are not free delivery, and quote arithmetic must be finite", () => {
  const good = quoted(request());
  expect(payableQuote(good)).toBe(true);
  expect(payableQuote({ ...good, available: false, totalCents: null, deliveryFeeCents: null })).toBe(false);
  expect(payableQuote({ ...good, totalCents: NaN })).toBe(false);
  expect(payableQuote({ ...good, totalCents: Infinity })).toBe(false);
  expect(payableQuote({ ...good, totalCents: good.totalCents! - 1 })).toBe(false);
  expect(payableQuote({ ...good, discountCents: good.preDiscountTotalCents!, totalCents: 0 })).toBe(false);
  expect(currentQuote({ signature: "a", quote: good, receivedAt: 0 }, "b", 1)).toBeUndefined();
  expect(currentQuote({ signature: "a", quote: good, receivedAt: 0 }, "a", QUOTE_MAX_AGE_MS)).toBeUndefined();
});
test("slow aborted responses cannot replace a newer quote or hydrate old quantities", async () => {
  const pending: { request: CheckoutQuoteRequest; signal: AbortSignal; resolve: (response: Response) => void }[] = [];
  backend = (_url, init) => new Promise(resolve => pending.push({ request: JSON.parse(String(init.body)), signal: init.signal!, resolve }));
  let input = request();
  const quote = run(() => useCheckoutQuote(input, true));
  await settle(quote); expect(pending).toHaveLength(1);
  input = { ...request(), items: cartReferences([item({ quantity: 2 })]) };
  quote.render();
  expect(quote.output.quote).toBeUndefined();
  await settle(quote); expect(pending[0].signal.aborted).toBe(true);
  pending[1].resolve(Response.json({ ok: true, quote: quoted(pending[1].request) }));
  await settle(quote);
  pending[0].resolve(Response.json({ ok: true, quote: quoted(pending[0].request, { fingerprint: "stale" }) }));
  await settle(quote);
  expect(quote.output.quote?.items[0].quantity).toBe(2);
  expect(quote.output.quote?.fingerprint).not.toBe("stale");
});
test("canonical display metadata hydration causes no request loop", async () => {
  const cart = await provider();
  backend = (_url, init) => Response.json({ ok: true, quote: quoted(JSON.parse(String(init.body))) });
  const quote = run(() => useCheckoutQuote({ ...request(), items: cartReferences(contextValue(cart).items) }, true));
  await settle(quote);
  contextValue(cart).hydrateItems(quote.output.quote!.items); await cart.flush();
  quote.render(); await settle(quote);
  expect(requests).toHaveLength(1);
  expect(contextValue(cart).items[0].title).toBe("Canonical title");
});
test("quote errors preserve unresolved lines and return issues rather than accepting replacement", async () => {
  const cart = await provider([item({ id: "v1", listingId: undefined, variantId: undefined })]);
  backend = () => Response.json({ ok: false, code: "ambiguous_item", error: "Izvēlies variantu atkārtoti", issues: [{ id: "v1", code: "ambiguous_item", message: "Neskaidrs variants" }], quote: quoted(request()) }, { status: 422 });
  const quote = run(() => useCheckoutQuote({ ...request(), items: cartReferences(contextValue(cart).items) }, true));
  await settle(quote);
  expect(quote.output.quote).toBeUndefined();
  expect(quote.output.state.issues?.[0].id).toBe("v1");
  expect(contextValue(cart).items[0].id).toBe("v1");
});
test("every destination and promo change invalidates prior quote synchronously", async () => {
  backend = (_url, init) => Response.json({ ok: true, quote: quoted(JSON.parse(String(init.body))) });
  let input = request();
  const quote = run(() => useCheckoutQuote(input, true));
  await settle(quote);
  for (const change of [
    { promoCode: "PIRMAIS" }, { deliveryType: "courier" as const }, { deliveryInfo: { postal_code: "1001" } },
    { deliveryInfo: { postal_code: "1001", address: "Example 2" } }, { deliveryInfo: { locker_id: "salaspils" } },
    { items: cartReferences([item({ quantity: 2 })]) },
  ]) {
    input = { ...input, ...change };
    quote.render(); expect(quote.output.quote).toBeUndefined(); await settle(quote);
  }
});
test("rapid edits coalesce into one quote and unmount cancels the pending timer", async () => {
  backend = (_url, init) => Response.json({ ok: true, quote: quoted(JSON.parse(String(init.body))) });
  let input = request();
  const quote = run(() => useCheckoutQuote(input, true));
  for (const postal_code of ["1", "10", "100", "1001"]) {
    input = { ...input, deliveryType: "courier", deliveryInfo: { postal_code } };
    quote.render();
  }
  expect(requests).toHaveLength(0);
  await settle(quote);
  expect(requests).toHaveLength(1);
  expect(JSON.parse(String(requests[0].init.body)).deliveryInfo.postal_code).toBe("1001");
  input = { ...input, deliveryInfo: { postal_code: "1002" } };
  quote.render(); quote.dispose();
  await settle(quote);
  expect(requests).toHaveLength(1);
});
test("unfinished promo draft invalidates a quote but never makes eligibility requests", async () => {
  backend = (_url, init) => Response.json({ ok: true, quote: quoted(JSON.parse(String(init.body))) });
  let draft = "";
  const quote = run(() => useCheckoutQuote(request(), !draft, draft));
  await settle(quote);
  expect(quote.output.quote).toBeTruthy();
  for (draft of ["P", "PI", "PIR"]) {
    quote.render();
    expect(quote.output.quote).toBeUndefined();
    await settle(quote);
  }
  expect(requests).toHaveLength(1);
  expect(requests[0].url.pathname).toBe("/api/checkout/quote");
});
test("cart source uses readonly quotes, canonical previews and after-discount payment contract only", () => {
  const page = source("components/cart-page.tsx");
  expect(page).toContain("calculateDeliveryQuote");
  expect(page).toContain("expectedTotalCents: current.totalCents");
  expect(page).toContain("quoteFingerprint: current.fingerprint");
  expect(page).not.toMatch(/courier_pickup_address|effectiveCourierZone|LOCKER_FEE|\/api\/promo\/validate/);
  expect(page).toContain("sellerGroups.every");
  expect(page).toContain("useState(false)");
  expect(source("components/ai-search-dialog.tsx")).not.toContain("addItem(");
});

async function cartPage(draft: Record<string, unknown> = {}, saved = [item()]) {
  const cart = await provider(saved);
  storage.set("checkout_draft", JSON.stringify({ step: "delivery", deliveryMethod: "locker", lockerId: "brivibas", form: { name: "Example Buyer", email: "buyer@example.invalid", phone: "+37120000000" }, ...draft }));
  const buyer = run(() => BuyerAddressProvider({ children: null }));
  await buyer.flush();
  const contexts = contextMap(cart);
  contexts.set(buyer.output.type, buyer.output.props.value);
  Object.defineProperty(globalThis, "window", { configurable: true, value: { scrollTo() {}, location: { origin, assign() { throw new Error("Navigation is forbidden in Node tests"); } } } });
  const page = run(() => CartPage(), contexts);
  const sync = async () => {
    await settle(page); await cart.flush();
    contexts.set(cart.output.type, contextValue(cart));
    page.render(); await page.flush();
  };
  await sync(); await sync();
  return { cart, page, sync };
}
test("full cart requires fresh quote and explicit review; 409 never auto-retries or subscribes", async () => {
  let paid = 0;
  backend = (url, init) => {
    if (url.pathname === "/api/checkout/quote") return Response.json({ ok: true, quote: quoted(JSON.parse(String(init.body))) });
    if (url.pathname === "/api/checkout/create-session") {
      paid++;
      const body = JSON.parse(String(init.body));
      expect(body.expectedTotalCents).toBe(400); // PIRMAIS discounted exactly once.
      expect(body).not.toHaveProperty("totalCents");
      expect(body.items[0]).not.toHaveProperty("price");
      return Response.json({ ok: false, code: "quote_changed", error: "Review", quote: quoted(request(), { fingerprint: "replacement", totalCents: 700 }) }, { status: 409 });
    }
    if (url.pathname === "/api/best-sellers") return Response.json({});
    expect(init.method ?? "GET").toBe("GET"); return Response.json([]);
  };
  const { page, sync } = await cartPage({ promoCode: "PIRMAIS", appliedPromoCode: "PIRMAIS" });
  const checkbox = elements(page.output).find(element => element.type === "input" && element.props.type === "checkbox")!;
  expect(checkbox.props.checked).toBe(false);
  click(page.output, "Apstiprināt"); await sync();
  await click(page.output, "Maksāt"); await sync();
  expect(paid).toBe(1);
  expect(text(page.output)).toContain("Maksājums netika atkārtots");
  expect(text(page.output)).toContain("Piegādes veids");
  expect(requests.some(call => call.url.pathname === "/api/subscribe")).toBe(false);
  expect(button(page.output, "Apstiprināt").props.disabled).not.toBe(true);
});
test("closed Tukums/future/unknown drafts reset destination and cannot confirm", async () => {
  backend = (url, init) => url.pathname === "/api/checkout/quote"
    ? Response.json({ ok: true, quote: quoted(JSON.parse(String(init.body))) })
    : Response.json(url.pathname === "/api/best-sellers" ? {} : []);
  for (const lockerId of ["tukums", "saga", "unknown"]) {
    const { page } = await cartPage({ step: "confirm", lockerId });
    expect(text(page.output)).toContain("Piegādes veids");
    expect(button(page.output, "Apstiprināt").props.disabled).toBe(true);
    expect(elements(page.output).filter(element => element.type === "input" && element.props.name === "locker" && element.props.checked)).toEqual([]);
  }
});
test("courier confirmation is disabled for an unknown destination postcode", async () => {
  backend = (url, init) => url.pathname === "/api/checkout/quote"
    ? Response.json({ ok: true, quote: quoted(JSON.parse(String(init.body))) })
    : Response.json(url.pathname === "/api/best-sellers" ? {} : []);
  const { page } = await cartPage({ deliveryMethod: "courier", postalCode: "9999", address: "Example 1", city: "Example", timeSlot: "09:00–12:00" });
  expect(text(page.output)).toContain("Nav aprēķināts");
  expect(button(page.output, "Apstiprināt").props.disabled).toBe(true);
  expect(text(page.output)).not.toContain("Eksprespiegāde");
});
test("locker preview charges dual temperatures once and pickup-only requires all canonical sellers", async () => {
  backend = (url, init) => {
    if (url.pathname !== "/api/checkout/quote") return Response.json(url.pathname === "/api/best-sellers" ? {} : []);
    const input = JSON.parse(String(init.body));
    const result = quoted(input);
    result.items[1].storageType = "frozen";
    result.sellers = [{ id: "seller-a", name: "Farm A", homeLockerIds: ["dundaga"] }];
    return Response.json({ ok: true, quote: result });
  };
  const saved = [item(), item({ ...cartIdentity("listing-b", "v2"), storageType: "chilled" })];
  const { page, cart, sync } = await cartPage({}, saved);
  expect(text(page.output)).toContain("arī diviem temperatūras režīmiem");
  const cards = elements(page.output).filter(element => typeof element.props.price === "string");
  expect(cards.find(card => card.props.method === "locker")?.props.price).toContain("3");
  expect(elements(page.output).some(element => element.type === "input" && element.props.value === "dundaga")).toBe(true);
  backend = (url, init) => {
    if (url.pathname !== "/api/checkout/quote") return Response.json([]);
    const result = quoted(JSON.parse(String(init.body)));
    result.items[1].sellerId = "seller-b";
    result.sellers.push({ id: "seller-b", name: "Farm B", homeLockerIds: ["brivibas"] });
    return Response.json({ ok: true, quote: result });
  };
  contextValue(cart).updateQty(item().id, 2); await sync(); await sync();
  expect(elements(page.output).some(element => element.type === "input" && element.props.value === "dundaga")).toBe(false);
});
test("actual cart row SSR links listing identity rather than a composite SKU key", async () => {
  const cart = await provider();
  const providerType = cart.output.type as React.ElementType;
  const html = renderToStaticMarkup(React.createElement(providerType, { value: contextValue(cart) },
    React.createElement(BuyerAddressProvider, null, React.createElement(CartPage))));
  expect(html).toContain('href="/listing/listing-a"');
  expect(html).not.toContain('href="/listing/listing-a-v1"');
});
test("SSR renders cart/provider safely without local storage or a live quote", () => {
  Reflect.deleteProperty(globalThis, "localStorage");
  const html = renderToStaticMarkup(React.createElement(CartProvider, null,
    React.createElement(BuyerAddressProvider, null, React.createElement(CartPage))));
  expect(html).toContain("Tavs grozs");
  expect(html).not.toContain("Maksāt ");
});
