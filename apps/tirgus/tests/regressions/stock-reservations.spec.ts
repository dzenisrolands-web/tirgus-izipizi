import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { POST as checkout } from "../../app/api/checkout/create-session/route";
import { POST as retry } from "../../app/api/checkout/retry-payment/route";
import { GET as callback } from "../../app/api/webhooks/paysera/route";
import { GET as expire } from "../../app/api/cron/expire-reservations/route";
import { grantOrderAccess } from "../../lib/order-access";

const lid = "ab000000-0000-4000-8000-000000000001";
const sid = "cd000000-0000-4000-8000-000000000001";
const order = { id: "order", order_number: "TRG-test", total_cents: 1250, status: "pending", payment_status: "awaiting" };

async function mocked(handler: (url: URL, init?: RequestInit) => Response, run: () => Promise<void>) {
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.origin !== "https://example.invalid") throw new Error("External network forbidden");
    return handler(url, init);
  };
  try { await run(); } finally { globalThis.fetch = original; }
}

test("missing reservation migration fails checkout closed with no direct order insert", async () => {
  const writes: string[] = [];
  await mocked((url, init) => {
    if (url.pathname === "/rest/v1/listings") return Response.json([{
      id: lid, seller_id: sid, title: "Fixture", price: 2, quantity: 3, status: "active", variants: [], vat_rate: 21,
    }]);
    if (url.pathname === "/rest/v1/sellers") return Response.json([{
      id: sid, status: "approved", delivery_mode: "locker", home_locker_ids: ["brivibas"],
    }]);
    if (init?.method === "POST") writes.push(url.pathname);
    if (url.pathname === "/rest/v1/rpc/create_reserved_marketplace_order") {
      return Response.json({ code: "PGRST202", message: "RPC not installed" }, { status: 404 });
    }
    throw new Error("No fallback writes allowed");
  }, async () => {
    const response = await checkout(new Request("https://example.invalid/checkout", {
      method: "POST", body: JSON.stringify({
        items: [{ id: lid, quantity: 1 }], deliveryInfo: { locker_id: "brivibas" },
        contact: { name: "Fixture", email: "fixture@example.invalid", phone: "12345" },
      }),
    }));
    expect(response.status).toBe(503);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(writes).toEqual(["/rest/v1/rpc/create_reserved_marketplace_order"]);
  });
});

test("verified wrong-amount callback passes actual received cents to review without notification", async () => {
  process.env.PAYSERA_MODE = "live";
  process.env.PAYSERA_SIGN_PASSWORD = "nonfunctional-test-password";
  process.env.PAYSERA_PROJECT_ID = "test-project";
  try {
    await mocked((url, init) => {
      if (url.pathname === "/rest/v1/orders") return Response.json(order);
      if (url.pathname === "/rest/v1/rpc/settle_reserved_marketplace_order") {
        expect(JSON.parse(String(init?.body))).toEqual({ p_order_number: order.order_number, p_amount_cents: 1 });
        return Response.json({ outcome: "review", order_id: order.id, review_reason: "amount_mismatch" });
      }
      throw new Error("No stock fallback or notifications allowed");
    }, async () => {
      const data = Buffer.from(new URLSearchParams({
        orderid: order.order_number, amount: "1250", payamount: "1", paycurrency: "EUR",
        currency: "EUR", projectid: "test-project", test: "0", status: "1",
      }).toString()).toString("base64url");
      const ss1 = createHash("md5").update(data + "nonfunctional-test-password").digest("hex");
      expect((await callback(new Request(`https://example.invalid/callback?${new URLSearchParams({ data, ss1 })}`))).status).toBe(200);
    });
  } finally { process.env.PAYSERA_MODE = "mock"; }
});

test("retry refuses expired or legacy missing reservations", async () => {
  const cookie = grantOrderAccess(NextResponse.json({}), order.order_number).headers.get("set-cookie")!.split(";")[0];
  for (const expiry of [null, "invalid", new Date(Date.now() - 1000).toISOString()]) {
    await mocked(url => {
      if (url.pathname === "/rest/v1/orders") return Response.json({ ...order, reservation_expires_at: expiry });
      throw new Error("No other backend allowed");
    }, async () => {
      expect((await retry(new Request("https://example.invalid/retry", {
        method: "POST", headers: { cookie }, body: JSON.stringify({ orderNumber: order.order_number }),
      }))).status).toBe(409);
    });
  }
});

test("expiry cron authenticates and fails closed if migration is missing", async () => {
  const previous = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "nonfunctional-regression-cron";
  try {
    await mocked(url => {
      expect(url.pathname).toBe("/rest/v1/rpc/expire_marketplace_reservations");
      return Response.json({ code: "PGRST202" }, { status: 404 });
    }, async () => {
      expect((await expire(new Request("https://example.invalid/cron"))).status).toBe(401);
      expect((await expire(new Request("https://example.invalid/cron", {
        headers: { authorization: "Bearer nonfunctional-regression-cron" },
      }))).status).toBe(503);
    });
  } finally {
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
  }
});
