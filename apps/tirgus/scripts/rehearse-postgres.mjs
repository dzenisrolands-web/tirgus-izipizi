import { spawn } from "node:child_process";
import { randomUUID, createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fixtureSchemaSql } from "../tests/lifecycle/fixture-schema.mjs";
import { seed, order, seller, listing } from "../tests/lifecycle/database.mjs";

const image = "postgres:17-alpine";
const root = new URL("../../../", import.meta.url);
const migrations = new URL("supabase/migrations/", root);
const report = {
  mode: "blocked", productionReady: false, fullSchemaRehearsed: false,
  sourceAttestationVerified: false, independentSessions: false, sessionPids: [], tests: [],
};
const options = {};
let container;
let output;
function command(args, input = "", onOutput) {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new Error("LOCAL_COMMAND_TIMEOUT")); }, 30000);
    child.stdout.on("data", chunk => {
      stdout += chunk.toString();
      if (stdout.length > 2_000_000) child.kill("SIGKILL");
      onOutput?.(stdout);
    });
    child.stderr.on("data", chunk => { if (stderr.length < 10000) stderr += chunk.toString(); });
    child.on("error", () => { clearTimeout(timer); reject(new Error("LOCAL_DOCKER_UNAVAILABLE")); });
    child.on("close", code => { clearTimeout(timer); resolve({ code, stdout, stderr }); });
    child.stdin.on("error", () => {});
    child.stdin.end(input);
  });
}
async function sql(text, onOutput) {
  const result = await command(["exec", "-i", container, "psql", "-X", "-q", "-A", "-t",
    "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=sqlstate", "-U", "postgres", "-d", "marketplace_rehearsal"],
  `SET statement_timeout='12s'; SELECT 'SESSION_PID:'||pg_backend_pid();\n${text}`, onOutput);
  const pid = Number(/SESSION_PID:(\d+)/.exec(result.stdout)?.[1]);
  if (pid && !report.sessionPids.includes(pid)) report.sessionPids.push(pid);
  return { ...result, sqlState: /(?:ERROR|FATAL):\s+([0-9A-Z]{5})\b/.exec(result.stderr)?.[1] };
}
async function query(text) {
  const result = await sql(text);
  if (result.code !== 0) { report.failureSqlState = result.sqlState ?? null; throw new Error("LOCAL_SQL_FAILED"); }
  return result.stdout.trim().split("\n").filter(Boolean).at(-1) ?? "";
}
const quote = value => `'${String(value).replaceAll("'", "''")}'`;
const json = value => `${quote(JSON.stringify(value))}::jsonb`;
async function reset() {
  if (options.fixture) await seed({ exec: query });
  else await query(readFileSync(options.seed, "utf8"));
}
function assert(value, code) { if (!value) throw new Error(code); }
async function check(name, run) {
  report.stage = name;
  await reset();
  await run();
  report.tests.push({ name, passed: true });
}
async function reserve(payload = order()) {
  return JSON.parse(await query(`SELECT marketplace_reserve_v1(${json(payload)});`));
}
// Begin the second independent connection only after the first transaction has
// visibly acquired its locks, not merely after launching two promises.
async function heldTransaction(statement) {
  let notify;
  const ready = new Promise(resolve => { notify = resolve; });
  const done = sql(`BEGIN; ${statement}; SELECT 'LOCK_HELD'; SELECT pg_sleep(0.7); COMMIT;`, stdout => {
    if (stdout.includes("LOCK_HELD")) notify();
  });
  const result = await Promise.race([ready.then(() => true), done.then(() => false)]);
  assert(result, "LOCK_HOLDER_FAILED");
  return { done };
}

try {
  for (let i = 2; i < process.argv.length; i++) {
    const key = process.argv[i];
    if (key === "--fixture") { assert(!options.fixture, "DUPLICATE_FLAG"); options.fixture = true; }
    else {
      assert(["--schema", "--manifest", "--seed", "--report"].includes(key) && process.argv[i + 1], "INVALID_FLAGS");
      const name = key.slice(2);
      assert(!options[name], "DUPLICATE_FLAG");
      options[name] = process.argv[++i];
    }
  }
  output = options.report;
  if (!options.fixture && !(options.schema && options.manifest && options.seed)) {
    throw new Error("AUTHORITATIVE_SCHEMA_EXPORT_REQUIRED");
  }
  assert(!(options.fixture && (options.schema || options.manifest || options.seed)), "MIXED_SCHEMA_MODES");
  let schema = fixtureSchemaSql;
  if (!options.fixture) {
    schema = readFileSync(options.schema, "utf8");
    const manifest = JSON.parse(readFileSync(options.manifest, "utf8"));
    const hash = text => createHash("sha256").update(text).digest("hex");
    assert(manifest.dumpMode === "schema-only" && manifest.includesPrivateRows === false
      && typeof manifest.sourceProjectRef === "string" && /^[a-z0-9]{20}$/.test(manifest.sourceProjectRef)
      && Number.isFinite(Date.parse(manifest.capturedAt))
      && manifest.schemaSha256 === hash(schema)
      && manifest.syntheticSeedSha256 === hash(readFileSync(options.seed, "utf8"))
      && manifest.postgresMajor === 17
      && Number.isInteger(manifest.publicTableCount) && manifest.publicTableCount > 0, "INVALID_SCHEMA_PROVENANCE");
    report.source = { sourceProjectRef: manifest.sourceProjectRef, capturedAt: manifest.capturedAt,
      sha256: manifest.schemaSha256, expectedPublicTables: manifest.publicTableCount };
  }
  report.mode = options.fixture ? "minimal_synthetic_fixture" : "provided_schema_snapshot";
  report.baselineSha256 = createHash("sha256").update(schema).digest("hex");
  container = `izipizi-rehearsal-${randomUUID()}`;
  const started = await command(["run", "-d", "--name", container, "--network", "none",
    "--memory", "512m", "--pids-limit", "128", "--cpus", "1",
    "--tmpfs", "/var/lib/postgresql/data:rw,nosuid,nodev,size=384m",
    "-e", "POSTGRES_HOST_AUTH_METHOD=trust", "-e", "POSTGRES_DB=marketplace_rehearsal",
    image, "postgres", "-c", "shared_buffers=32MB", "-c", "max_connections=20"]);
  assert(started.code === 0, "LOCAL_POSTGRES_START_FAILED");
  report.container = container;
  let stable = 0;
  for (let i = 0; i < 60 && stable < 3; i++) {
    const result = await sql("SELECT 1;");
    stable = result.code === 0 ? stable + 1 : 0;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert(stable === 3, "LOCAL_POSTGRES_NOT_READY");
  const isolation = JSON.parse((await command(["inspect", container])).stdout)[0];
  assert(isolation.HostConfig.NetworkMode === "none" && !isolation.HostConfig.Privileged
    && !Object.keys(isolation.HostConfig.PortBindings ?? {}).length
    && !(isolation.HostConfig.Binds?.length), "ISOLATION_NOT_CONFIRMED");
  report.imageId = isolation.Image;
  report.server = await query("SHOW server_version;");
  report.stage = "baseline_import";
  await query(schema);
  const count = await query("SELECT count(*) FROM pg_tables WHERE schemaname='public';");
  report.baselinePublicTables = Number(count);
  if (report.source) assert(report.baselinePublicTables === report.source.expectedPublicTables, "SCHEMA_TABLE_COUNT_MISMATCH");
  report.migrations = [];
  for (const name of readdirSync(migrations).filter(name => /^20261112\d{4}_.*\.sql$/.test(name)).sort()) {
    report.stage = name;
    const source = readFileSync(new URL(name, migrations), "utf8");
    await query(source);
    report.migrations.push({ name, sha256: createHash("sha256").update(source).digest("hex") });
  }
  const source = JSON.parse(await query("SELECT json_build_object('tables',count(*)) FROM pg_tables WHERE schemaname='public';"));
  report.migratedPublicTables = source.tables;
  await check("independent sessions cannot sell the last unit twice", async () => {
    const first = await heldTransaction(`SELECT marketplace_reserve_v1(${json(order())})`);
    const second = await sql(`SELECT marketplace_reserve_v1(${json(order({ order_number: "TRG-SECOND" }))});`);
    assert((await first.done).code === 0 && second.code !== 0 && second.sqlState === "22023", "LAST_UNIT_RACE_FAILED");
    assert(await query(`SELECT quantity FROM listings WHERE id=${quote(listing)};`) === "0", "STOCK_NOT_CONSERVED");
    assert(await query("SELECT count(*) FROM orders;") === "1", "EXTRA_ORDER_CREATED");
  });
  await check("simultaneous signed-settlement equivalents emit one paid event", async () => {
    await reserve();
    const first = await heldTransaction("SELECT marketplace_settle_v1('TRG-SYNTHETIC',800)");
    const second = await sql("SELECT marketplace_settle_v1('TRG-SYNTHETIC',800);");
    assert((await first.done).code === 0 && second.code === 0, "CALLBACK_RACE_FAILED");
    assert(await query("SELECT count(*) FROM marketplace_events_v1 WHERE event_type='payment_confirmed';") === "1", "DUPLICATE_PAID_EVENT");
    assert(await query("SELECT count(*) FROM marketplace_outbox_v1;") === "2", "DUPLICATE_NOTIFICATION");
  });
  await check("expiry racing a late payment releases once and preserves receipt review", async () => {
    await reserve();
    await query("UPDATE orders SET reservation_expires_at=now()-interval '1 minute';");
    const first = await heldTransaction("SELECT marketplace_expire_v1()");
    const second = await sql("SELECT marketplace_settle_v1('TRG-SYNTHETIC',800);");
    assert((await first.done).code === 0 && second.code === 0, "EXPIRY_PAYMENT_RACE_FAILED");
    assert(await query(`SELECT quantity FROM listings WHERE id=${quote(listing)};`) === "1", "DOUBLE_RESTOCK");
    assert(await query("SELECT (status='cancelled' AND payment_status='paid' AND payment_review_reason IS NOT NULL)::text FROM orders;") === "true", "LATE_PAYMENT_NOT_HELD");
  });
  for (const invoiceFirst of [true, false]) {
    await check(`${invoiceFirst ? "invoice" : "cancellation"} first cannot leave an unheld payable invoice`, async () => {
      const operator = Object.fromEntries(["name","regNr","vatNr","address","phone","email","bankName","iban","bic","complaintsEmail"].map(key => [key, `synthetic-${key}`]));
      const held = await reserve(order({ financial_snapshot: { operator } }));
      await query("SELECT marketplace_settle_v1('TRG-SYNTHETIC',800);");
      const day = await query("SELECT paid_at::date::text FROM orders;");
      const facts = JSON.parse(await query("SELECT financial_snapshot FROM orders;"));
      const header = { seller_id: seller, period_start: day, period_end: day, status: "draft",
        total_gross_cents: 500, total_ex_vat_cents: 413, total_product_vat_cents: 87,
        total_commission_cents: 62, commission_vat_cents: 13, commission_vat_rate: 21,
        courier_fee_cents: 0, courier_order_count: 0, total_net_cents: 425,
        seller_legal_name: "Synthetic seller", seller_reg_number: "SYNTHETIC-REG", seller_vat_number: "SYNTHETIC-VAT",
        seller_legal_address: "Synthetic legal address", seller_bank_name: "Synthetic bank",
        seller_bank_iban: "SYNTHETIC-NOT-A-BANK-ACCOUNT",
        operator_version: facts.operator_version, operator_snapshot: facts.operator };
      const lines = [{ order_id: held.order_id, order_number: "TRG-SYNTHETIC", order_date: day,
        product_title: "Synthetic product", quantity: 1, unit_price_cents: 500, line_gross_cents: 500,
        vat_rate: 21, vat_amount_cents: 87, ex_vat_cents: 413, commission_rate: 15,
        commission_cents: 75, net_cents: 425, line_order: 0 }];
      const invoice = `SET LOCAL ROLE service_role; SELECT marketplace_create_invoice_v1(${json(header)},${json(lines)})`;
      const cancel = `SELECT marketplace_transition_v1(${quote(held.order_id)},'paid','cancelled',${quote(listing)},'Synthetic cancellation evidence')`;
      const first = await heldTransaction(invoiceFirst ? invoice : cancel);
      const second = await sql(`BEGIN; ${invoiceFirst ? cancel : invoice}; COMMIT;`);
      assert((await first.done).code === 0, "FIRST_FINANCE_TRANSACTION_FAILED");
      assert(invoiceFirst ? second.code === 0 : second.code !== 0 && second.sqlState === "P0001", "FINANCE_RACE_OUTCOME_INVALID");
      assert(await query("SELECT count(*) FROM invoices WHERE finance_review_reason IS NULL;") === "0", "UNHELD_PAYABLE_INVOICE");
    });
  }
  report.passed = true;
  report.independentSessions = report.sessionPids.length > 1;
  report.providedSnapshotRehearsed = !options.fixture;
} catch (error) {
  report.passed = false;
  // Do not publish SQL bodies, dump contents, private row values or command stderr.
  report.blocker = /^[A-Z_]+$/.test(error.message) ? error.message : "REHEARSAL_INPUT_OR_EXECUTION_FAILED";
  process.exitCode = 2;
} finally {
  if (container) report.containerStopped = (await command(["stop", "--time", "5", container]).catch(() => ({ code: 1 }))).code === 0;
  if (output) writeFileSync(output, JSON.stringify(report, null, 2), { mode: 0o600, flag: "wx" });
  console.log(JSON.stringify(report, null, 2));
}
