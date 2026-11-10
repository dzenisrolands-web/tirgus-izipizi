import { test, expect } from "@playwright/test";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { verifyPayseraCallback, getMode, buildPayseraRedirectUrl, trustedPaymentBaseUrl } from "../../lib/paysera";
import {
  createOrderCapability, hasOrderCapability, orderCookieName, attachOrderCookie,
  ORDER_ACCESS_TTL_SECONDS, newOrderNumber, userOwnsOrder,
} from "../../lib/order-access";
import { GET as callbackGet, POST as callbackPost } from "../../app/api/webhooks/paysera/route";
import { POST as arrival } from "../../app/api/checkout/confirm-arrival/route";
import { POST as checkout } from "../../app/api/checkout/create-session/route";
import { POST as dropCheckout } from "../../app/api/checkout/drop/route";
import { POST as retry } from "../../app/api/checkout/retry-payment/route";
import { GET as readOrder } from "../../app/api/orders/[orderNumber]/route";

const base = "https://example.invalid";
const orderNumber = "TRG-20261110-1234"; // Legacy IDs remain supported.
const standardParams = {
  projectid: "123456", orderid: orderNumber, amount: "1234", currency: "EUR", status: "1", test: "1",
};
function signedRaw(raw: string) {
  const data = Buffer.from(raw).toString("base64url");
  return { data, ss1: crypto.createHash("md5").update(data + process.env.PAYSERA_SIGN_PASSWORD).digest("hex") };
}
function signed(overrides: Record<string, string> = {}) {
  return signedRaw(new URLSearchParams({ ...standardParams, ...overrides }).toString());
}
function callbackRequest(fields: Record<string, string>, method = "GET") {
  const encoded = new URLSearchParams(fields).toString();
  return new Request(`${base}/api/webhooks/paysera${method === "GET" ? `?${encoded}` : ""}`, {
    method,
    ...(method === "POST" ? { headers: { "content-type": "application/x-www-form-urlencoded" }, body: encoded } : {}),
  });
}
const request = (path: string, body?: unknown, headers: Record<string, string> = {}) => new Request(`${base}${path}`, {
  method: body === undefined ? "GET" : "POST",
  headers: { "content-type": "application/json", ...headers },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

test("closed Tukums destination still fails before order/reservation writes", async () => {
  await backend((url) => {
    if (url.pathname === "/auth/v1/user") return Response.json({ id: "buyer" });
    if (url.pathname === "/rest/v1/hot_drops") return Response.json({ id: "fixture-drop", pickup_locker_id: "tukums" });
    throw new Error("No order/reservation write permitted");
  }, async () => {
    expect((await checkout(request("/checkout", { deliveryInfo: { locker_id: "tukums" } }))).status).toBe(400);
    expect((await dropCheckout(request("/drop", { dropId: "fixture-drop", quantity: 1 }, { authorization: "Bearer fixture" }))).status).toBe(400);
  });
});
test("locker guest checkout retains current total and signs its return cookie", async () => {
  let saved: Record<string, unknown> | undefined;
  await backend((url, init) => {
    if (url.pathname === "/rest/v1/listings") return Response.json([]);
    if (url.pathname === "/rest/v1/orders" && init.method === "POST") {
      saved = JSON.parse(String(init.body));
      return Response.json({ id: "fixture-order", order_number: saved!.order_number }, { status: 201 });
    }
    throw new Error("No schema/RPC/notification change permitted");
  }, async () => {
    const response = await checkout(request("/checkout", {
      items: [{ id: "fixture", title: "Fixture", price: 9.34, quantity: 1 }],
      contact: { name: "Fixture", email: "fixture@example.invalid" },
      sellerIds: [], totalCents: 1234, deliveryFeeCents: 300,
      deliveryType: "locker", deliveryInfo: { locker_id: "brivibas" },
    }));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(saved).toMatchObject({ total_cents: 1234, delivery_type: "locker" });
    expect(hasOrderCapability(request("/order", undefined, { cookie: response.headers.get("set-cookie")!.split(";")[0] }), body.orderId)).toBe(true);
  });
});
const cookie = (number = orderNumber, now?: number) => `${orderCookieName(number)}=${createOrderCapability(number, now)}`;
const fixtureOrder = () => ({
  id: "fixture-order", order_number: orderNumber, status: "pending", payment_status: "awaiting",
  paid_at: null as string | null, total_cents: 1234, buyer_id: "buyer", buyer_name: "Fixture buyer",
  buyer_email: "buyer@example.invalid", buyer_phone: "12345", delivery_type: "locker",
  delivery_info: { locker_id: "brivibas", locker_name: "Fixture locker" },
  items: [] as Array<{ drop_id?: string; quantity?: number }>, seller_ids: [],
  promo_code: null, promo_discount_cents: null,
});
const backendError = (code = "XX000") => Response.json({ code, message: "fixture failure" }, { status: 500 });

type Handler = (url: URL, init: RequestInit) => Response | Promise<Response>;
async function backend(handler: Handler, run: () => Promise<void>) {
  const original = globalThis.fetch;
  const denied: string[] = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.origin !== base) {
      denied.push(url.origin);
      throw new Error("Only example.invalid dummy services allowed");
    }
    return handler(url, init ?? {});
  };
  try { await run(); expect(denied).toEqual([]); } finally { globalThis.fetch = original; }
}

// Stateful PostgREST simulation checks CAS predicates, counts notification entry
// reads, and never invokes a notification provider (dummy/no recipient results).
function paymentBackend(options: {
  readFail?: boolean; missing?: boolean; updateFail?: boolean; race?: boolean; racePaid?: boolean;
  rpcError?: string; dropWriteFail?: boolean; dropRace?: boolean; finalizeFail?: boolean; sideEffectsFail?: boolean;
  dropReadFail?: boolean; insufficientStock?: boolean; drop?: boolean; finalizeRace?: boolean;
  rereadFail?: boolean;
} = {}) {
  const order = fixtureOrder();
  if (options.drop) order.items = [{ drop_id: "fixture-drop", quantity: 2 }];
  let writes = 0, notifications = 0, rpcs = 0, stockWrites = 0, stockReads = 0, finalizations = 0;
  const handler: Handler = (url, init) => {
    const method = init.method ?? "GET";
    if (url.pathname === "/rest/v1/orders") {
      if (method === "PATCH") {
        const body = JSON.parse(String(init.body));
        if (!("payment_status" in body)) {
          finalizations++;
          expect(url.searchParams.get("status")).toBe("eq.pending");
          expect(url.searchParams.get("payment_status")).toBe("eq.paid");
          expect(url.searchParams.get("paid_at")).toBe("is.null");
          if (options.finalizeFail) return backendError();
          if (options.finalizeRace) return Response.json([]);
          Object.assign(order, body);
          return Response.json([{ id: order.id }]);
        }
        writes++;
        expect(url.searchParams.get("status")).toBe("eq.pending");
        expect(url.searchParams.get("total_cents")).toBe("eq.1234");
        expect(url.searchParams.get("payment_status")).toBe("eq.awaiting");
        expect(url.searchParams.get("paid_at")).toBe("is.null");
        if (options.updateFail) return backendError();
        if (options.race) {
          if (options.racePaid) Object.assign(order, { payment_status: "paid", paid_at: "2026-11-10T00:00:00Z" });
          return Response.json([]);
        }
        if (order.payment_status !== "awaiting") return Response.json([]);
        Object.assign(order, body);
        return Response.json([{ id: order.id }]);
      }
      if (url.searchParams.has("order_number") || url.searchParams.get("select") === "payment_status,paid_at") {
        if (options.readFail) return backendError();
        if (options.rereadFail && !url.searchParams.has("order_number")) return backendError();
        if (options.missing) return Response.json({ code: "PGRST116" }, { status: 406 });
        return Response.json({ ...order, items: [...order.items] });
      }
      notifications++;
      // Enter existing best-effort notification functions without real delivery.
      if (options.sideEffectsFail) return backendError();
      return Response.json({ code: "PGRST116" }, { status: 406 });
    }
    if (url.pathname === "/rest/v1/rpc/confirm_hot_drop_payment") {
      rpcs++;
      expect(JSON.parse(String(init.body))).toEqual({ p_drop_id: "fixture-drop", p_quantity: 2 });
      return options.rpcError ? backendError(options.rpcError) : Response.json(null);
    }
    if (url.pathname === "/rest/v1/hot_drops") {
      if (method === "GET") {
        stockReads++;
        return options.dropReadFail ? backendError() : Response.json({ reserved_quantity: options.insufficientStock ? 1 : 3, sold_quantity: 4 });
      }
      stockWrites++;
      expect(url.searchParams.get("reserved_quantity")).toBe("eq.3");
      expect(url.searchParams.get("sold_quantity")).toBe("eq.4");
      expect(JSON.parse(String(init.body))).toMatchObject({ reserved_quantity: 1, sold_quantity: 6 });
      return options.dropWriteFail ? backendError() : Response.json(options.dropRace ? [] : [{ id: "fixture-drop" }]);
    }
    throw new Error(`Unexpected dummy-service call ${url.pathname}`);
  };
  return { order, handler, stats: () => ({ writes, notifications, rpcs, stockWrites, stockReads, finalizations }) };
}

for (const method of ["GET", "POST"]) {
  for (const key of ["ss1", "sign"]) {
    test(`signed ${key} ${method} confirms exactly once and repeated callback is idempotent`, async () => {
      const db = paymentBackend();
      const { data, ss1 } = signed({ payamount: "1234", paycurrency: "EUR" });
      await backend(db.handler, async () => {
        for (let i = 0; i < 2; i++) {
          const response = await (method === "GET" ? callbackGet : callbackPost)(callbackRequest({ data, [key]: ss1 }, method));
          expect(response.status).toBe(200);
          expect(await response.text()).toBe("OK");
        }
      });
      expect(db.order).toMatchObject({ status: "paid", payment_status: "paid" });
      expect(db.order.paid_at).toBeTruthy();
      expect(db.stats()).toMatchObject({ writes: 1, notifications: 2, rpcs: 0 });
    });
  }
}

test("concurrent signed callbacks have one CAS winner and one notification flow", async () => {
  const db = paymentBackend();
  await backend(db.handler, async () => {
    const responses = await Promise.all([callbackGet(callbackRequest(signed())), callbackPost(callbackRequest(signed(), "POST"))]);
    expect(responses.map(r => r.status)).toEqual([200, 200]);
  });
  expect(db.stats()).toMatchObject({ notifications: 2 });
});

for (const [name, values] of [
  ["foreign project", { projectid: "654321" }], ["currency", { currency: "USD" }], ["test flag", { test: "0" }],
  ["missing/empty test flag", { test: "" }], ["negative amount", { amount: "-1" }], ["fractional amount", { amount: "1234.0" }],
  ["integer prefix junk", { amount: "1234junk" }], ["leading zeros", { amount: "01234" }],
  ["unsafe integer", { amount: "9007199254740992" }], ["invalid order", { orderid: "a".repeat(41) }],
  ["missing payment currency", { payamount: "1234" }], ["malformed actual amount", { payamount: "1.2", paycurrency: "EUR" }],
] as Array<[string, Record<string, string>]>) {
  test(`reject ${name} before any DB access`, async () => {
    await backend(() => { throw new Error("No DB access expected"); }, async () => {
      expect((await callbackGet(callbackRequest(signed(values)))).status).toBe(400);
    });
  });
}

for (const raw of [
  `${new URLSearchParams(standardParams)}&amount=1234`,
  `${new URLSearchParams(standardParams)}&%61mount=1234`,
  `${new URLSearchParams(standardParams)}&bad=%ZZ`,
  `${new URLSearchParams(standardParams)}&bad=%C3%28`,
  `${new URLSearchParams(standardParams)}&__proto__=x`,
  `${new URLSearchParams(standardParams)}&`,
]) {
  test(`reject malformed or duplicate decoded data: ${raw.slice(-24)}`, () => {
    const { data, ss1 } = signedRaw(raw);
    expect(verifyPayseraCallback(data, ss1).valid).toBe(false);
  });
}

test("invalid/missing signature, conflicting ss1/sign and duplicate outer params are rejected", async () => {
  const fields = signed();
  await backend(() => { throw new Error("No DB access expected"); }, async () => {
    for (const ss1 of ["", "0".repeat(32), "f", "g".repeat(32)]) {
      expect((await callbackGet(callbackRequest({ ...fields, ss1 }))).status).toBe(400);
    }
    expect((await callbackGet(callbackRequest({ ...fields, sign: "0".repeat(32) }))).status).toBe(400);
    const query = new URLSearchParams(fields).toString();
    expect((await callbackGet(new Request(`${base}/callback?${query}&ss1=${fields.ss1}`))).status).toBe(400);
    expect((await callbackPost(new Request(`${base}/callback?${query}`, {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: query,
    }))).status).toBe(400);
  });
});

for (const data of ["%%%", "a", "abc===", "YWJj=", "YWJj+", "_w"]) {
  test(`strict Base64 and UTF-8 reject ${data}`, () => {
    const sign = crypto.createHash("md5").update(data + process.env.PAYSERA_SIGN_PASSWORD).digest("hex");
    expect(verifyPayseraCallback(data, sign).valid).toBe(false);
  });
}

for (const status of ["0", "2", "3", "4"]) {
  test(`non-final signed status ${status} never writes`, async () => {
    await backend(() => { throw new Error("No DB access expected"); }, async () => {
      expect(await (await callbackGet(callbackRequest(signed({ status })))).text()).toBe("OK");
    });
  });
}

for (const values of [{ amount: "1233" }, { payamount: "1233", paycurrency: "EUR" }, { payamount: "1500", paycurrency: "USD" }] as Array<Record<string, string>>) {
  test(`discrepancy ${JSON.stringify(values)} never pays/fulfills and logs only safe facts`, async () => {
    const db = paymentBackend();
    const original = console.error;
    const logs: unknown[][] = [];
    console.error = (...args) => { logs.push(args); };
    try {
      await backend(db.handler, async () => expect((await callbackGet(callbackRequest(signed(values)))).status).toBe(400));
    } finally { console.error = original; }
    expect(db.stats()).toMatchObject({ writes: 0, notifications: 0, rpcs: 0 });
    expect(JSON.stringify(logs)).toContain("expectedCents");
    for (const hidden of [process.env.PAYSERA_SIGN_PASSWORD!, "buyer@example.invalid", "ss1", signed(values).data]) {
      expect(JSON.stringify(logs)).not.toContain(hidden);
    }
  });
}

for (const options of [{ readFail: true }, { missing: true }, { updateFail: true }, { race: true }, { race: true, rereadFail: true }]) {
  test(`DB failure/absent/unsuccessful CAS ${JSON.stringify(options)} requests retry, never notifies`, async () => {
    const db = paymentBackend(options);
    await backend(db.handler, async () => {
      expect((await callbackGet(callbackRequest(signed()))).status).toBe(503);
    });
    expect(db.stats().notifications).toBe(0);
  });
}
test("CAS loser acknowledges only a reread-confirmed paid order, without notifications", async () => {
  const db = paymentBackend({ race: true, racePaid: true });
  await backend(db.handler, async () => expect((await callbackGet(callbackRequest(signed()))).status).toBe(200));
  expect(db.stats().notifications).toBe(0);
});
test("best-effort notification lookup failure does not replay successful payment", async () => {
  const db = paymentBackend({ sideEffectsFail: true });
  await backend(db.handler, async () => {
    expect((await callbackGet(callbackRequest(signed()))).status).toBe(200);
    expect((await callbackGet(callbackRequest(signed()))).status).toBe(200);
  });
  expect(db.stats().writes).toBe(1);
  expect(db.stats().notifications).toBe(2);
});

for (const rpcError of [undefined, "PGRST202"]) {
  test(`existing hot-drop path ${rpcError ?? "RPC"} finalizes before notification; missing-RPC fallback uses stock CAS`, async () => {
    const db = paymentBackend({ drop: true, rpcError });
    await backend(db.handler, async () => {
      expect((await callbackGet(callbackRequest(signed()))).status).toBe(200);
      expect((await callbackGet(callbackRequest(signed()))).status).toBe(200);
    });
    expect(db.stats()).toMatchObject({ writes: 1, rpcs: 1, stockWrites: rpcError ? 1 : 0, finalizations: 1, notifications: 2 });
    expect(db.order).toMatchObject({ status: "paid", payment_status: "paid" });
    expect(db.order.paid_at).toBeTruthy();
  });
}
for (const options of [
  { rpcError: "XX000" }, { rpcError: "PGRST202", dropWriteFail: true }, { rpcError: "PGRST202", dropRace: true },
  { rpcError: "PGRST202", dropReadFail: true }, { rpcError: "PGRST202", insufficientStock: true }, { finalizeFail: true },
  { finalizeRace: true },
]) {
  test(`uncertain hot-drop side effect ${JSON.stringify(options)} stays pending and never replays mutations`, async () => {
    const db = paymentBackend({ drop: true, ...options });
    await backend(db.handler, async () => {
      expect((await callbackGet(callbackRequest(signed()))).status).toBe(503);
      expect((await callbackGet(callbackRequest(signed()))).status).toBe(503);
    });
    expect(db.order).toMatchObject({ payment_status: "paid", status: "pending", paid_at: null });
    expect(db.stats()).toMatchObject({ writes: 1, rpcs: 1, notifications: 0 });
    if (options.rpcError === "XX000") expect(db.stats().stockReads).toBe(0);
  });
}

test("retired browser arrival confirmation is 410 with zero DB and notification calls", async () => {
  await backend(() => { throw new Error("No backend allowed"); }, async () => {
    const response = await arrival();
    expect(response.status).toBe(410);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
});

test("per-order capability enforces server TTL, constant-time MAC, forgery and order isolation", () => {
  const now = 1800000000000;
  const access = cookie(orderNumber, now);
  const req = request("/order", undefined, { cookie: access });
  expect(hasOrderCapability(req, orderNumber, now)).toBe(true);
  expect(hasOrderCapability(req, orderNumber, now + ORDER_ACCESS_TTL_SECONDS * 1000 - 1)).toBe(true);
  expect(hasOrderCapability(req, orderNumber, now + ORDER_ACCESS_TTL_SECONDS * 1000)).toBe(false);
  expect(hasOrderCapability(req, orderNumber, now - 1000)).toBe(false);
  const other = "TRG-20261110-9999";
  expect(hasOrderCapability(request("/order", undefined, { cookie: access.replace(orderCookieName(orderNumber), orderCookieName(other)) }), other, now)).toBe(false);
  expect(hasOrderCapability(request("/order", undefined, { cookie: access.slice(0, -8) + "00000000" }), orderNumber, now)).toBe(false);
  expect(hasOrderCapability(request("/order", undefined, { cookie: `${access}; ${access}` }), orderNumber, now)).toBe(false);
  const source = readFileSync(resolve(__dirname, "../../lib/order-access.ts"), "utf8");
  expect(source).toContain("crypto.timingSafeEqual");
});

test("capability cookies are HttpOnly SameSite=Lax, 30d and Secure in production", () => {
  const previous = process.env.NODE_ENV;
  try {
    Object.assign(process.env, { NODE_ENV: "production" });
    const response = attachOrderCookie(NextResponse.json({ ok: true }), orderNumber);
    const set = response.headers.get("set-cookie")!;
    for (const expected of ["HttpOnly", "Secure", "SameSite=lax", `Max-Age=${ORDER_ACCESS_TTL_SECONDS}`, "Path=/"]) expect(set).toContain(expected);
    expect(response.headers.get("cache-control")).toContain("no-store");
  } finally { Object.assign(process.env, { NODE_ENV: previous }); }
});

test("96-bit cryptographic IDs have 37 chars, provider bound 40, and legacy IDs still build requests", () => {
  const numbers = Array.from({ length: 100 }, () => newOrderNumber("TRG"));
  expect(new Set(numbers).size).toBe(100);
  for (const number of [...numbers, newOrderNumber("KER")]) expect(number).toMatch(/^(TRG|KER)-\d{8}-[a-f0-9]{24}$/);
  expect(numbers.every(number => number.length === 37)).toBe(true);
  expect(buildPayseraRedirectUrl({ orderNumber, amountCents: 1234, buyerName: "Fixture", buyerEmail: "fixture@example.invalid", baseUrl: base })).toContain("https://www.paysera.com/pay/");
});

function accessBackend(user: Record<string, unknown> | null, order = fixtureOrder()): Handler {
  return (url) => {
    if (url.pathname === "/auth/v1/user") return user ? Response.json(user) : Response.json({ message: "fixture unauthorized" }, { status: 401 });
    if (url.pathname === "/rest/v1/orders") return Response.json(order);
    throw new Error(`Unexpected access call ${url.pathname}`);
  };
}
async function read(headers: Record<string, string> = {}, number = orderNumber) {
  return readOrder(request(`/api/orders/${number}`, undefined, headers), { params: Promise.resolve({ orderNumber: number }) });
}

for (const [name, user, allowed] of [
  ["buyer id", { id: "buyer", email: "changed@example.invalid" }, true],
  ["legacy confirmed email", { id: "legacy", email: "BUYER@example.invalid", email_confirmed_at: "2026-11-10" }, true],
  ["unconfirmed email", { id: "legacy", email: "buyer@example.invalid" }, false],
  ["other buyer", { id: "other", email: "other@example.invalid", email_confirmed_at: "2026-11-10" }, false],
  ["fake metadata admin", { id: "other", user_metadata: { is_super_admin: true } }, false],
  ["verified admin", { id: "admin", app_metadata: { is_super_admin: true } }, true],
] as Array<[string, Record<string, unknown>, boolean]>) {
  test(`${name} read/retry authorization; all responses no-store and denial has no PII`, async () => {
    await backend(accessBackend(user), async () => {
      const headers = { authorization: "Bearer dummy-user" };
      const response = await read(headers);
      expect(response.status).toBe(allowed ? 200 : 403);
      expect(response.headers.get("cache-control")).toContain("no-store");
      const text = await response.text();
      if (!allowed) for (const pii of ["buyer@example.invalid", "Fixture buyer", "Fixture locker"]) expect(text).not.toContain(pii);
      const retried = await retry(request("/retry", { orderNumber }, headers));
      expect(retried.status).toBe(allowed ? 200 : 403);
      expect(retried.headers.get("cache-control")).toContain("no-store");
    });
  });
}


test("already-paid callback still checks the actual persisted amount before acknowledging", async () => {
  const db = paymentBackend();
  Object.assign(db.order, { status: "paid", payment_status: "paid", paid_at: new Date().toISOString() });
  await backend(db.handler, async () => {
    expect((await callbackGet(callbackRequest(signed({ payamount: "100", paycurrency: "EUR" })))).status).toBe(400);
  });
  expect(db.stats()).toMatchObject({ writes: 0, notifications: 0 });
});
for (const state of ["cancelled", "refunded", "processing"]) {
  test(`signed paid callback cannot resurrect ${state} orders`, async () => {
    const db = paymentBackend();
    Object.assign(db.order, { status: state });
    await backend(db.handler, async () => {
      expect((await callbackGet(callbackRequest(signed()))).status).toBe(409);
    });
    expect(db.stats()).toMatchObject({ writes: 0, notifications: 0, rpcs: 0 });
  });
}
test("malformed hot-drop quantity fails before payment CAS", async () => {
  const db = paymentBackend({ drop: true });
  db.order.items[0].quantity = 0.5;
  await backend(db.handler, async () => expect((await callbackGet(callbackRequest(signed()))).status).toBe(409));
  expect(db.stats()).toMatchObject({ writes: 0, rpcs: 0, notifications: 0 });
});
test("canonical padded Base64 and uppercase MD5 remain compatible", async () => {
  const data = Buffer.from(new URLSearchParams(standardParams).toString()).toString("base64").replace(/\+/g, "-").replace(/\//g, "_");
  const ss1 = crypto.createHash("md5").update(data + process.env.PAYSERA_SIGN_PASSWORD).digest("hex").toUpperCase();
  const db = paymentBackend();
  await backend(db.handler, async () => expect((await callbackGet(callbackRequest({ data, ss1 }))).status).toBe(200));
});
test("malformed, JSON and oversized form callbacks cannot access DB", async () => {
  await backend(() => { throw new Error("No backend access"); }, async () => {
    for (const body of ["{}", "x".repeat(32769)]) {
      const response = await callbackPost(new Request(`${base}/callback`, {
        method: "POST", headers: { "content-type": body === "{}" ? "application/json" : "application/x-www-form-urlencoded" }, body,
      }));
      expect(response.status).toBe(400);
    }
  });
});
test("guest signed capability reads and retries without requiring a login", async () => {
  await backend(accessBackend(null), async () => {
    const headers = { cookie: cookie() };
    expect((await read(headers)).status).toBe(200);
    expect((await retry(request("/retry", { orderNumber }, headers))).status).toBe(200);
  });
});
for (const access of ["", "forged", "expired", "other-order"]) {
  test(`anonymous legacy/${access} guest access is generic denial and does not query DB`, async () => {
    await backend(() => { throw new Error("Unauthorized must not query orders"); }, async () => {
      const value = access === "expired" ? cookie(orderNumber, Date.now() - (ORDER_ACCESS_TTL_SECONDS + 1) * 1000)
        : access === "other-order" ? cookie("TRG-another-order") : access === "forged" ? `${orderCookieName(orderNumber)}=forged` : "";
      const headers = { cookie: value };
      expect((await read(headers)).status).toBe(403);
      expect((await read(headers, "TRG-does-not-exist")).status).toBe(403);
      expect((await retry(request("/retry", { orderNumber }, headers))).status).toBe(403);
    });
  });
}
test("ownership helper never trusts unconfirmed email or user-controlled admin metadata", () => {
  expect(userOwnsOrder({ id: "other", email: "buyer@example.invalid", user_metadata: { is_super_admin: true } } as unknown as User, fixtureOrder())).toBe(false);
});

test("normal guest checkout returns usable capability, preserves totals/Tukums/PIRMAIS and ignores malicious Host", async () => {
  let saved: Record<string, unknown> | null = null;
  await backend((url, init) => {
    if (url.pathname === "/rest/v1/listings") return Response.json([]);
    if (url.pathname === "/rest/v1/orders" && init.method === "POST") {
      saved = JSON.parse(String(init.body));
      return Response.json({ id: "fixture-order", order_number: saved!.order_number }, { status: 201 });
    }
    if (url.pathname === "/rest/v1/orders") return Response.json({ ...fixtureOrder(), ...saved });
    throw new Error(`No stock rewrite/schema or notifications permitted: ${url.pathname}`);
  }, async () => {
    const response = await checkout(request("/checkout", {
      items: [{ id: "fixture", title: "Fixture", price: 9.34, quantity: 1, sellerId: "seller" }],
      contact: { name: "Fixture", email: "fixture@example.invalid", phone: "12345" },
      sellerIds: ["seller"], totalCents: 1234, deliveryFeeCents: 300, promoCode: "PIRMAIS",
      deliveryType: "courier", deliveryInfo: { address: "Fixture street", city: "Tukums" },
    }, { host: "evil.example.invalid", "x-forwarded-proto": "http", "x-forwarded-host": "evil.example.invalid" }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.orderId).toMatch(/^TRG-\d{8}-[a-f0-9]{24}$/);
    const payload = new URLSearchParams(Buffer.from(new URL(body.paymentUrl).searchParams.get("data")!, "base64url").toString());
    for (const key of ["accepturl", "cancelurl", "callbackurl"]) expect(new URL(payload.get(key)!).origin).toBe(base);
    const returnedCookie = response.headers.get("set-cookie")!.split(";")[0];
    expect((await read({ cookie: returnedCookie }, body.orderId)).status).toBe(200);
    expect((await retry(request("/retry", { orderNumber: body.orderId }, { cookie: returnedCookie, host: "evil.example.invalid" }))).status).toBe(200);
  });
  expect(saved).toMatchObject({ total_cents: 1234, promo_code: null, delivery_type: "courier" });
});

test("authorized order read/retry DB errors return no-store 503 without PII", async () => {
  await backend(() => backendError(), async () => {
    const headers = { cookie: cookie() };
    for (const response of [await read(headers), await retry(request("/retry", { orderNumber }, headers))]) {
      expect(response.status).toBe(503);
      expect(response.headers.get("cache-control")).toContain("no-store");
      expect(await response.text()).not.toContain("buyer@example.invalid");
    }
  });
});
test("unrelated verified buyer cannot distinguish missing orders from someone else's order", async () => {
  const user = { id: "other", email: "other@example.invalid", email_confirmed_at: "2026-11-10" };
  let missing = false;
  await backend((url, init) => {
    if (url.pathname === "/rest/v1/orders" && missing) return Response.json({ code: "PGRST116" }, { status: 406 });
    return accessBackend(user)(url, init);
  }, async () => {
    const headers = { authorization: "Bearer fixture" };
    const existing = await read(headers);
    missing = true;
    const absent = await read(headers, "TRG-absent");
    expect([existing.status, absent.status]).toEqual([403, 403]);
    expect(await existing.text()).toBe(await absent.text());
  });
});
test("paid or cancelled orders cannot be retried by their guest capability", async () => {
  for (const [status, payment_status] of [["paid", "paid"], ["pending", "paid"], ["cancelled", "cancelled"]]) {
    await backend(accessBackend(null, { ...fixtureOrder(), status, payment_status }), async () => {
      const response = await retry(request("/retry", { orderNumber }, { cookie: cookie() }));
      expect(response.status).toBe(400);
      expect(response.headers.get("cache-control")).toContain("no-store");
    });
  }
});
test("drop checkout preserves existing reserve RPC; emits KER random ID and capability", async () => {
  let saved: Record<string, unknown> | undefined;
  await backend((url, init) => {
    if (url.pathname === "/auth/v1/user") return Response.json({ id: "buyer", email: "buyer@example.invalid" });
    if (url.pathname === "/rest/v1/hot_drops") return Response.json({
      id: "fixture-drop", status: "active", expires_at: new Date(Date.now() + 86400000).toISOString(),
      pickup_locker_id: "brivibas", price_cents: 617, total_quantity: 10, reserved_quantity: 0, sold_quantity: 0,
    });
    if (url.pathname === "/rest/v1/rpc/reserve_hot_drop") {
      expect(JSON.parse(String(init.body))).toMatchObject({ p_drop_id: "fixture-drop", p_quantity: 2, p_buyer_id: "buyer" });
      return Response.json({ id: "fixture-reservation" });
    }
    if (url.pathname === "/rest/v1/profiles") return Response.json({ full_name: "Fixture" });
    if (url.pathname === "/rest/v1/orders" && init.method === "POST") {
      saved = JSON.parse(String(init.body));
      return Response.json({ id: "fixture-order", order_number: saved!.order_number }, { status: 201 });
    }
    throw new Error(`Unexpected dummy-service call ${url.pathname}`);
  }, async () => {
    const response = await dropCheckout(request("/drop", { dropId: "fixture-drop", quantity: 2 }, { authorization: "Bearer fixture" }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.orderId).toMatch(/^KER-\d{8}-[a-f0-9]{24}$/);
    expect(hasOrderCapability(request("/order", undefined, { cookie: response.headers.get("set-cookie")!.split(";")[0] }), body.orderId)).toBe(true);
  });
  expect(saved).toMatchObject({ total_cents: 1234 });
});

test("production disables mock redirect/callback bypass; test/dev still require signed fixtures", () => {
  const previousNode = process.env.NODE_ENV, previousMode = process.env.PAYSERA_MODE;
  try {
    Object.assign(process.env, { NODE_ENV: "production", PAYSERA_MODE: "mock" });
    expect(() => getMode()).toThrow();
    expect(verifyPayseraCallback(signed().data, signed().ss1).valid).toBe(false);
    Object.assign(process.env, { NODE_ENV: "test" });
    expect(getMode()).toBe("mock");
    expect(verifyPayseraCallback(signed().data, "").valid).toBe(false);
    expect(verifyPayseraCallback(signed().data, signed().ss1).valid).toBe(true);
    expect(buildPayseraRedirectUrl({ orderNumber, amountCents: 1234, buyerName: "Fixture", buyerEmail: "fixture@example.invalid", baseUrl: base })).toContain("/cart/success?");
    Object.assign(process.env, { PAYSERA_MODE: "live" });
    expect(verifyPayseraCallback(signed({ test: "0" }).data, signed({ test: "0" }).ss1).valid).toBe(true);
    expect(verifyPayseraCallback(signed().data, signed().ss1).valid).toBe(false);
  } finally { Object.assign(process.env, { NODE_ENV: previousNode, PAYSERA_MODE: previousMode }); }
});

test("trusted return origin does not use request Host and rejects malformed configuration", () => {
  const previous = process.env.NEXT_PUBLIC_SITE_URL;
  try {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(trustedPaymentBaseUrl()).toBe("https://tirgus.izipizi.lv");
    for (const invalid of ["https://user:password@example.invalid", "https://example.invalid/path", "javascript:alert(1)", "https://example.invalid?query=x"]) {
      process.env.NEXT_PUBLIC_SITE_URL = invalid;
      expect(() => trustedPaymentBaseUrl()).toThrow();
    }
  } finally { process.env.NEXT_PUBLIC_SITE_URL = previous; }
});

test("success browser source has auth/cookie read-only polling and graceful legacy access copy", () => {
  const source = readFileSync(resolve(__dirname, "../../app/cart/success/page.tsx"), "utf8");
  expect(source).not.toContain("confirm-arrival");
  expect(source).not.toContain("nav DB");
  expect(source).not.toContain("Apstiprinājums nosūtīts");
  expect(source).toContain("Piekļuve pasūtījumam nav apstiprināta");
  expect(source).toContain('credentials: "same-origin"');
  expect(source).toContain("Bearer ${session.access_token}");
  expect(source).toContain('cache: "no-store"');
});
