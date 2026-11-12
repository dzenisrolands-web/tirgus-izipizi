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
import { transferMarketplaceHandoff } from "../../lib/marketplace-handoff";
import { POST as prepareHandoff } from "../../app/api/admin/marketplace-handoff/route";
import { POST as adminStatus } from "../../app/api/admin/update-order-status/route";
import { POST as recordRefund } from "../../app/api/admin/marketplace-finance/route";
import { recognizedPaidOrder, sellerOrderAmounts } from "../../lib/seller-order-metrics";
import { sellerNetWithVat, commissionBreakdown } from "../../lib/commission";
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
  delete process.env.MARKETPLACE_LOGISTICS_HANDOFF;
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
test("handoff endpoint requires admin; disabled/unconfigured receiver makes zero outbound requests", async () => {
  expect((await prepareHandoff(request({ orderId: product }))).status).toBe(401);
  const sb = createClient(origin, "nonfunctional-service");
  expect((await transferMarketplaceHandoff(sb, product)).state).toBe("disabled");
  process.env.MARKETPLACE_LOGISTICS_HANDOFF = "enabled";
  expect((await transferMarketplaceHandoff(sb, product)).state).toBe("receiver_not_configured");
  expect(seen).toEqual([]);
});
for (const valid of [true, false]) {
  test(`handoff ${valid ? "matching" : "forged"} acknowledgement cannot authorize dispatch`, async () => {
    process.env.MARKETPLACE_LOGISTICS_HANDOFF = "enabled";
    backend = url => url.pathname.endsWith("/marketplace_claim_handoff_v1")
      ? Response.json({ order_id: product, claim_token: seller, source_key: `marketplace/persisted_id/${product}`, envelope: {} })
      : Response.json(true);
    const result = await transferMarketplaceHandoff(createClient(origin, "nonfunctional-service"), product, async () => ({
      sourceKey: valid ? `marketplace/persisted_id/${product}` : "different-source",
      receiverId: seller, intakeVersion: "logistics-intake-v1", dispatchAuthorized: false, billingAuthorized: false,
    }));
    expect(result.state).toBe(valid ? "recorded" : "review");
    expect(result.dispatchAuthorized).toBe(false);
    expect(result.billingAuthorized).toBe(false);
  });
}
test("statistics never infer money from status alone or include cancelled/refunded/review orders", () => {
  const paid = { status: "paid", payment_status: "paid", paid_at: "2026-11-01T00:00:00Z" };
  expect(recognizedPaidOrder(paid)).toBe(true);
  for (const extra of [{ status: "cancelled" }, { payment_status: "refunded" }, { payment_status: "awaiting" },
    { paid_at: null }, { payment_review_reason: "refund_required" }]) expect(recognizedPaidOrder({ ...paid, ...extra })).toBe(false);
});
test("seller payout preview uses captured VAT and one pickup charge, not today's profile or other sellers", () => {
  const item = { seller_id: seller, price: 10, quantity: 1, vat_rate: 12, commission_rate: 15, seller_courier_fee_cents: 350 };
  const result = sellerOrderAmounts({ items: [item, item, { ...item, seller_id: product }] }, seller);
  expect(result.goodsCents).toBe(2000);
  expect(result.pickupCents).toBe(350);
  expect(result.commissionCents).toBe(Math.round(commissionBreakdown(10, 12).commissionTotal * 200));
  expect(sellerOrderAmounts({ items: [{ ...item, vat_rate: null }] }, seller).netCents).toBeNull();
  expect(sellerOrderAmounts({ items: [{ ...item, price: Number.MAX_VALUE }] }, seller).netCents).toBeNull();
  for (const vat of [0, 5, 12, 21]) expect(sellerNetWithVat(10, vat).commission).toBe(commissionBreakdown(10, vat).commissionTotal);
});
for (const isAdmin of [false, true]) {
  test(`reserved admin status with ${isAdmin ? "real" : "forged"} authority cannot mark a payment paid manually`, async () => {
    backend = url => url.pathname === "/auth/v1/user" ? Response.json({
      id: seller, app_metadata: { is_super_admin: isAdmin }, user_metadata: { is_super_admin: true },
    }) : Response.json({ id: product, status: "pending", lifecycle_version: "marketplace-v1", payment_status: "awaiting" });
    const response = await adminStatus(new Request(origin, { method: "POST", headers: { authorization: "Bearer synthetic" },
      body: JSON.stringify({ orderId: product, status: "paid" }),
    }));
    expect(response.status).toBe(isAdmin ? 409 : 403);
    expect(seen.some(call => call.startsWith("PATCH") || call.includes("/rpc/"))).toBe(false);
  });
}
test("manual refund endpoint takes actor only from verified admin and requires external-refund acknowledgement", async () => {
  expect((await recordRefund(request({ orderId: product }))).status).toBe(401);
  backend = () => Response.json({ id: seller, app_metadata: { is_super_admin: true } });
  const response = await recordRefund(new Request(origin, { method: "POST", headers: { authorization: "Bearer synthetic" },
    body: JSON.stringify({ orderId: product, actorId: product, amountCents: 800 }),
  }));
  expect(response.status).toBe(400);
  expect(seen.filter(call => call.includes("/rpc/"))).toEqual([]);
});
