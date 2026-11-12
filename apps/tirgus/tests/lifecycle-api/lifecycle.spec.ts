import { test, expect } from "@playwright/test";
import crypto from "node:crypto";
import { POST as checkout } from "../../app/api/checkout/create-session/route";
import { POST as quoteApi } from "../../app/api/checkout/quote/route";
import { GET as webhook } from "../../app/api/webhooks/paysera/route";
import { POST as retry } from "../../app/api/checkout/retry-payment/route";
import { createOrderCapability, orderCookieName } from "../../lib/order-access";
import { marketplaceInvoiceEvidence } from "../../lib/invoice/marketplace-evidence";
import { processMarketplaceEmail } from "../../lib/marketplace-outbox";
import { createClient } from "@supabase/supabase-js";
const origin = "https://example.invalid";
const product = "22222222-2222-4222-8222-222222222222";
const seller = "11111111-1111-4111-8111-111111111111";
const number = "TRG-SYNTHETIC";
let original: typeof fetch;
let seen: string[];
let backend: (url: URL, init: RequestInit) => Response;
const request = (body: unknown) => new Request(origin, { method: "POST", body: JSON.stringify(body) });
test.beforeEach(() => {
  process.env.MARKETPLACE_LIFECYCLE_V1 = "enabled";
  process.env.MARKETPLACE_RESERVATIONS_ACCEPTING = "enabled";
  seen = [];
  original = globalThis.fetch;
  backend = () => Response.json({ code: "UNEXPECTED" }, { status: 500 });
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    expect(url.origin).toBe(origin);
    seen.push(`${init?.method ?? "GET"} ${url.pathname}`);
    return backend(url, init ?? {});
  };
});
test.afterEach(() => {
  globalThis.fetch = original;
  delete process.env.MARKETPLACE_LIFECYCLE_V1;
  delete process.env.MARKETPLACE_RESERVATIONS_ACCEPTING;
  delete process.env.MARKETPLACE_EMAIL_OUTBOX;
});
const body = () => ({
  items: [{ id: product, listingId: product, variantId: null, quantity: 1 }],
  deliveryType: "locker", deliveryInfo: { locker_id: "brivibas" },
  contact: { name: "Synthetic Buyer", email: "buyer@example.invalid", phone: "+37100000000" },
});
function catalog(url: URL): Response | null {
  if (url.pathname === "/rest/v1/listings") return Response.json([{
    id: product, title: "Synthetic product", price: 5, quantity: 1, unit: "gab.",
    status: "active", seller_id: seller, variants: [], category: "Maize", storage_type: "chilled",
    courier_delivery: true, express_delivery: true,
  }], { headers: { "content-range": "0-0/1" } });
  if (url.pathname === "/rest/v1/sellers_public") return Response.json([{ id: seller, name: "Synthetic producer", home_locker_ids: ["brivibas"] }]);
  return null;
}
for (const success of [true, false]) {
  test(`enabled checkout uses only reservation RPC; migration ${success ? "available" : "absent"}`, async () => {
    backend = (url, init) => catalog(url) ?? (url.pathname === "/rest/v1/rpc/marketplace_reserve_v1"
      ? success ? Response.json({
        order_id: product, order_number: JSON.parse(String(init.body)).p_order.order_number,
        reserved_until: "2099-01-01T00:00:00Z",
      }) : Response.json({ code: "PGRST202", message: "Private DB error" }, { status: 404 })
      : Response.json({ code: "FORBIDDEN_FALLBACK" }, { status: 500 }));
    const quoted = await (await quoteApi(request(body()))).json();
    const response = await checkout(request({ ...body(), expectedTotalCents: quoted.quote.totalCents, quoteFingerprint: quoted.quote.fingerprint }));
    expect(response.status).toBe(success ? 200 : 503);
    expect(seen).not.toContain("POST /rest/v1/orders");
    if (!success) {
      expect(response.headers.get("set-cookie")).toBeNull();
      expect(JSON.stringify(await response.json())).not.toContain("Private DB error");
    }
  });
}
function callback(amount = 800, signValid = true) {
  const data = Buffer.from(new URLSearchParams({
    projectid: "123456", orderid: number, amount: String(amount), currency: "EUR", status: "1", test: "1",
  }).toString()).toString("base64url");
  const ss1 = signValid ? crypto.createHash("md5").update(data + process.env.PAYSERA_SIGN_PASSWORD).digest("hex") : "0".repeat(32);
  return new Request(`${origin}/callback?data=${data}&ss1=${ss1}`);
}
for (const outcome of ["paid", "already_paid", "review"]) {
  test(`signed reserved callback ${outcome} commits via one RPC without legacy side effects`, async () => {
    backend = url => url.pathname === "/rest/v1/orders" ? Response.json({
      id: product, order_number: number, lifecycle_version: "marketplace-v1", total_cents: 800,
    }) : url.pathname === "/rest/v1/rpc/marketplace_settle_v1" ? Response.json({ order_id: product, outcome })
      : Response.json({ code: "UNEXPECTED" }, { status: 500 });
    expect((await webhook(callback(outcome === "review" ? 1 : 800))).status).toBe(200);
    expect(seen).toEqual(["GET /rest/v1/orders", "POST /rest/v1/rpc/marketplace_settle_v1"]);
  });
}
test("bad signatures never reach DB; missing settlement RPC never acknowledges completion", async () => {
  expect((await webhook(callback(800, false))).status).toBe(400);
  expect(seen).toEqual([]);
  backend = url => url.pathname === "/rest/v1/orders" ? Response.json({
    id: product, order_number: number, lifecycle_version: "marketplace-v1", total_cents: 800,
  }) : Response.json({ code: "PGRST202" }, { status: 404 });
  expect((await webhook(callback())).status).toBe(503);
});
test("authorized expired reserved payment cannot be restarted", async () => {
  backend = () => Response.json({
    order_number: number, status: "pending", payment_status: "awaiting",
    lifecycle_version: "marketplace-v1", reservation_expires_at: "2000-01-01T00:00:00Z",
  });
  const response = await retry(new Request(origin, { method: "POST",
    headers: { cookie: `${orderCookieName(number)}=${createOrderCapability(number)}` },
    body: JSON.stringify({ orderNumber: number }),
  }));
  expect(response.status).toBe(409);
  expect(seen).toEqual(["GET /rest/v1/orders"]);
});

test("invoice eligibility needs captured operator/tax/pickup and confirmed payment; acknowledgement is not repair", () => {
  const operator = Object.fromEntries(["name", "regNr", "vatNr", "address", "phone", "email", "bankName", "iban", "bic", "complaintsEmail"].map(k => [k, `synthetic-${k}`]));
  const valid = {
    lifecycle_version: "marketplace-v1", status: "paid", payment_status: "paid", paid_at: "2026-11-01T00:00:00Z",
    financial_snapshot: { version: "marketplace-finance-v1", operator_version: "test", operator, requires_review: false },
    items: [{ seller_id: seller, commission_rate: 15, vat_rate: 12, seller_delivery_mode: "courier", seller_courier_fee_cents: 350 }],
  };
  expect(marketplaceInvoiceEvidence(valid).ok).toBe(true);
  for (const extra of [
    { lifecycle_version: null }, { payment_status: "awaiting" }, { paid_at: null }, { status: "cancelled" },
    { payment_review_reason: "operator_acknowledged_but_unrepaired" }, { financial_snapshot: null },
    { financial_snapshot: { ...valid.financial_snapshot, requires_review: true } },
    { items: [{ ...valid.items[0], vat_rate: null }] },
    { items: [{ ...valid.items[0], seller_courier_fee_cents: null }] },
  ]) expect(marketplaceInvoiceEvidence({ ...valid, ...extra }).ok).toBe(false);
});

test("outbox is off by default and missing provider settings do not consume pending jobs", async () => {
  const sb = createClient(origin, "nonfunctional-service");
  expect((await processMarketplaceEmail(sb)).state).toBe("disabled");
  process.env.MARKETPLACE_EMAIL_OUTBOX = "enabled";
  expect((await processMarketplaceEmail(sb)).state).toBe("not_configured");
  expect(seen).toEqual([]);
});
for (const throws of [false, true]) {
  test(`outbox transport ${throws ? "unknown" : "accepted"} result is fenced and persisted`, async () => {
    process.env.MARKETPLACE_EMAIL_OUTBOX = "enabled";
    backend = url => url.pathname.endsWith("/marketplace_claim_email_v1")
      ? Response.json({ id: product, order_id: product, claim_token: seller, audience: "buyer", seller_id: null })
      : Response.json(true);
    const transport = async () => {
      if (throws) throw new Error("Unknown provider outcome, do not log private payload");
      return { outcome: "accepted" as const, reference: "synthetic-provider-id" };
    };
    expect((await processMarketplaceEmail(createClient(origin, "nonfunctional-service"), transport)).state).toBe(throws ? "uncertain" : "accepted");
    expect(seen).toEqual(["POST /rest/v1/rpc/marketplace_claim_email_v1", "POST /rest/v1/rpc/marketplace_finish_email_v1"]);
  });
}
