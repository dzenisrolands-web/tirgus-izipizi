import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import pg from "pg";

export const root = fileURLToPath(new URL("../../", import.meta.url));
export const migrationNames = [
  "0038_invoice_operator_snapshots.sql",
  "0039_atomic_invoice_generation.sql",
  "0041_retired_locker_selection.sql",
  "0042_order_integrity_guards.sql",
  "0043_public_seller_pickup_privacy.sql",
  "0044_atomic_stock_reservations.sql",
  "0045_finance_operations.sql",
];
export const templateFiles = {
  confirmation: "confirm-signup.html", invite: "invite-user.html", magic_link: "magic-link.html",
  email_change: "change-email.html", recovery: "reset-password.html",
};

export function outcome(check, status, reason) {
  return { check, status, ...(reason ? { reason } : {}) };
}

export function assertApplyTarget(env) {
  if (!["staging", "production"].includes(env.RELEASE_TARGET) ||
      env.RELEASE_APPLY_CONFIRM !== "APPLY_REVIEWED_TIRGUS_RELEASE") {
    throw new Error("explicit_target_confirmation_required");
  }
}

export async function migrationManifest() {
  return Promise.all(migrationNames.map(async name => {
    const sql = await readFile(resolve(root, "supabase/migrations", name), "utf8");
    if (!/^BEGIN;$/m.test(sql) || !/^COMMIT;\s*$/.test(sql.slice(sql.lastIndexOf("\nCOMMIT;") + 1))) {
      throw new Error("migration_transaction_required");
    }
    return { name, sql, sha256: createHash("sha256").update(sql).digest("hex") };
  }));
}

export async function connectDatabase(env = process.env) {
  if (!env.DATABASE_URL) throw new Error("DATABASE_URL_missing");
  const url = new URL(env.DATABASE_URL);
  if (env.PGSSLMODE === "disable" && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
    throw new Error("unencrypted_remote_database_rejected");
  }
  const client = new pg.Client({
    connectionString: env.DATABASE_URL,
    connectionTimeoutMillis: 10000,
    statement_timeout: 30000,
    ssl: env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: true },
  });
  await client.connect();
  return client;
}

/** Only schema/readiness information is returned, never credentials or application rows. */
export async function databasePreflight(client) {
  const results = [];
  await client.query("BEGIN READ ONLY");
  try {
    const expected = [
      "invoice_generation_ready", "create_invoice_with_lines",
      "create_reserved_marketplace_order", "settle_reserved_marketplace_order",
      "cancel_reserved_order", "expire_marketplace_reservations", "finance_issues",
    ];
    const { rows } = await client.query(`
      SELECT p.proname, has_function_privilege('anon',p.oid,'EXECUTE') AS anon,
        has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated,
        has_function_privilege('service_role',p.oid,'EXECUTE') AS service
      FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid
      WHERE n.nspname='public' AND p.proname=ANY($1::text[])`, [expected]);
    for (const name of expected) {
      const functions = rows.filter(row => row.proname === name);
      results.push(outcome(`rpc:${name}`, functions.length === 1 &&
        functions.every(row => !row.anon && !row.authenticated && row.service) ? "pass" : "fail",
      functions.length ? "verify_service_only_permissions" : "missing_migration"));
    }
    const { rows: guards } = await client.query(`
      SELECT tgname FROM pg_trigger WHERE NOT tgisinternal AND tgenabled <> 'D'
        AND tgrelid IN ('public.orders'::regclass,'public.sellers'::regclass)`);
    for (const trigger of ["guard_marketplace_order_write", "guard_seller_moderation_write", "reject_retired_locker"]) {
      results.push(outcome(`trigger:${trigger}`, guards.some(g => g.tgname === trigger) ? "pass" : "fail"));
    }
    const { rows: privacy } = await client.query(`
      SELECT coalesce(position('NULL::text AS courier_pickup_address' IN
        pg_get_viewdef('public.sellers_public'::regclass,true)),0) > 0 AS masked,
        has_column_privilege('anon','public.sellers','bank_iban','SELECT') AS bank_exposed`);
    results.push(outcome("public_seller_privacy", privacy[0]?.masked && !privacy[0]?.bank_exposed ? "pass" : "fail"));
    const { rows: tables } = await client.query(`
      SELECT relname,relrowsecurity FROM pg_class
      WHERE oid IN ('public.orders'::regclass,'public.sellers'::regclass)`);
    results.push(outcome("base_table_rls", tables.length === 2 && tables.every(t => t.relrowsecurity) ? "pass" : "fail"));
    return results;
  } finally {
    await client.query("ROLLBACK");
  }
}

/** References attest to the operator's controlled provider/email test, not an automated bank certification. */
export async function controlledTestEvidence(client, env) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(env.RELEASE_TEST_ORDER_ID ?? "") ||
      !env.RELEASE_PAYMENT_TEST_REFERENCE?.trim() || !env.RELEASE_EMAIL_DELIVERY_REFERENCE?.trim()) {
    return outcome("controlled_payment_and_email_test", "blocked", "test_order_and_operator_verified_provider_delivery_references_required");
  }
  const { rows } = await client.query(`
    SELECT o.payment_status='paid' AND o.status IN ('paid','processing','shipped','delivered')
      AND o.payment_review_reason IS NULL
      AND o.payment_received_cents=o.total_cents
      AND EXISTS (SELECT 1 FROM public.marketplace_stock_reservations r WHERE r.order_id=o.id AND r.state='consumed')
      AND NOT EXISTS (SELECT 1 FROM public.marketplace_stock_reservations r WHERE r.order_id=o.id AND r.state<>'consumed')
      AS verified FROM public.orders o WHERE o.id=$1::uuid`, [env.RELEASE_TEST_ORDER_ID]);
  return outcome("controlled_payment_and_email_test", rows.length === 1 && rows[0].verified ? "pass" : "fail",
    "database_checked_and_operator_attested_provider_delivery_references");
}

export async function applyMigrations(client, env, migrations) {
  assertApplyTarget(env);
  if (!env.RELEASE_EXPECTED_DB_HOST || !env.RELEASE_EXPECTED_DATABASE) throw new Error("database_identity_confirmation_required");
  const url = new URL(env.DATABASE_URL);
  const { rows } = await client.query("SELECT current_database() AS name");
  if (url.hostname !== env.RELEASE_EXPECTED_DB_HOST || rows[0]?.name !== env.RELEASE_EXPECTED_DATABASE) {
    throw new Error("database_identity_mismatch");
  }
  await client.query("SELECT pg_advisory_lock(hashtext('tirgus-reviewed-release'))");
  const applied = [];
  try {
    await client.query(`CREATE SCHEMA IF NOT EXISTS release_audit;
      REVOKE ALL ON SCHEMA release_audit FROM PUBLIC;
      CREATE TABLE IF NOT EXISTS release_audit.migrations (
        name text PRIMARY KEY, sha256 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now());
      REVOKE ALL ON release_audit.migrations FROM PUBLIC`);
    for (const migration of migrations) {
      if (!/^\d{4}_[a-z_]+\.sql$/.test(migration.name) || !/^[0-9a-f]{64}$/.test(migration.sha256)) {
        throw new Error("invalid_reviewed_manifest");
      }
      const prior = await client.query("SELECT sha256 FROM release_audit.migrations WHERE name=$1", [migration.name]);
      if (prior.rows.length) {
        if (prior.rows[0].sha256 !== migration.sha256) throw new Error("applied_migration_changed");
        applied.push({ name: migration.name, status: "already_applied" });
        continue;
      }
      // Record the exact hash in the migration's transaction, not after COMMIT.
      const sql = migration.sql.replace(/COMMIT;\s*$/, `
        INSERT INTO release_audit.migrations(name,sha256) VALUES ('${migration.name}','${migration.sha256}');
        COMMIT;`);
      try { await client.query(sql); }
      catch { await client.query("ROLLBACK"); throw new Error("migration_failed:" + migration.name); }
      applied.push({ name: migration.name, status: "applied" });
    }
    return applied;
  } finally {
    await client.query("SELECT pg_advisory_unlock(hashtext('tirgus-reviewed-release'))");
  }
}

export async function localTemplates() {
  const payload = {};
  for (const [type, file] of Object.entries(templateFiles)) {
    const html = await readFile(resolve(root, "apps/tirgus/email-templates/auth", file), "utf8");
    if (!html.includes("40103915568") || !html.includes("Svaigi") ||
        !/\{\{\s*\.(ConfirmationURL|TokenHash)\s*\}\}/.test(html)) throw new Error("invalid_local_template:" + type);
    payload[`mailer_templates_${type}_content`] = html;
  }
  return payload;
}

export async function authTemplates(env, apply = false, request = fetch) {
  const payload = await localTemplates();
  if (!env.SUPABASE_ACCESS_TOKEN || !/^[a-z0-9]{20}$/.test(env.SUPABASE_PROJECT_REF ?? "")) {
    return [outcome("hosted_auth", "blocked", "SUPABASE_ACCESS_TOKEN_and_SUPABASE_PROJECT_REF_required")];
  }
  if (apply) {
    assertApplyTarget(env);
    if (env.RELEASE_EXPECTED_PROJECT_REF !== env.SUPABASE_PROJECT_REF) throw new Error("project_identity_confirmation_required");
  }
  const url = `https://api.supabase.com/v1/projects/${env.SUPABASE_PROJECT_REF}/config/auth`;
  const options = {
    headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(15000), redirect: "error",
  };
  if (apply) {
    const update = await request(url, { ...options, method: "PATCH", body: JSON.stringify(payload) });
    if (!update.ok) throw new Error("hosted_template_update_failed");
  }
  const response = await request(url, options);
  if (!response.ok) return [outcome("hosted_auth", "blocked", "management_api_access_denied")];
  const config = await response.json(); // Never log the provider/SMTP credentials in this response.
  return [
    outcome("auth_email_confirmation", config.mailer_autoconfirm === false &&
      config.mailer_allow_unverified_email_sign_ins !== true ? "pass" : "fail"),
    outcome("auth_site_url", config.site_url === "https://tirgus.izipizi.lv" ? "pass" : "fail"),
    ...Object.keys(payload).map(key => outcome(key, config[key] === payload[key] ? "pass" : "fail")),
  ];
}
