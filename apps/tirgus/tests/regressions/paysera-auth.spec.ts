import { test, expect } from "@playwright/test";
import { GET, POST } from "../../app/api/admin/paysera-diagnostics/route";

const handlers = { GET, POST };
const endpoint = "https://example.invalid/api/admin/paysera-diagnostics";

async function exercise(user: unknown, expectedGet: number, expectedPost = expectedGet) {
  const original = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    calls.push(url.pathname);
    if (url.pathname === "/auth/v1/user") {
      return user ? Response.json(user) : Response.json({ message: "Invalid token" }, { status: 401 });
    }
    if (url.pathname === "/rest/v1/orders" && (init?.method ?? "GET") === "GET") {
      return Response.json([]);
    }
    throw new Error(`Forbidden backend operation: ${init?.method} ${url.pathname}`);
  };
  try {
    for (const [method, handler] of Object.entries(handlers)) {
      const response = await handler(new Request(endpoint, {
        method, headers: { authorization: "Bearer regression-token", "content-type": "application/json" },
        ...(method === "POST" ? { body: "{}" } : {}),
      }));
      expect(response.status).toBe(method === "GET" ? expectedGet : expectedPost);
    }
    if (expectedGet !== 200) expect(calls.every(p => p === "/auth/v1/user")).toBe(true);
  } finally { globalThis.fetch = original; }
}

for (const [label, metadata] of [
  ["ordinary buyer", { app_metadata: {}, user_metadata: {} }],
  ["user-writable fake administrator", { app_metadata: {}, user_metadata: { is_super_admin: true, role: "admin" } }],
  ["string-valued admin flag", { app_metadata: { is_super_admin: "true" }, user_metadata: {} }],
] as const) {
  test(`${label} cannot read or mutate payment diagnostics`, async () => {
    await exercise({ id: "user", aud: "authenticated", ...metadata }, 403);
  });
}

test("anonymous requests return 401 without reaching a backend", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("Anonymous requests must not query a backend"); };
  try {
    for (const [method, handler] of Object.entries(handlers)) {
      expect((await handler(new Request(endpoint, { method }))).status).toBe(401);
    }
  } finally { globalThis.fetch = original; }
});

test("invalid tokens return 401 for both methods", async () => {
  await exercise(null, 401);
});

test("verified true super-admin can read, but empty POST cannot mutate orders", async () => {
  await exercise({ id: "admin", aud: "authenticated", app_metadata: { is_super_admin: true } }, 200, 400);
});
