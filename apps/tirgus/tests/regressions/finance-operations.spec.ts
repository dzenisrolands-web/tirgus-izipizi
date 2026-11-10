import { test, expect } from "@playwright/test";
import * as finance from "../../app/api/admin/finance/route";
import * as statusRoute from "../../app/api/admin/update-order-status/route";
import * as cron from "../../app/api/cron/order-reminders/route";

const orderId = "a0000000-0000-0000-0000-000000000001";
const adminId = "a0000000-0000-0000-0000-000000000002";
const body = {
  entityId: orderId, entityType: "order", action: "complete", reason: "Documented cancellation",
  evidence: "External provider statement fixture", reference: "TEST-REFUND-001", amountCents: 1210,
  verifiedExternal: true, externallyRefundedAt: "2026-01-01T12:00:00Z",
};
const request = (url: string, json: object) => new Request(`https://example.invalid/api/${url}`, {
  method: "POST", headers: { authorization: "Bearer dummy-test-token", "content-type": "application/json" },
  body: JSON.stringify(json),
});

test("successful paid fulfillment writes status only and preserves payment facts", async () => {
  let writes = 0;
  const restore = withBackend((url, init) => {
    expect(url.pathname).toBe("/rest/v1/orders");
    if (init?.method === "PATCH") {
      writes++;
      expect(JSON.parse(String(init.body))).toEqual({ status: "processing" });
      expect(url.searchParams.get("payment_review_reason")).toBe("is.null");
      return Response.json([{ id: orderId }]);
    }
    return Response.json({ id: orderId, order_number: "TEST", status: "paid", payment_status: "paid",
      paid_at: "2026-01-01", payment_review_reason: null, buyer_id: null, buyer_email: null });
  });
  try {
    const response = await statusRoute.POST(request("admin/update-order-status", { orderId, status: "processing" }));
    expect(response.status).toBe(200);
    expect((await response.json()).updates).toEqual({ status: "processing" });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(writes).toBe(1);
  } finally { restore(); }
});

function withBackend(handler: (url: URL, init?: RequestInit) => Promise<Response> | Response) {
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    expect(url.origin).toBe("https://example.invalid");
    if (url.pathname === "/auth/v1/user") return Response.json({ id: adminId, app_metadata: { is_super_admin: true } });
    return handler(url, init);
  };
  return () => { globalThis.fetch = original; };
}

test("manual completion requires exact positive cents, past time, independent confirmation and evidence", async () => {
  const restore = withBackend(() => { throw new Error("Invalid refund must not call database/provider"); });
  try {
    for (const changes of [
      { verifiedExternal: false }, { amountCents: 0 }, { amountCents: 12.1 }, { externallyRefundedAt: "not-a-date" },
      { externallyRefundedAt: "2999-01-01" }, { evidence: "" }, { reason: "short" }, { reference: "" },
      { entityId: "not-a-uuid" },
    ]) expect((await finance.POST(request("admin/finance", { ...body, ...changes }))).status).toBe(400);
  } finally { restore(); }
});

test("manual completion records authenticated actor and externally verified evidence only via atomic RPC", async () => {
  let calls = 0;
  const restore = withBackend((url, init) => {
    expect(url.pathname).toBe("/rest/v1/rpc/complete_manual_refund");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({
      p_actor_id: adminId, p_reason: body.reason, p_evidence: body.evidence,
      p_order_id: orderId, p_amount_cents: 1210, p_provider_reference: body.reference,
      p_verified_external: true, p_externally_refunded_at: "2026-01-01T12:00:00.000Z",
    });
    calls++;
    return Response.json({ status: "completed", idempotent: false });
  });
  try {
    expect((await finance.POST(request("admin/finance", { ...body, actorId: "spoofed" }))).status).toBe(200);
    expect(calls).toBe(1);
  } finally { restore(); }
});

test("database conflict is exposed without fallback, money movement or guessed amounts", async () => {
  const restore = withBackend((url) => {
    expect(url.pathname).toBe("/rest/v1/rpc/complete_manual_refund");
    return Response.json({ message: "Exact amount and verified external refund evidence required", code: "P0001" }, { status: 400 });
  });
  try {
    const res = await finance.POST(request("admin/finance", body));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain("Exact amount");
  } finally { restore(); }
});

test("read-only financial review can page historical findings without data writes", async () => {
  const paths: string[] = [];
  const restore = withBackend((url, init) => {
    paths.push(url.pathname);
    expect(["GET", undefined]).toContain(init?.method);
    expect(url.searchParams.get("offset")).toBe("100");
    return Response.json([]);
  });
  try {
    const res = await finance.GET(new Request("https://example.invalid/api/admin/finance?page=1", { headers: { authorization: "Bearer dummy-test-token" } }));
    expect(res.status).toBe(200);
    expect(paths.sort()).toEqual(["/rest/v1/finance_refund_queue", "/rest/v1/finance_review_events", "/rest/v1/rpc/finance_issues"].sort());
  } finally { restore(); }
});

test("admin cannot fabricate payment, reset awaiting or advance an unpaid order", async () => {
  const restore = withBackend((url, init) => {
    expect(url.pathname).toBe("/rest/v1/orders");
    expect(init?.method).toBe("GET");
    return Response.json({ id: orderId, status: "pending", payment_status: "awaiting", paid_at: null, payment_review_reason: null });
  });
  try {
    for (const status of ["paid", "processing", "shipped", "delivered", "pending", "bogus"]) {
      expect((await statusRoute.POST(request("admin/update-order-status", { orderId, status }))).status).toBe(409);
    }
  } finally { restore(); }
});

test("admin cancellation uses reservation RPC and never overwrites paid evidence", async () => {
  const calls: string[] = [];
  const restore = withBackend((url, init) => {
    calls.push(`${init?.method} ${url.pathname}`);
    if (url.pathname === "/rest/v1/orders") return Response.json({
      id: orderId, status: "paid", payment_status: "paid", paid_at: "2026-01-01", payment_review_reason: null,
    });
    expect(url.pathname).toBe("/rest/v1/rpc/cancel_order_with_review");
    expect(JSON.parse(String(init?.body))).toEqual({ p_order_id: orderId, p_reason: "admin_cancel:Buyer requested cancellation", p_actor_id: adminId });
    return Response.json(true);
  });
  try {
    expect((await statusRoute.POST(request("admin/update-order-status", { orderId, status: "cancelled", reason: "Buyer requested cancellation" }))).status).toBe(200);
    expect(calls).toHaveLength(2);
  } finally { restore(); }
});

test("concurrent fulfillment cancellation does not report success or send notifications", async () => {
  const restore = withBackend((url, init) => {
    expect(url.pathname).toBe("/rest/v1/orders");
    if (init?.method === "GET") return Response.json({ id: orderId, status: "paid", payment_status: "paid", paid_at: "2026-01-01", payment_review_reason: null });
    expect(JSON.parse(String(init?.body))).toEqual({ status: "processing" });
    expect(url.searchParams.get("status")).toBe("eq.paid");
    expect(url.searchParams.get("payment_status")).toBe("eq.paid");
    return Response.json([]);
  });
  try {
    expect((await statusRoute.POST(request("admin/update-order-status", { orderId, status: "processing" }))).status).toBe(409);
  } finally { restore(); }
});

test("72h cron uses cancellation RPC and counts no-op races without notification", async () => {
  process.env.CRON_SECRET = "test-local-cron-secret";
  let rpc = 0;
  const restore = withBackend((url, init) => {
    if (url.pathname === "/rest/v1/rpc/cancel_order_with_review") {
      expect(JSON.parse(String(init?.body))).toEqual({ p_order_id: orderId, p_reason: "auto_cancel_unconfirmed_72h", p_actor_id: null });
      rpc++; return Response.json(false);
    }
    expect(url.pathname).toBe("/rest/v1/orders");
    expect(init?.method).toBe("GET");
    if (url.searchParams.has("paid_at") && url.searchParams.get("paid_at")?.startsWith("lte.")) return Response.json([{ id: orderId }]);
    return Response.json([]);
  });
  try {
    const response = await cron.GET(new Request("https://example.invalid/api/cron/order-reminders", { headers: { authorization: "Bearer test-local-cron-secret" } }));
    expect(response.status).toBe(200);
    expect((await response.json()).cancelled).toBe(0);
    expect(rpc).toBe(1);
  } finally { restore(); delete process.env.CRON_SECRET; }
});

test("72h cancellation database failure is not reported as a successful cron run", async () => {
  process.env.CRON_SECRET = "test-local-cron-secret";
  const restore = withBackend((url) => {
    if (url.pathname === "/rest/v1/rpc/cancel_reserved_order") {
      return Response.json({ code: "P0001", message: "Finance queue unavailable" }, { status: 400 });
    }
    expect(url.pathname).toBe("/rest/v1/orders");
    return Response.json(url.searchParams.get("paid_at")?.startsWith("lte.") ? [{ id: orderId }] : []);
  });
  try {
    const response = await cron.GET(new Request("https://example.invalid/api/cron/order-reminders", { headers: { authorization: "Bearer test-local-cron-secret" } }));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ ok: false, cancelled: 0, cancellationErrors: 1 });
  } finally { restore(); delete process.env.CRON_SECRET; }
});
