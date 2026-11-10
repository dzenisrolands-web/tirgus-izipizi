import { mkdtemp, chmod } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import pg from "pg";
import { root, migrationManifest, applyMigrations, databasePreflight } from "./lib.mjs";

// Fresh synthetic database only. No production credentials are used or mounted.
const socket = await mkdtemp(join(tmpdir(), "tirgus-release-"));
await chmod(socket, 0o777);
const suffix = Date.now().toString();
const container = `tirgus-release-${suffix}`;
const database = `tirgus_release_${suffix}`;
const docker = (...args) => execFileSync("docker", args, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
let pool;
try {
  docker("run", "-d", "--network", "none", "--name", container,
    "-e", "POSTGRES_HOST_AUTH_METHOD=trust", "-v", `${socket}:/var/run/postgresql`,
    "-v", `${root}:/repo:ro`, "postgres:17-alpine");
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      docker("exec", "--user", "postgres", container, "sh", "-c",
        '[ "$(cat /proc/1/comm)" = "postgres" ] && pg_isready -U postgres');
      ready = true; break;
    }
    catch { await new Promise(resolve => setTimeout(resolve, 200)); }
  }
  assert.ok(ready, "isolated_database_startup");
  docker("exec", "--user", "postgres", container, "createdb", "-U", "postgres", database);
  docker("exec", "--user", "postgres", container, "psql", "-U", "postgres", "-d", database,
    "-v", "ON_ERROR_STOP=1", "-f", "/repo/supabase/tests/release_staging_fixture.sql");
  pool = new pg.Pool({ host: socket, user: "postgres", database, max: 6 });
  const client = await pool.connect();
  const env = {
    DATABASE_URL: `postgresql://postgres@localhost/${database}`, RELEASE_TARGET: "staging",
    RELEASE_EXPECTED_DB_HOST: "localhost", RELEASE_EXPECTED_DATABASE: database,
    RELEASE_APPLY_CONFIRM: "APPLY_REVIEWED_TIRGUS_RELEASE",
  };
  try {
    const manifest = await migrationManifest();
    const first = await applyMigrations(client, env, manifest);
    assert.ok(first.every(item => item.status === "applied"));
    assert.ok((await applyMigrations(client, env, manifest)).every(item => item.status === "already_applied"));
    const preflight = await databasePreflight(client);
    assert.ok(preflight.every(check => check.status === "pass"), JSON.stringify(preflight));
  } finally { client.release(); }

  const userId = "10000000-0000-4000-8000-000000000001";
  const sellerId = "20000000-0000-4000-8000-000000000001";
  const listingId = "30000000-0000-4000-8000-000000000001";
  await pool.query("INSERT INTO auth.users(id) VALUES($1)", [userId]);
  await pool.query(`INSERT INTO public.sellers(id,user_id,name,legal_name,bank_iban)
    VALUES($1,$2,'Fixture farm','Fixture legal name','SYNTHETIC')`, [sellerId, userId]);
  await pool.query(`INSERT INTO public.listings(id,seller_id,title,price,quantity)
    VALUES($1,$2,'Fixture frozen item',10,1)`, [listingId, sellerId]);

  // Compile the actual TS route sources in-process. Typechecking is a separate gate.
  const require = createRequire(import.meta.url);
  const Module = require("node:module");
  const ts = require("typescript");
  const resolveFilename = Module._resolveFilename;
  Module._resolveFilename = function (request, ...args) {
    return resolveFilename.call(this, request.startsWith("@/") ? join(root, "apps/tirgus", request.slice(2)) : request, ...args);
  };
  for (const extension of [".ts", ".tsx"]) {
    Module._extensions[extension] = (module, filename) => module._compile(ts.transpileModule(
      readFileSync(filename, "utf8"), { compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
        jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
      } },
    ).outputText, filename);
  }
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.invalid";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "nonfunctional-staging-publishable";
  process.env.SUPABASE_SECRET_KEY = "nonfunctional-staging-service";
  process.env.PAYSERA_MODE = "test";
  process.env.PAYSERA_PROJECT_ID = "fixture-project";
  process.env.PAYSERA_SIGN_PASSWORD = "nonfunctional-staging-signing-value";
  process.env.NEXT_PUBLIC_SITE_URL = "https://example.invalid";
  for (const name of ["RESEND_API_KEY", "VAPID_PRIVATE_KEY", "NEXT_PUBLIC_VAPID_PUBLIC_KEY", "ESTERIA_API_KEY"]) delete process.env[name];
  const allowedRPCs = new Map([
    ["create_reserved_marketplace_order", ["p_order"]],
    ["settle_reserved_marketplace_order", ["p_order_number", "p_amount_cents"]],
    ["expire_marketplace_reservations", []],
  ]);
  const pending = new Set();
  globalThis.fetch = (input, options = {}) => {
    const task = (async () => {
      const url = new URL(String(input));
      assert.equal(url.origin, "https://example.invalid", "outbound_provider_network_forbidden");
      const rpc = url.pathname.split("/rpc/")[1];
      if (rpc) {
        assert.ok(allowedRPCs.has(rpc), "only_reviewed_fixture_RPCs");
        const body = JSON.parse(String(options.body ?? "{}"));
        const parameters = allowedRPCs.get(rpc).map(key => body[key]);
        const db = await pool.connect();
        try {
          await db.query("BEGIN");
          await db.query("SET LOCAL ROLE service_role");
          const { rows } = await db.query(`SELECT public.${rpc}(${parameters.map((_, i) => "$" + (i + 1)).join(",")}) AS result`, parameters);
          await db.query("COMMIT");
          return Response.json(rows[0].result);
        } catch (error) {
          await db.query("ROLLBACK");
          return Response.json({ code: error.code ?? "fixture_error", message: "Fixture transaction rejected" }, { status: 400 });
        } finally { db.release(); }
      }
      if (url.pathname === "/auth/v1/user") return Response.json({ id: userId, app_metadata: { is_super_admin: true } });
      const table = url.pathname.split("/rest/v1/")[1];
      if (["listings", "sellers", "orders"].includes(table)) {
        const field = table === "orders" ? (url.searchParams.has("order_number") ? "order_number" : "id") : "id";
        const filter = url.searchParams.get(field);
        let query = `SELECT * FROM public.${table}`, args = [];
        if (filter?.startsWith("eq.")) { query += ` WHERE ${field}=$1`; args = [filter.slice(3)]; }
        else if (filter?.startsWith("in.(")) { query += ` WHERE ${field}=ANY($1::uuid[])`; args = [filter.slice(4, -1).split(",")]; }
        const { rows } = await pool.query(query, args);
        const single = String(new Headers(options.headers).get("accept")).includes("object");
        return Response.json(single ? rows[0] ?? null : rows);
      }
      // No external delivery: optional notification helper reads see empty fixture audiences/templates.
      if (["push_subscriptions", "profiles", "email_templates", "notifications"].includes(table)) return Response.json([]);
      throw new Error("unexpected_fixture_backend_path");
    })();
    pending.add(task);
    task.finally(() => pending.delete(task)).catch(() => {});
    return task;
  };
  const checkout = require(join(root, "apps/tirgus/app/api/checkout/create-session/route.ts")).POST;
  const callback = require(join(root, "apps/tirgus/app/api/webhooks/paysera/route.ts")).GET;
  const arrival = require(join(root, "apps/tirgus/app/api/checkout/confirm-arrival/route.ts")).POST;
  const makeOrder = () => checkout(new Request("https://example.invalid/api/checkout/create-session", {
    method: "POST", body: JSON.stringify({
      items: [{ id: listingId, quantity: 1, price: 0.01 }], deliveryInfo: { locker_id: "brivibas" },
      contact: { name: "Fixture buyer", email: "fixture@example.invalid", phone: "12345" },
    }),
  }));
  const responses = await Promise.all([makeOrder(), makeOrder()]);
  assert.equal(responses.filter(response => response.status === 200).length, 1, "one_last_item_winner");
  const winner = await responses.find(response => response.status === 200).json();
  assert.equal(winner.totalCents, 1300, "server_price_plus_3_euro_locker");
  assert.equal((await pool.query("SELECT quantity FROM listings WHERE id=$1", [listingId])).rows[0].quantity, 0);
  assert.equal((await arrival()).status, 410);

  const signedCallback = async (number, amount) => {
    const data = Buffer.from(new URLSearchParams({
      orderid: number, amount: String(amount), currency: "EUR", projectid: "fixture-project", test: "1", status: "1",
    }).toString()).toString("base64url");
    const ss1 = createHash("md5").update(data + process.env.PAYSERA_SIGN_PASSWORD).digest("hex");
    return callback(new Request(`https://example.invalid/api/webhooks/paysera?${new URLSearchParams({ data, ss1 })}`));
  };
  assert.equal((await signedCallback(winner.orderId, 1300)).status, 200);
  assert.equal((await signedCallback(winner.orderId, 1300)).status, 200);
  const paid = (await pool.query("SELECT * FROM orders WHERE order_number=$1", [winner.orderId])).rows[0];
  assert.equal(paid.payment_status, "paid");
  assert.equal(paid.payment_received_cents, 1300);
  assert.equal((await pool.query("SELECT state FROM marketplace_stock_reservations WHERE order_id=$1", [paid.id])).rows[0].state, "consumed");

  await pool.query("UPDATE listings SET quantity=1 WHERE id=$1", [listingId]);
  const lateResponse = await makeOrder();
  assert.equal(lateResponse.status, 200);
  const late = await lateResponse.json();
  await pool.query("UPDATE orders SET reservation_expires_at=now()-interval '1 minute' WHERE order_number=$1", [late.orderId]);
  await pool.query("SELECT public.expire_marketplace_reservations()");
  assert.equal((await signedCallback(late.orderId, 1300)).status, 200);
  const lateOrder = (await pool.query("SELECT * FROM orders WHERE order_number=$1", [late.orderId])).rows[0];
  assert.equal(lateOrder.payment_status, "paid");
  assert.equal(lateOrder.status, "cancelled");
  assert.ok(lateOrder.payment_review_reason);
  assert.equal((await pool.query("SELECT quantity FROM listings WHERE id=$1", [listingId])).rows[0].quantity, 1);
  assert.equal((await pool.query("SELECT count(*)::integer AS n FROM finance_refund_queue WHERE order_id=$1", [lateOrder.id])).rows[0].n, 1);
  while (pending.size) await Promise.allSettled([...pending]);
  console.log(JSON.stringify({
    passed: true, container, database, providerNetwork: false, productionMutations: false,
    checks: ["reviewed_migrations_and_repeat_skip", "real_UUID_array_schema", "database_privileges",
      "actual_checkout_last_item_race", "server_tariff", "signed_test_callback", "duplicate_callback",
      "held_stock_expiry", "late_payment_preserved_and_queued"],
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ passed: false, container, database,
    reason: error?.code ?? error?.message ?? "isolated_staging_failed" }));
  process.exitCode = 1;
} finally {
  if (pool) await pool.end();
  // Keep the disposable container for inspection; no cleanup of user data is performed.
}
