import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { FIRST_ORDER_PROMO_ENABLED, isDisabledFirstOrderPromo } from "../../lib/promo-policy";
import { validatePromoCode } from "../../lib/promo";
import { publicLockers, openLockers, isClosedLockerId } from "../../lib/locker-policy";
import { lockers } from "../../lib/mock-data";
import { nearestLockersForCode, lookupPostalCode } from "../../lib/postal-zones";
import { POST as checkout } from "../../app/api/checkout/create-session/route";
import { POST as dropCheckout } from "../../app/api/checkout/drop/route";
import { POST as subscribe } from "../../app/api/locker-subscriptions/route";
import { POST as shipment } from "../../app/api/shipments/create-from-order/route";

const app = resolve(__dirname, "../..");
const source = (path: string) => readFileSync(resolve(app, path), "utf8");
const req = (path: string, body: unknown, auth = false) => new Request(`https://example.invalid${path}`, {
  method: "POST", headers: { "content-type": "application/json", ...(auth ? { authorization: "Bearer fixture" } : {}) },
  body: JSON.stringify(body),
});

async function backend(handler: (url: URL, init?: RequestInit) => Response, run: () => Promise<void>) {
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.origin !== "https://example.invalid") throw new Error("Production/network access forbidden");
    return handler(url, init);
  };
  try { await run(); } finally { globalThis.fetch = original; }
}

test("only the disabled first-order promo is rejected before backend access", async () => {
  expect(FIRST_ORDER_PROMO_ENABLED).toBe(false);
  expect(isDisabledFirstOrderPromo(" pirmAIS ")).toBe(true);
  expect(isDisabledFirstOrderPromo("OTHER")).toBe(false);
  await backend(() => { throw new Error("No backend expected"); }, async () => {
    expect((await validatePromoCode(" pirmais ", null, 300)).valid).toBe(false);
  });
  await backend(url => {
    expect(url.pathname).toBe("/rest/v1/promo_codes");
    return Response.json({ type: "fixed", discount_cents: 100, max_uses: 0, used_count: 0 });
  }, async () => {
    expect(await validatePromoCode("OTHER", null, 300)).toMatchObject({ valid: true, discountCents: 100 });
  });
});

test("closed locker is absent from every public-choice list but retained historically", () => {
  expect(lockers.some(locker => locker.id === "tukums")).toBe(true);
  expect(publicLockers.some(locker => locker.id === "tukums")).toBe(false);
  expect(openLockers.some(locker => locker.id === "tukums")).toBe(false);
  expect(isClosedLockerId(" TuKuMs ")).toBe(true);
  expect(isClosedLockerId(null)).toBe(false);
  expect(nearestLockersForCode(2105, 3, 50).map(locker => locker.id)).not.toContain("tukums");
  // A closed locker must not remove an independently published courier postcode.
  expect(lookupPostalCode("LV-2105")).toMatchObject({ found: true, zone: 3 });
});

for (const legacy of [false, true]) {
  test(`closed destination ${legacy ? "legacy" : "current"} body never reaches orders backend`, async () => {
    await backend(() => { throw new Error("No reads/writes expected"); }, async () => {
      const body = legacy ? { locker: { id: "tukums" } } : { deliveryInfo: { locker_id: "tukums" } };
      expect((await checkout(req("/checkout", body))).status).toBe(400);
    });
  });
}

for (const method of ["locker", "courier"]) {
  test(`existing ${method} checkout keeps its original total and uses no new RPC`, async () => {
    let saved: Record<string, unknown> | undefined;
    await backend((url, init) => {
      if (url.pathname === "/rest/v1/listings") return Response.json([]);
      if (url.pathname === "/rest/v1/orders" && init?.method === "POST") {
        saved = JSON.parse(String(init.body));
        return Response.json({ id: "fixture-order", order_number: "TRG-fixture" }, { status: 201 });
      }
      throw new Error("No new schema, RPC or notifications allowed");
    }, async () => {
      const response = await checkout(req("/checkout", {
        items: [{ id: "fixture", title: "Fixture item", price: 9.34, quantity: 1, sellerId: "seller" }],
        contact: { name: "Fixture", email: "fixture@example.invalid", phone: "12345" },
        sellerIds: ["seller"], totalCents: 1234, deliveryFeeCents: 300, promoCode: "PIRMAIS",
        deliveryType: method,
        deliveryInfo: method === "locker" ? { locker_id: "brivibas" } : { address: "Fixture street", city: "Tukums" },
      }));
      expect(response.status).toBe(200);
      expect(saved?.total_cents).toBe(1234);
      expect(saved?.promo_code).toBeNull();
      expect(saved?.delivery_type).toBe(method);
      expect((await response.json()).paymentUrl).toContain("/cart/success?");
    });
  });
}

test("closed hot-drop destination cannot reserve stock", async () => {
  await backend(url => {
    if (url.pathname === "/auth/v1/user") return Response.json({ id: "fixture-user" });
    if (url.pathname === "/rest/v1/hot_drops") return Response.json({ id: "drop", pickup_locker_id: "tukums" });
    throw new Error("No reservation/order write permitted");
  }, async () => {
    expect((await dropCheckout(req("/drop", { dropId: "drop", quantity: 1 }, true))).status).toBe(400);
  });
});

test("closed subscription cannot be created", async () => {
  await backend(url => {
    expect(url.pathname).toBe("/auth/v1/user");
    return Response.json({ id: "fixture-user" });
  }, async () => {
    expect((await subscribe(req("/subscription", { lockerId: "tukums" }, true))).status).toBe(400);
  });
});

test("historical closed destination remains stored but cannot create a new shipment", async () => {
  await backend(url => {
    if (url.pathname === "/auth/v1/user") return Response.json({ id: "fixture-user" });
    if (url.pathname === "/rest/v1/orders") return Response.json({
      id: "order", order_number: "TRG-historic", delivery_type: "locker", delivery_info: { locker_id: "tukums" },
      payment_status: "paid", status: "processing", seller_ids: ["seller"], items: [{ seller_id: "seller" }],
    });
    if (url.pathname === "/rest/v1/sellers") return Response.json({ id: "seller", home_locker_ids: ["brivibas"] });
    throw new Error("No shipment/order update allowed");
  }, async () => {
    expect((await shipment(req("/shipment", { orderId: "order", size: "M", lockerCode: "1234" }, true))).status).toBe(409);
  });
});

test("all three promo cards are gated and stale closed-locker drafts are rejected", () => {
  expect(source("components/buyer-signup-form.tsx").match(/\{FIRST_ORDER_PROMO_ENABLED &&/g)).toHaveLength(2);
  expect(source("components/buyer-profile.tsx").match(/\{FIRST_ORDER_PROMO_ENABLED &&/g)).toHaveLength(1);
  expect(source("components/cart-page.tsx")).toContain('placeholder="Ievadi promo kodu"');
  expect(source("components/cart-page.tsx")).toContain('setStep(isClosedLockerId(d.lockerId)');
  for (const path of ["components/onboarding-form.tsx", "components/dashboard-profile-editor.tsx",
    "components/zones-map.tsx", "app/admin/razotaji/page.tsx"]) {
    expect(source(path)).not.toMatch(/\{\s*id:\s*"tukums"/);
  }
});

test("pricing release preserves historical data, invoices, operator, commission and schema boundary", () => {
  // Payment behavior is covered by the security-payment suite rather than frozen source bytes.
  for (const path of ["lib/invoice/generate.ts", "lib/operator-info.ts",
    "lib/utils.ts", "lib/mock-data.ts", "lib/commission.ts"]) {
    const original = execFileSync("git", ["show", `aa88b6575a4146e630bf24f40af5683825675305:apps/tirgus/${path}`],
      { cwd: app, encoding: "utf8" });
    expect(source(path), path).toBe(original);
  }
  const changedMigrations = execFileSync("git", ["diff", "--name-only",
    "aa88b6575a4146e630bf24f40af5683825675305", "--", "supabase/migrations"],
  { cwd: resolve(app, "../.."), encoding: "utf8" });
  expect(changedMigrations).toBe("");
  expect(source("app/api/checkout/create-session/route.ts")).not.toContain("createReservedOrder");
});
