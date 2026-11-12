import { test, expect } from "@playwright/test";
import { createMarketplaceHttpTransport, configuredMarketplaceHttpTransport } from "../../lib/marketplace-handoff-http";
import { transferMarketplaceHandoff } from "../../lib/marketplace-handoff";
import { createClient } from "@supabase/supabase-js";
import { POST as adminHandoff } from "../../app/api/admin/marketplace-handoff/route";
const id = "11111111-1111-4111-8111-111111111111";
const receiverId = "22222222-2222-4222-8222-222222222222";
const sourceKey = `marketplace/persisted_id/${id}`;
const settings = { endpoint: "https://receiver.example.invalid/intakes",
  approvedOrigin: "https://receiver.example.invalid", token: "nonfunctional-synthetic-token-only-12345" };
const job = () => ({ order_id: id, source_key: sourceKey, claim_token: receiverId,
  envelope: { schema: "marketplace-order-v1", record: { id }, sellerSnapshots: [] } });
const ack = () => ({ recorded: true, sourceKey, receiverId, intakeVersion: "logistics-intake-v1",
  dispatchAuthorized: false, billingAuthorized: false });
let original: typeof fetch;
test.beforeEach(() => { original = globalThis.fetch; });
test.afterEach(() => {
  globalThis.fetch = original;
  for (const key of ["MARKETPLACE_LOGISTICS_RECEIVER_URL", "MARKETPLACE_LOGISTICS_RECEIVER_ORIGIN",
    "MARKETPLACE_LOGISTICS_RECEIVER_TOKEN", "MARKETPLACE_LOGISTICS_HANDOFF", "MARKETPLACE_LIFECYCLE_V1"]) delete process.env[key];
});
test("HTTP transport authenticates to pinned origin, uses stable source idempotency and never authorizes work", async () => {
  const requests: RequestInit[] = [];
  globalThis.fetch = async (url, init) => {
    expect(String(url)).toBe(settings.endpoint);
    requests.push(init!);
    return Response.json(ack(), { status: 201 });
  };
  const send = createMarketplaceHttpTransport(settings);
  expect((await send(job())).dispatchAuthorized).toBe(false);
  await send(job());
  expect(requests).toHaveLength(2);
  expect(requests[0].body).toBe(requests[1].body);
  const headers = new Headers(requests[0].headers);
  expect(headers.get("authorization")).toBe(`Bearer ${settings.token}`);
  expect(headers.get("idempotency-key")).toBe(`marketplace-intake/${id}`);
  expect(requests[0]).toMatchObject({ redirect: "error", cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer" });
  expect(requests[0].signal).toBeInstanceOf(AbortSignal);
});
for (const patch of [
  { recorded: false }, { sourceKey: "different" }, { receiverId: "22222222" },
  { intakeVersion: "unknown" }, { dispatchAuthorized: true }, { billingAuthorized: true },
]) {
  test(`untrusted acknowledgement ${JSON.stringify(patch)} cannot record a handoff`, async () => {
    globalThis.fetch = async () => Response.json({ ...ack(), ...patch });
    await expect(createMarketplaceHttpTransport(settings)(job())).rejects.toThrow("requires reconciliation");
  });
}
for (const status of [202, 204, 302, 401, 409, 500]) {
  test(`HTTP ${status} is not a persisted acknowledgement`, async () => {
    globalThis.fetch = async () => new Response(null, { status });
    await expect(createMarketplaceHttpTransport(settings)(job())).rejects.toThrow("requires reconciliation");
  });
}
test("oversize streamed response without Content-Length, invalid JSON and HTML fail closed", async () => {
  for (const response of [
    new Response("x".repeat(17000), { headers: { "content-type": "application/json" } }),
    new Response("{", { headers: { "content-type": "application/json" } }),
    new Response("<html>not a receipt</html>", { headers: { "content-type": "text/html" } }),
    new Response(JSON.stringify(ack()), { headers: { "content-type": "application/jsonp" } }),
  ]) {
    globalThis.fetch = async () => response;
    await expect(createMarketplaceHttpTransport(settings)(job())).rejects.toThrow("requires reconciliation");
  }
});
test("timeouts do not expose target credentials, provider messages or customer envelopes", async () => {
  globalThis.fetch = async () => { throw new Error("private-token-and-customer-address"); };
  await expect(createMarketplaceHttpTransport(settings)(job())).rejects.toThrow("Receiver outcome requires reconciliation");
});
for (const endpoint of [
  "http://receiver.example.invalid/intakes", "https://user:password@receiver.example.invalid/intakes",
  "https://receiver.example.invalid:8443/intakes", "https://127.0.0.1/intakes",
  "https://[::1]/intakes", "https://service.local/intakes",
  "https://receiver.example.invalid/intakes?token=x", "https://receiver.example.invalid/intakes#fragment",
  "https://other.example.invalid/intakes",
]) {
  test(`invalid receiver configuration is rejected before network: ${endpoint}`, () => {
    expect(() => createMarketplaceHttpTransport({ ...settings, endpoint })).toThrow();
  });
}
test("incomplete configuration and mismatched envelope fail before claim or HTTP", async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error("No network permitted"); };
  process.env.MARKETPLACE_LOGISTICS_RECEIVER_URL = settings.endpoint;
  process.env.MARKETPLACE_LIFECYCLE_V1 = "enabled";
  process.env.MARKETPLACE_LOGISTICS_HANDOFF = "enabled";
  expect(() => configuredMarketplaceHttpTransport()).toThrow("Incomplete");
  await expect(transferMarketplaceHandoff(createClient("https://example.invalid", "nonfunctional-key"), id)).rejects.toThrow("Incomplete");
  await expect(createMarketplaceHttpTransport(settings)({ ...job(), source_key: "wrong" })).rejects.toThrow("source identity");
  expect(calls).toBe(0);
});
for (const accepted of [true, false]) {
  test(`admin transfer ${accepted ? "records" : "reviews"} only a pinned receiver result, never a client-supplied target`, async () => {
    process.env.MARKETPLACE_LIFECYCLE_V1 = "enabled";
    process.env.MARKETPLACE_LOGISTICS_HANDOFF = "enabled";
    process.env.MARKETPLACE_LOGISTICS_RECEIVER_URL = settings.endpoint;
    process.env.MARKETPLACE_LOGISTICS_RECEIVER_ORIGIN = settings.approvedOrigin;
    process.env.MARKETPLACE_LOGISTICS_RECEIVER_TOKEN = settings.token;
    const calls: string[] = [];
    globalThis.fetch = async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      calls.push(url.origin);
      if (url.origin === settings.approvedOrigin) {
        expect(new Headers(init?.headers).get("authorization")).toBe(`Bearer ${settings.token}`);
        return Response.json({ ...ack(), recorded: accepted });
      }
      expect(url.origin).toBe("https://example.invalid");
      if (url.pathname === "/auth/v1/user") return Response.json({ id, app_metadata: { is_super_admin: true } });
      if (url.pathname.endsWith("/marketplace_claim_handoff_v1")) return Response.json(job());
      expect(url.pathname).toMatch(/marketplace_finish_handoff_v1$/);
      expect(JSON.parse(String(init?.body)).p_accepted).toBe(accepted);
      return Response.json({ state: accepted ? "recorded" : "review" });
    };
    const response = await adminHandoff(new Request("https://example.invalid/transfer", {
      method: "POST", headers: { authorization: "Bearer synthetic-admin" },
      body: JSON.stringify({ action: "transfer", orderId: id, url: "https://attacker.example.invalid" }),
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: accepted, state: accepted ? "recorded" : "review",
      dispatchAuthorized: false, billingAuthorized: false });
    expect(calls).not.toContain("https://attacker.example.invalid");
  });
}
