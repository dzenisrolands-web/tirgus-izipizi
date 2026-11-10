import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { POST as checkout } from "../../app/api/checkout/create-session/route";
import { POST as arrival } from "../../app/api/checkout/confirm-arrival/route";
import { GET as readOrder } from "../../app/api/orders/[orderNumber]/route";
import { POST as retry } from "../../app/api/checkout/retry-payment/route";
import { POST as shipment } from "../../app/api/shipments/create-from-order/route";
import { POST as orderNotify } from "../../app/api/notify/order-status/route";
import { POST as dropNotify } from "../../app/api/push/notify/route";
import { POST as dropCheckout } from "../../app/api/checkout/drop/route";
import { POST as callback, GET as getCallback } from "../../app/api/webhooks/paysera/route";
import { checkoutListingIds, normalizeCheckoutItems, type CheckoutListing } from "../../lib/checkout-items";
import { grantOrderAccess, hasGuestOrderAccess } from "../../lib/order-access";
import { verifyPayseraCallback } from "../../lib/paysera";

const listing: CheckoutListing = {
  id: "ab000000-0000-4000-8000-000000000001", title: "Real product", price: 12.50, quantity: 10, unit: "gab.",
  seller_id: "cd000000-0000-4000-8000-000000000001", status: "active", variants: [], vat_rate: 21,
};
const seller = { id: listing.seller_id!, user_id: "owner", name: "Real seller", status: "approved", delivery_mode: "locker", home_locker_ids: ["brivibas"] };
const order = {
  id: "order", order_number: "TRG-test", buyer_id: "buyer", buyer_email: "buyer@example.invalid",
  buyer_name: "Buyer", status: "pending", payment_status: "awaiting", total_cents: 1250,
  seller_ids: [seller.id], items: [], delivery_info: { locker_id: "brivibas" }, delivery_type: "locker",
  reservation_expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
};
const request = (path: string, body: unknown, token?: string) => new Request(`https://example.invalid${path}`, {
  method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
  body: JSON.stringify(body),
});

test("one seller cannot ship an entire multi-seller order", async () => {
  await mocked(url => {
    if (url.pathname === "/auth/v1/user") return Response.json({ id: seller.user_id, app_metadata: {} });
    if (url.pathname === "/rest/v1/orders") return Response.json({
      ...order, seller_ids: [seller.id, "other"], status: "processing", payment_status: "paid",
    });
    if (url.pathname === "/rest/v1/sellers") return Response.json(seller);
    throw new Error("No writes or notifications allowed");
  }, async () => expect((await shipment(request("/shipment", { orderId: "order", size: "M", lockerCode: "1234" }, "test"))).status).toBe(409));
});

test("documented Paysera ss1 works for GET and form POST without any payment fallback", async () => {
  process.env.PAYSERA_MODE = "live";
  process.env.PAYSERA_SIGN_PASSWORD = "nonfunctional-test-password";
  process.env.PAYSERA_PROJECT_ID = "test-project";
  const data = Buffer.from(new URLSearchParams({
    orderid: order.order_number, amount: "1250", currency: "EUR", projectid: "test-project", test: "0", status: "1",
  }).toString()).toString("base64url");
  const ss1 = createHash("md5").update(data + "nonfunctional-test-password").digest("hex");
  try {
    await mocked(url => {
      if (url.pathname === "/rest/v1/orders") return Response.json({ ...order, payment_status: "paid", status: "paid" });
      if (url.pathname === "/rest/v1/rpc/settle_reserved_marketplace_order") {
        return Response.json({ outcome: "already_paid", order_id: order.id });
      }
      throw new Error("Already-paid callback must not mutate or notify");
    }, async () => {
      expect((await getCallback(new Request(`https://example.invalid/callback?${new URLSearchParams({ data, ss1 })}`))).status).toBe(200);
      expect((await callback(new Request("https://example.invalid/callback", {
        method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ data, ss1 }),
      }))).status).toBe(200);
      expect((await getCallback(new Request(`https://example.invalid/callback?${new URLSearchParams({ data, ss1: "invalid" })}`))).status).toBe(400);
    });
  } finally { process.env.PAYSERA_MODE = "mock"; }
});

test("plain and composite UUID cart IDs produce only valid UUID database candidates", async () => {
  const variantId = "cd000000-0000-4000-8000-000000000002";
  expect(checkoutListingIds([
    { id: listing.id, quantity: 1 }, { id: `${listing.id}-${variantId}`, quantity: 1 },
    { id: "invalid-prefix", quantity: 1 },
  ])).toEqual([listing.id]);
  for (const composite of [false, true]) {
    await mocked((url, init) => {
      if (url.pathname === "/rest/v1/listings") {
        expect(url.searchParams.get("id")).toBe(`in.(${listing.id})`);
        return Response.json([{ ...listing, variants: composite ? [{ id: variantId, title: "Large", price: 20, quantity: 2 }] : [] }]);
      }
      if (url.pathname === "/rest/v1/sellers") return Response.json([seller]);
      if (url.pathname === "/rest/v1/rpc/create_reserved_marketplace_order" && init?.method === "POST") {
        return Response.json({ order_id: order.id, reserved_until: order.reservation_expires_at });
      }
      throw new Error("Unexpected backend operation");
    }, async () => {
      const body = checkoutBody();
      if (composite) body.items[0].id = `${listing.id}-${variantId}`;
      expect((await checkout(request("/checkout", body))).status).toBe(200);
    });
  }
});

async function mocked<T>(
  handler: (url: URL, init?: RequestInit) => Response | Promise<Response>,
  run: () => Promise<T>,
) {
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.origin !== "https://example.invalid") throw new Error("Network access forbidden");
    return handler(url, init);
  };
  try { return await run(); } finally { globalThis.fetch = original; }
}

test("shipment persistence errors never falsely advance a paid order", async () => {
  for (const failShipment of [false, true]) {
    let advanced = false;
    await mocked((url, init) => {
      if (url.pathname === "/auth/v1/user") return Response.json({ id: seller.user_id, app_metadata: {} });
      if (url.pathname === "/rest/v1/sellers") return Response.json(seller);
      if (url.pathname === "/rest/v1/orders" && init?.method !== "PATCH") {
        return Response.json({ ...order, status: "processing", payment_status: "paid" });
      }
      if (url.pathname === "/rest/v1/sutijumi") {
        return failShipment
          ? Response.json({ message: "Unavailable fixture table" }, { status: 503 })
          : new Response(null, { status: 201 });
      }
      if (url.pathname === "/rest/v1/orders" && init?.method === "PATCH") {
        advanced = true;
        return new Response(null, { status: 204 });
      }
      throw new Error("Unexpected backend operation");
    }, async () => {
      const response = await shipment(request("/shipment", { orderId: "order", size: "M", lockerCode: "1234" }, "test"));
      expect(response.status).toBe(failShipment ? 503 : 200);
      expect(advanced).toBe(!failShipment);
    });
  }
});

function checkoutBody(deliveryType = "locker", locker = "brivibas") {
  return {
    items: [{ id: listing.id, quantity: 2, price: 0.01, title: "Fake product", sellerId: "intruder", drop_id: "invented" }],
    totalCents: 1, sellerIds: ["intruder"], deliveryFeeCents: -999,
    deliveryType, deliveryInfo: deliveryType === "locker" ? { locker_id: locker, locker_name: "Fake" } :
      { address: "Test address", city: "Rīga", postal_code: "LV-1010" },
    contact: { name: "Test Buyer", email: "test@example.invalid", phone: "+37120000000" },
  };
}

test("unverified browser arrival cannot settle or send anything", async () => {
  await mocked(() => { throw new Error("No backend allowed"); }, async () => {
    expect((await arrival()).status).toBe(410);
  });
});

for (const method of ["locker", "courier", "express"]) {
  test(`checkout ${method}: server owns prices, totals, seller IDs and fee`, async () => {
    let saved: Record<string, unknown> | undefined;
    await mocked((url, init) => {
      if (url.pathname === "/rest/v1/listings") return Response.json([{ ...listing, express_delivery: true }]);
      if (url.pathname === "/rest/v1/sellers") return Response.json([seller]);
      if (url.pathname === "/rest/v1/rpc/create_reserved_marketplace_order" && init?.method === "POST") {
        saved = JSON.parse(String(init.body)).p_order;
        return Response.json({ order_id: order.id, reserved_until: order.reservation_expires_at });
      }
      throw new Error(`Unexpected backend ${url.pathname}`);
    }, async () => {
      const response = await checkout(request("/api/checkout/create-session", checkoutBody(method)));
      expect(response.status).toBe(200);
      expect(saved?.total_cents).toBe(method === "locker" ? 2800 : method === "express" ? 3408 : 3274);
      expect(saved?.seller_ids).toEqual([seller.id]);
      expect(saved?.items).toEqual([expect.objectContaining({ price: 12.5, title: "Real product", seller_id: seller.id })]);
      expect((saved?.items as Record<string, unknown>[])[0]).not.toHaveProperty("drop_id");
      expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    });
  });
}

for (const locker of ["tukums", "saga", "unknown", "dundaga"]) {
  test(`checkout rejects unavailable locker ${locker} before order write`, async () => {
    await mocked(url => {
      if (url.pathname === "/rest/v1/listings") return Response.json([listing]);
      if (url.pathname === "/rest/v1/sellers") return Response.json([seller]);
      throw new Error("No writes allowed");
    }, async () => expect((await checkout(request("/checkout", checkoutBody("locker", locker)))).status).toBe(400));
  });
}

test("quantities, duplicates, unknown/inactive products and variant stock fail closed", () => {
  const localListing = { ...listing, id: "listing" };
  for (const quantity of [0, -1, 0.5, 1000, NaN]) {
    expect(() => normalizeCheckoutItems([{ id: "listing", quantity }], [localListing], "locker")).toThrow();
  }
  expect(() => normalizeCheckoutItems([{ id: "missing", quantity: 1 }], [localListing], "locker")).toThrow();
  expect(() => normalizeCheckoutItems([{ id: "listing", quantity: 1 }], [{ ...localListing, status: "paused" }], "locker")).toThrow();
  expect(() => normalizeCheckoutItems([{ id: "listing", quantity: 1 }, { id: "listing", quantity: 1 }], [localListing], "locker")).toThrow();
  const variantListing = { ...localListing, variants: [{ id: "v1", title: "Large", price: 20, quantity: 2 }] };
  expect(normalizeCheckoutItems([{ id: "listing-v1", quantity: 2 }], [variantListing], "locker")[0].price).toBe(20);
  expect(() => normalizeCheckoutItems([{ id: "listing-v1", quantity: 3 }], [variantListing], "locker")).toThrow();
  expect(() => normalizeCheckoutItems([{ id: "listing", quantity: 2 }, { id: "listing-v1", quantity: 1 }], [variantListing], "locker")).toThrow();
});

test("anonymous order enumeration is blocked without even querying backend", async () => {
  await mocked(() => { throw new Error("No backend allowed"); }, async () => {
    const response = await readOrder(new Request("https://example.invalid/api/orders/TRG-test"), { params: Promise.resolve({ orderNumber: "TRG-test" }) });
    expect(response.status).toBe(401);
  });
});

test("signed guest cookie is order-specific, supports reads/retries, and rejects forgery", async () => {
  const granted = grantOrderAccess(NextResponse.json({}), order.order_number);
  const cookie = granted.headers.get("set-cookie")!.split(";")[0];
  const req = new Request("https://example.invalid", { headers: { cookie } });
  expect(hasGuestOrderAccess(req, order.order_number)).toBe(true);
  expect(hasGuestOrderAccess(req, "OTHER")).toBe(false);
  expect(hasGuestOrderAccess(new Request("https://example.invalid", { headers: { cookie: "order_TRG-test=forged" } }), order.order_number)).toBe(false);
  await mocked(url => {
    if (url.pathname === "/rest/v1/orders") return Response.json(order);
    throw new Error("No other network allowed");
  }, async () => {
    expect((await readOrder(req, { params: Promise.resolve({ orderNumber: order.order_number }) })).status).toBe(200);
    const retryReq = request("/retry", { orderNumber: order.order_number });
    retryReq.headers.set("cookie", cookie);
    expect((await retry(retryReq)).status).toBe(200);
  });
});

test("another authenticated buyer cannot read or retry someone else's order", async () => {
  await mocked(url => {
    if (url.pathname === "/auth/v1/user") return Response.json({ id: "intruder", app_metadata: {}, email: "intruder@example.invalid" });
    if (url.pathname === "/rest/v1/orders") return Response.json(order);
    throw new Error("No other network allowed");
  }, async () => {
    expect((await readOrder(new Request("https://example.invalid", { headers: { authorization: "Bearer test" } }),
      { params: Promise.resolve({ orderNumber: order.order_number }) })).status).toBe(404);
    expect((await retry(request("/retry", { orderNumber: order.order_number }, "test"))).status).toBe(403);
  });
});

test("unrelated seller cannot ship, read label PII, or trigger buyer notification", async () => {
  await mocked(url => {
    if (url.pathname === "/auth/v1/user") return Response.json({ id: "intruder", app_metadata: {} });
    if (url.pathname === "/rest/v1/orders") return Response.json({ ...order, status: "processing", payment_status: "paid" });
    if (url.pathname === "/rest/v1/sellers") return Response.json({ ...seller, id: "other-seller" });
    throw new Error("No writes or notifications allowed");
  }, async () => {
    expect((await shipment(request("/shipment", { orderId: "order", size: "M", lockerCode: "1234" }, "test"))).status).toBe(403);
    expect((await orderNotify(request("/notify", { orderId: "order", status: "shipped" }, "test"))).status).toBe(403);
  });
});

test("ordinary user cannot broadcast another seller's drop", async () => {
  await mocked(url => {
    if (url.pathname === "/auth/v1/user") return Response.json({ id: "intruder", app_metadata: {} });
    if (url.pathname === "/rest/v1/hot_drops") return Response.json({ id: "drop", seller_id: "seller" });
    if (url.pathname === "/rest/v1/sellers") return Response.json(seller);
    throw new Error("No audience reads or sends allowed");
  }, async () => expect((await dropNotify(request("/push", { dropId: "drop" }, "test"))).status).toBe(403));
});

test("drop checkout rejects closed locker without reserving", async () => {
  await mocked(url => {
    if (url.pathname === "/auth/v1/user") return Response.json({ id: "buyer", app_metadata: {} });
    if (url.pathname === "/rest/v1/hot_drops") return Response.json({ id: "drop", pickup_locker_id: "tukums" });
    throw new Error("No writes allowed");
  }, async () => expect((await dropCheckout(request("/drop", { dropId: "drop", quantity: 1 }, "test"))).status).toBe(400));
});

test("callback accepts only matching project/currency/live payment mode and integer amount", () => {
  process.env.PAYSERA_MODE = "live";
  process.env.PAYSERA_SIGN_PASSWORD = "nonfunctional-test-password";
  process.env.PAYSERA_PROJECT_ID = "test-project";
  const encode = (extra: Record<string, string>) => {
    const data = Buffer.from(new URLSearchParams({ orderid: "order", amount: "1250", projectid: "test-project", currency: "EUR", test: "0", ...extra }).toString()).toString("base64url");
    return verifyPayseraCallback(data, createHash("md5").update(data + "nonfunctional-test-password").digest("hex"));
  };
  try {
    expect(encode({}).valid).toBe(true);
    const underpayment = encode({ payamount: "1", paycurrency: "EUR" });
    expect(underpayment.valid && underpayment.amountCents).toBe(1);
    const invalidParams: Record<string, string>[] = [{ projectid: "other" }, { currency: "USD" }, { test: "1" }, { amount: "1250junk" }, { amount: "-1" },
      { payamount: "-1", paycurrency: "EUR" }, { payamount: "0", paycurrency: "EUR" },
      { payamount: "1.5", paycurrency: "EUR" }, { payamount: "1250", paycurrency: "USD" }];
    for (const extra of invalidParams) {
      expect(encode(extra).valid).toBe(false);
    }
  } finally { process.env.PAYSERA_MODE = "mock"; }
});

test("failed/concurrent callback claims never proceed to stock or notifications", async () => {
  for (const failed of [false, true]) {
    await mocked((url, init) => {
      if (url.pathname === "/rest/v1/rpc/settle_reserved_marketplace_order") {
        expect(JSON.parse(String(init?.body))).toEqual({ p_order_number: order.order_number, p_amount_cents: 1250 });
        return failed ? Response.json({ message: "failed" }, { status: 500 }) :
          Response.json({ outcome: "already_paid", order_id: order.id });
      }
      if (url.pathname === "/rest/v1/orders") return Response.json(order);
      throw new Error("Stock and notifications forbidden");
    }, async () => {
      const data = Buffer.from("orderid=TRG-test&amount=1250&status=1").toString("base64url");
      const response = await callback(new Request(`https://example.invalid/callback?data=${data}`, { method: "POST" }));
      expect(response.status).toBe(failed ? 503 : 200);
    });
  }
});
