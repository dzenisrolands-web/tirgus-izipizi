import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { POST as approve } from "../../app/api/admin/approve-seller/route";
import { POST as slugs } from "../../app/api/admin/generate-slugs/route";
import { GET as diagnostics, POST as manualPaid } from "../../app/api/admin/paysera-diagnostics/route";
import { POST as shipment } from "../../app/api/shipments/create-from-order/route";
import { POST as statusNotify } from "../../app/api/notify/order-status/route";
import { POST as dropNotify } from "../../app/api/push/notify/route";
import { POST as subscribe, DELETE as unsubscribe } from "../../app/api/push/subscribe/route";
import { GET as expire } from "../../app/api/cron/expire-drops/route";
import { GET as reminders } from "../../app/api/cron/order-reminders/route";
import { GET as invites } from "../../app/api/cron/send-invites/route";
import { safeInternalRedirect } from "../../lib/safe-redirect";
import { isAllowedPushEndpoint, sendPushToSubscriptions } from "../../lib/push";
import { POST as confirmOrder } from "../../app/api/seller/confirm-order/route";
import webpush from "web-push";

const request = (body: unknown = {}, token: string | null = "fixture", method = "POST") =>
  new Request("https://example.invalid/api/test", {
    method, headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    ...(method !== "GET" ? { body: JSON.stringify(body) } : {}),
  });
type Handler = (url: URL, init?: RequestInit) => Response;
async function backend(handler: Handler, run: () => Promise<void>) {
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.origin !== "https://example.invalid") throw new Error("Non-dummy network forbidden");
    return handler(url, init);
  };
  try { await run(); } finally { globalThis.fetch = original; }
}
const user = (admin = false) => Response.json({
  id: "user", app_metadata: { is_super_admin: admin }, user_metadata: { is_super_admin: true },
});

test("admin metadata must be boolean true, never truthy or user-editable", async () => {
  for (const metadata of [{ is_super_admin: "true" }, { is_super_admin: 1 }, {}]) {
    await backend(url => {
      expect(url.pathname).toBe("/auth/v1/user");
      return Response.json({ id: "user", app_metadata: metadata, user_metadata: { is_super_admin: true } });
    }, async () => {
      for (const route of [approve, slugs, diagnostics, manualPaid]) expect((await route(request())) .status).toBe(403);
    });
  }
});

test("null or malformed payloads do not bypass authenticated field validation", async () => {
  await backend(url => { expect(url.pathname).toBe("/auth/v1/user"); return user(true); }, async () => {
    for (const route of [approve, manualPaid, shipment, statusNotify, dropNotify, subscribe, confirmOrder]) {
      expect((await route(request(null))).status).toBe(400);
    }
  });
});

test("valid subscription is owner-scoped and upsert errors are not success", async () => {
  for (const broken of [false, true]) await backend((url, init) => {
    if (url.pathname === "/auth/v1/user") return user();
    expect(url.pathname).toBe("/rest/v1/push_subscriptions");
    expect(JSON.parse(String(init?.body)).user_id).toBe("user");
    return broken ? fail() : new Response(null, { status: 201 });
  }, async () => expect((await subscribe(request({
    endpoint: "https://fcm.googleapis.com/fcm/send/fixture", p256dh: "a".repeat(87), auth: "b".repeat(22),
  }))).status).toBe(broken ? 500 : 200));
});

test("cron losing a cancellation race does not count it or notify", async () => {
  process.env.CRON_SECRET = "dummy-cron";
  try {
    let reads = 0;
    await backend((url, init) => {
      expect(url.pathname).toBe("/rest/v1/orders");
      if (init?.method === "PATCH") {
        expect(url.searchParams.get("status")).toBe("eq.paid");
        expect(url.searchParams.get("payment_status")).toBe("eq.paid");
        return Response.json([]);
      }
      reads++;
      return Response.json(reads === 1 ? [{ id: "order" }] : []);
    }, async () => {
      const result = await reminders(request({}, "dummy-cron", "GET"));
      expect(result.status).toBe(200);
      expect(await result.json()).toMatchObject({ cancelled: 0, reminded: 0 });
    });
  } finally { delete process.env.CRON_SECRET; }
});
const fail = () => Response.json({ message: "fixture DB failure", code: "XX000" }, { status: 500 });
const order = {
  id: "order", order_number: "TRG-fixture", payment_status: "paid", status: "processing",
  seller_ids: ["seller"], items: [{ seller_id: "seller" }], delivery_info: { locker_id: "brivibas" },
};
const seller = { id: "seller", user_id: "user", name: "Fixture", home_locker_ids: ["brivibas"] };

for (const [name, route, method] of [
  ["approve", approve, "POST"], ["slugs", slugs, "POST"],
  ["diagnostics GET", diagnostics, "GET"], ["diagnostics POST", manualPaid, "POST"],
] as const) {
  test(`${name}: anonymous, invalid, ordinary and fake metadata cannot reach private tables`, async () => {
    await backend(url => {
      expect(url.pathname).toBe("/auth/v1/user");
      return user();
    }, async () => {
      expect((await route(request({}, null, method))).status).toBe(401);
      expect((await route(request({}, "fixture", method))).status).toBe(403);
    });
    await backend(url => {
      expect(url.pathname).toBe("/auth/v1/user");
      return Response.json({ message: "invalid token" }, { status: 401 });
    }, async () => expect((await route(request({}, "bad", method))).status).toBe(401));
  });
}

test("admin diagnostics POST validates missing payload then returns 410 without queries or notifications", async () => {
  await backend(url => { expect(url.pathname).toBe("/auth/v1/user"); return user(true); }, async () => {
    expect((await manualPaid(request({}))).status).toBe(400);
    expect((await manualPaid(request({ orderNumber: "TRG-fixture" }))).status).toBe(410);
  });
});

test("admin slugs has no runtime SQL and propagates DB failures", async () => {
  for (const broken of [false, true]) {
    await backend((url, init) => {
      if (url.pathname === "/auth/v1/user") return user(true);
      expect(url.pathname).toBe("/rest/v1/sellers");
      if (broken) return fail();
      expect(init?.method ?? "GET").toBe("GET");
      return Response.json([{ id: "s", name: "Fixture", slug: "fixture" }]);
    }, async () => expect((await slugs(request())).status).toBe(broken ? 500 : 200));
  }
});

test("admin approval and diagnostics do not hide query or mutation errors", async () => {
  await backend(url => url.pathname === "/auth/v1/user" ? user(true) : fail(), async () => {
    expect((await diagnostics(request({}, "fixture", "GET"))).status).toBe(500);
    expect((await approve(request({ sellerId: "seller" }))).status).not.toBe(200);
  });
  await backend((url, init) => {
    if (url.pathname === "/auth/v1/user") return user(true);
    if (init?.method === "PATCH") return fail();
    return Response.json({ ...seller, email: null, slug: "fixture" });
  }, async () => expect((await approve(request({ sellerId: "seller" }))).status).toBe(500));
});

for (const [name, changed, expected] of [
  ["unpaid", { payment_status: "awaiting" }, 409],
  ["cancelled", { status: "cancelled" }, 409],
  ["pending", { status: "paid" }, 409],
  ["other seller", { seller_ids: ["other"], items: [] }, 403],
  ["multi seller", { seller_ids: ["seller", "other"] }, 409],
  ["closed locker", { delivery_info: { locker_id: "tukums" } }, 409],
] as const) {
  test(`shipment rejects ${name} before writes`, async () => {
    await backend((url, init) => {
      expect(init?.method ?? "GET").toBe("GET");
      if (url.pathname === "/auth/v1/user") return user();
      if (url.pathname === "/rest/v1/orders") return Response.json({ ...order, ...changed });
      if (url.pathname === "/rest/v1/sellers") return Response.json(seller);
      throw new Error("No outbound deliveries");
    }, async () => expect((await shipment(request({ orderId: "order", size: "M", lockerCode: "1234" }))).status).toBe(expected));
  });
}

for (const result of ["success", "missing-logistics", "update-error", "race"] as const) {
  test(`shipment ${result}: order write confirmed; optional table not mandatory`, async () => {
    let confirmed = false;
    await backend((url, init) => {
      if (url.pathname === "/auth/v1/user") return user();
      if (url.pathname === "/rest/v1/orders") {
        if (init?.method === "PATCH") {
          expect(url.searchParams.get("status")).toBe("eq.processing");
          expect(url.searchParams.get("payment_status")).toBe("eq.paid");
          if (result === "update-error") return fail();
          if (result === "race") return Response.json(null);
          confirmed = true;
          return Response.json({ id: "order" });
        }
        return Response.json(order);
      }
      if (url.pathname === "/rest/v1/sellers") return Response.json(seller);
      expect(url.pathname).toBe("/rest/v1/sutijumi");
      expect(confirmed).toBe(true);
      return result === "missing-logistics" ? fail() : new Response(null, { status: 201 });
    }, async () => {
      const response = await shipment(request({ orderId: "order", size: "M", lockerCode: "1234" }));
      expect(response.status).toBe(result === "update-error" ? 500 : result === "race" ? 409 : 200);
      const body = await response.json();
      if (response.ok) expect(body.logisticsRecorded).toBe(result === "success");
      else expect(body.label).toBeUndefined();
    });
  });
}

test("admin can coordinate selected seller for multi-seller shipment", async () => {
  await backend((url, init) => {
    if (url.pathname === "/auth/v1/user") return user(true);
    if (url.pathname === "/rest/v1/orders") return Response.json(init?.method === "PATCH" ? { id: "order" } : { ...order, seller_ids: ["seller", "other"] });
    if (url.pathname === "/rest/v1/sellers") { expect(url.searchParams.get("id")).toBe("eq.seller"); return Response.json(seller); }
    if (url.pathname === "/rest/v1/sutijumi") return fail();
    throw new Error("Unexpected delivery");
  }, async () => expect((await shipment(request({ orderId: "order", size: "XL", lockerCode: "123456", sellerId: "seller" }))).status).toBe(200));
});

test("shipment rejects invalid size and code before querying orders", async () => {
  await backend(url => { expect(url.pathname).toBe("/auth/v1/user"); return user(); }, async () => {
    for (const body of [{ size: "bad", lockerCode: "1234" }, { size: "M", lockerCode: "<script>" }]) {
      expect((await shipment(request({ orderId: "order", ...body }))).status).toBe(400);
    }
  });
});

for (const admin of [false, true]) {
  test(`status notification checks persisted payment/status (${admin ? "admin" : "seller"})`, async () => {
    await backend(url => {
      if (url.pathname === "/auth/v1/user") return user(admin);
      if (url.pathname === "/rest/v1/orders") return Response.json(order);
      if (url.pathname === "/rest/v1/sellers") return Response.json(seller);
      throw new Error("Spoof must never reach notification audience");
    }, async () => expect((await statusNotify(request({ orderId: "order", status: "shipped" }))).status).toBe(409));
  });
}

test("unrelated seller cannot send order or drop notifications", async () => {
  await backend(url => {
    if (url.pathname === "/auth/v1/user") return user();
    if (url.pathname === "/rest/v1/orders") return Response.json(order);
    if (url.pathname === "/rest/v1/hot_drops") return Response.json({ id: "drop", seller_id: "seller" });
    if (url.pathname === "/rest/v1/sellers") return Response.json({ id: "other", user_id: "other" });
    throw new Error("No audience reads or deliveries permitted");
  }, async () => {
    expect((await statusNotify(request({ orderId: "order", status: "processing" }))).status).toBe(403);
    expect((await dropNotify(request({ dropId: "drop" }))).status).toBe(403);
  });
});

test("drop owner and admin can reach empty audience without delivery", async () => {
  for (const admin of [false, true]) await backend(url => {
    if (url.pathname === "/auth/v1/user") return user(admin);
    if (url.pathname === "/rest/v1/hot_drops") return Response.json({ id: "drop", seller_id: "seller", pickup_locker_id: "brivibas" });
    if (url.pathname === "/rest/v1/sellers") return Response.json(seller);
    if (["/rest/v1/seller_followers", "/rest/v1/locker_subscriptions"].includes(url.pathname)) return Response.json([]);
    throw new Error("No delivery permitted");
  }, async () => expect((await dropNotify(request({ dropId: "drop" }))).status).toBe(200));
});

test("crons fail closed without secret; invites manual execution requires real admin", async () => {
  delete process.env.CRON_SECRET;
  await backend(url => { expect(url.pathname).toBe("/auth/v1/user"); return user(); }, async () => {
    for (const route of [expire, reminders, invites]) expect((await route(request({}, null, "GET"))).status).toBe(401);
    expect((await invites(request({}, "fixture", "GET"))).status).toBe(403);
  });
  await backend(url => {
    if (url.pathname === "/auth/v1/user") return user(true);
    expect(url.pathname).toBe("/rest/v1/invitations");
    return Response.json([]);
  }, async () => expect((await invites(request({}, "fixture", "GET"))).status).toBe(200));
});

test("authenticated cron paths use dummy existing schema only and expose query failures", async () => {
  process.env.CRON_SECRET = "dummy-cron";
  try {
    await backend(url => {
      if (url.pathname === "/rest/v1/rpc/expire_stale_data") return Response.json(null);
      if (url.pathname === "/rest/v1/orders") { expect(url.searchParams.get("payment_status")).toBe("eq.paid"); return Response.json([]); }
      throw new Error("Unexpected outbound");
    }, async () => {
      expect((await expire(request({}, "dummy-cron", "GET"))).status).toBe(200);
      expect((await reminders(request({}, "dummy-cron", "GET"))).status).toBe(200);
    });
    await backend(() => fail(), async () => expect((await reminders(request({}, "dummy-cron", "GET"))).status).toBe(500));
  } finally { delete process.env.CRON_SECRET; }
});

test("push providers allowlist rejects SSRF, deceptive hosts and credentials", async () => {
  for (const url of [
    "https://fcm.googleapis.com/fcm/send/fixture", "https://updates.push.services.mozilla.com/wpush/v2/fixture",
    "https://web.push.apple.com/fixture", "https://wns.notify.windows.com/fixture",
  ]) expect(isAllowedPushEndpoint(url)).toBe(true);
  for (const url of [
    "http://fcm.googleapis.com/fixture", "https://localhost/fixture", "https://127.0.0.1/fixture",
    "https://fcm.googleapis.com.example.invalid/fixture", "https://example.invalid/fixture",
    "https://user@fcm.googleapis.com/fixture", "https://fcm.googleapis.com:8443/fixture",
  ]) expect(isAllowedPushEndpoint(url)).toBe(false);
  await backend(() => { throw new Error("No push delivery allowed"); }, async () => {
    expect(await sendPushToSubscriptions([{ endpoint: "https://127.0.0.1/private", p256dh: "dummy", auth: "dummy" }],
      { title: "fixture", body: "fixture", url: "/" })).toMatchObject({ sent: 0, failed: 1 });
  });
});

test("push subscription rejects unsafe endpoints; deletion stays owner-scoped and reports DB failure", async () => {
  await backend((url, init) => {
    if (url.pathname === "/auth/v1/user") return user();
    expect(url.pathname).toBe("/rest/v1/push_subscriptions");
    expect(init?.method).toBe("DELETE");
    expect(url.searchParams.get("user_id")).toBe("eq.user");
    return fail();
  }, async () => {
    expect((await subscribe(request({ endpoint: "https://127.0.0.1/", p256dh: "dummy", auth: "dummy" }))).status).toBe(400);
    expect((await unsubscribe(request({ endpoint: "https://example.invalid/legacy" }, "fixture", "DELETE"))).status).toBe(500);
  });
});

test("redirect validation and seller UI retain no cancelled-paid restore or shipped bypass", () => {
  for (const path of ["https://example.invalid", "//example.invalid", "/\\example.invalid", "/%5cexample.invalid", "/%2fexample.invalid", "/%0aevil", "javascript:alert(1)", "/a/..//example.invalid", "/%2e%2e//example.invalid"]) {
    expect(safeInternalRedirect(path)).toBe("/");
  }
  expect(safeInternalRedirect("/dashboard?tab=orders#recent")).toBe("/dashboard?tab=orders#recent");
  const source = readFileSync(resolve(__dirname, "../../app/dashboard/pasutijumi/page.tsx"), "utf8");
  expect(source).not.toContain("restoreOrder");
  expect(source).not.toContain('update({ status: "shipped"');
  expect(source).toContain("!res.ok || !data.ok");
  expect(source).toContain('orderSellerIds(order).length === 1');
});

test("admin successful approval, slug generation and diagnostics use only existing tables", async () => {
  await backend((url, init) => {
    if (url.pathname === "/auth/v1/user") return user(true);
    if (url.pathname === "/rest/v1/sellers") {
      if (init?.method === "PATCH") return Response.json({ id: "seller" });
      if (url.searchParams.get("select") === "id,name,slug") return Response.json([{ id: "seller", name: "Fixture", slug: null }]);
      return Response.json({ id: "seller", name: "Fixture", email: null, user_id: null });
    }
    if (url.pathname === "/rest/v1/orders") return Response.json([]);
    throw new Error("No notifications or new schema permitted");
  }, async () => {
    expect((await approve(request({ sellerId: "seller" }))).status).toBe(200);
    expect((await slugs(request())).status).toBe(200);
    expect((await diagnostics(request({}, "fixture", "GET"))).status).toBe(200);
  });
});

test("notification legitimate seller/admin/cron paths and second-read race have no delivery", async () => {
  for (const kind of ["seller", "admin", "cron", "race", "unpaid"] as const) {
    let orderReads = 0;
    process.env.CRON_SECRET = "dummy-cron";
    try {
      await backend(url => {
        if (url.pathname === "/auth/v1/user") return user(kind === "admin");
        if (url.pathname === "/rest/v1/sellers") return Response.json(seller);
        if (url.pathname === "/rest/v1/orders") {
          orderReads++;
          if (kind === "unpaid") return Response.json({ ...order, payment_status: "awaiting" });
          if (orderReads > 1) {
            expect(url.searchParams.get("payment_status")).toBe("eq.paid");
            expect(url.searchParams.get("status")).toBe("eq.processing");
            if (kind === "race") return fail();
          }
          return Response.json({ ...order, buyer_id: null, buyer_phone: null });
        }
        throw new Error("No SMS, push or audience permitted");
      }, async () => expect((await statusNotify(request({ orderId: "order", status: "processing" },
        kind === "cron" ? "dummy-cron" : "fixture"))).status).toBe(kind === "race" ? 500 : kind === "unpaid" ? 409 : 200));
    } finally { delete process.env.CRON_SECRET; }
  }
});

for (const mode of ["single", "multi-partial", "multi-complete", "null", "race", "error", "unpaid", "cancelled"] as const) {
  test(`seller confirmation ${mode} uses guarded compare-and-swap`, async () => {
    const previous = mode === "null" ? null : mode === "multi-complete" ? { other: { confirmed_at: "fixture" } } : {};
    const multi = mode.startsWith("multi");
    let writes = 0;
    await backend((url, init) => {
      if (url.pathname === "/auth/v1/user") return user();
      if (url.pathname === "/rest/v1/sellers") return Response.json(seller);
      expect(url.pathname).toBe("/rest/v1/orders");
      if (init?.method === "PATCH") {
        writes++;
        expect(url.searchParams.get("payment_status")).toBe("eq.paid");
        expect(url.searchParams.get("status")).toBe("eq.paid");
        expect(url.searchParams.get("seller_confirmations")).toBe(previous == null ? "is.null" : `eq.${JSON.stringify(previous)}`);
        const body = JSON.parse(String(init.body));
        expect(body.seller_confirmations.seller).toBeTruthy();
        expect(body.status).toBe(mode === "multi-partial" ? "paid" : "processing");
        if (mode === "multi-complete") expect(body.seller_confirmations.other).toEqual(previous?.other);
        return mode === "error" ? fail() : Response.json(mode === "race" ? null : { id: "order" });
      }
      return Response.json({
        ...order, status: mode === "cancelled" ? "cancelled" : "paid",
        payment_status: mode === "unpaid" ? "awaiting" : "paid",
        seller_ids: multi ? ["seller", "other"] : ["seller"], seller_confirmations: previous,
      });
    }, async () => {
      const response = await confirmOrder(request({ orderId: "order" }));
      expect(response.status).toBe(mode === "error" ? 500 : ["race", "unpaid", "cancelled"].includes(mode) ? 409 : 200);
      expect(writes).toBe(["unpaid", "cancelled"].includes(mode) ? 0 : 1);
    });
  });
}

test("existing unsafe push rows are skipped even with VAPID configured", async () => {
  const originalSet = webpush.setVapidDetails;
  const originalSend = webpush.sendNotification;
  let calls = 0;
  webpush.setVapidDetails = () => {};
  webpush.sendNotification = async () => { calls++; throw new Error("Delivery forbidden"); };
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "dummy";
  process.env.VAPID_PRIVATE_KEY = "dummy";
  try {
    await backend(() => { throw new Error("No outbound fetch"); }, async () => {
      const result = await sendPushToSubscriptions([{ endpoint: "https://127.0.0.1/private", p256dh: "dummy", auth: "dummy" }],
        { title: "fixture", body: "fixture", url: "/" });
      expect(result).toEqual({ sent: 0, failed: 1 });
      expect(calls).toBe(0);
    });
  } finally {
    webpush.setVapidDetails = originalSet;
    webpush.sendNotification = originalSend;
    delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
  }
});
