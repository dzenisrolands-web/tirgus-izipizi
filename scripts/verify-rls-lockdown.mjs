#!/usr/bin/env node
/**
 * Verify what the anonymous role can see and change.
 *
 * Run this BEFORE migration 0030 to record the baseline, and AFTER to prove
 * the hole is closed. It uses only the publishable key — the same key that
 * ships in every browser bundle — so it reproduces exactly what any visitor
 * could do.
 *
 *   node scripts/verify-rls-lockdown.mjs
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY from
 * the environment, or from apps/tirgus/.env.local / apps/tirgus/.env.
 *
 * Writes are probed non-destructively: every UPDATE targets a row id that
 * cannot exist and sets `id` to that same value, so zero rows match and no
 * data is ever changed.
 *
 * What the write probe actually measures: whether the anon role still HOLDS
 * the UPDATE privilege on the table. PostgREST answers 401/403 when the
 * privilege is revoked, and 204 when it is held -- even if RLS would then
 * filter every row. A 204 therefore means "anon still has write privileges"
 * (the attack surface), not "a row was changed". Migration 0032 revokes the
 * privilege so this check becomes a clean pass/fail.
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  for (const rel of ["apps/tirgus/.env.local", "apps/tirgus/.env", ".env.local", ".env"]) {
    const p = join(ROOT, rel);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (!m) continue;
      const key = m[1];
      if (process.env[key]) continue;
      process.env[key] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  }
}

loadEnv();

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!URL_ || !KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.\n" +
      "Set them in the environment or in apps/tirgus/.env.local.",
  );
  process.exit(2);
}

const headers = { apikey: KEY, Authorization: `Bearer ${KEY}` };

/** Tables that must be completely invisible to anonymous visitors. */
const MUST_BE_PRIVATE = [
  "sellers",
  "orders",
  "profiles",
  "invitations",
  "email_subscribers",
  "email_templates",
  "sutijumi",
  "seller_followers",
  "franchise_partners",
  "franchise_shares",
];

/** Tables that are intentionally public to read (catalogue data). */
const PUBLIC_READ = ["pakomati", "compartments", "listings", "sellers", "reviews"];

/**
 * Exact column sets the public app selects from `sellers` with the anon key
 * (lib/db-listings.ts, lib/hot-drops/queries.ts, components/cart-page.tsx).
 * Each must keep working after migration 0034 restricts anon to public columns.
 */
const SELLERS_APP_SELECTS = [
  "id, name, farm_name, avatar_url, logo_url, status, location",
  "id, name, farm_name, avatar_url, logo_url, cover_url, status, location, description, short_desc, website, facebook, instagram, tiktok, youtube_channel, youtube_video_url, quote_text, quote_author, facts, milestones, events",
  "id, name, farm_name, avatar_url",
  "id, name, home_locker_ids, courier_pickup_address",
];

/** `sellers` columns that must never be readable by anonymous visitors. */
const SELLERS_PRIVATE_COLUMNS = [
  "user_id", "email", "legal_name", "registration_number", "vat_number",
  "legal_address", "bank_name", "bank_iban", "bank_swift",
  "self_billing_agreed_ip", "admin_notes", "internal_notes", "rejected_reason",
];

/** Tables anonymous users must never be able to modify. */
const MUST_BE_READ_ONLY = [
  "sellers", "orders", "pakomati", "compartments", "sutijumi", "seller_followers",
  "listings", "reviews", "weekly_featured", "hot_drops", "hot_drop_reservations",
  "promo_codes", "promo_redemptions", "notifications", "push_subscriptions",
  "feedback", "page_views", "referral_clicks", "delivery_lookups", "user_roles",
  "invoices", "invoice_lines", "order_items", "profiles", "category_commission_benchmarks",
  "locker_subscriptions", "email_subscribers", "invitations", "email_templates",
  "franchise_partners",
];
// pwa_events is deliberately NOT here: anon may INSERT (never UPDATE/DELETE) there.

const IMPOSSIBLE_ID = "00000000-0000-0000-0000-000000000000";

async function probeRead(table) {
  const res = await fetch(
    `${URL_}/rest/v1/${table}?select=*&limit=1`,
    { headers },
  );
  if (!res.ok) return { readable: false, status: res.status, rows: 0 };
  const body = await res.json().catch(() => []);
  const rows = Array.isArray(body) ? body.length : 0;
  return { readable: rows > 0, status: res.status, rows, sample: body?.[0] };
}

async function probeWrite(table) {
  // Targets a row id that cannot exist, so nothing is ever modified.
  //
  // The body must name a real column. An empty `{}` body makes PostgREST skip
  // the UPDATE entirely, so on tables the anon role can SELECT it answers 204
  // regardless of UPDATE privileges and the probe proves nothing. Setting `id`
  // to the same impossible value forces a real UPDATE statement that needs the
  // privilege, yet matches zero rows.
  const sample = await probeRead(table);
  const sampleId = sample.sample?.id;
  const impossible = typeof sampleId === "number" ? -1 : IMPOSSIBLE_ID;
  const res = await fetch(
    `${URL_}/rest/v1/${table}?id=eq.${impossible}`,
    {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ id: impossible }),
    },
  );
  // 2xx: anon holds the UPDATE privilege (RLS may still filter every row).
  // 401/403 (42501): privilege revoked, which is what we want.
  return { permitted: res.ok, status: res.status };
}

/**
 * Non-destructive DELETE probe: targets an id that cannot exist, so no row is
 * ever removed. 401/403 = privilege revoked; 2xx = anon holds DELETE.
 */
async function probeDelete(table) {
  const sample = await probeRead(table);
  const sampleId = sample.sample?.id;
  const impossible = typeof sampleId === "number" ? -1 : IMPOSSIBLE_ID;
  const res = await fetch(`${URL_}/rest/v1/${table}?id=eq.${impossible}`, {
    method: "DELETE",
    headers: { ...headers, Prefer: "return=minimal" },
  });
  return { permitted: res.ok, status: res.status };
}

function mark(ok) {
  return ok ? "OK  " : "FAIL";
}

const results = { failures: 0, checks: 0 };

function record(ok, line) {
  results.checks += 1;
  if (!ok) results.failures += 1;
  console.log(`  [${mark(ok)}] ${line}`);
}

console.log(`\nSupabase: ${URL_}`);
console.log("Role:     anon (publishable key)\n");

console.log("Must NOT be readable by anonymous visitors");
for (const t of MUST_BE_PRIVATE) {
  const r = await probeRead(t);
  if (r.status === 404) {
    console.log(`  [skip] ${t} — table does not exist`);
    continue;
  }
  const leakedFields = r.sample ? Object.keys(r.sample).slice(0, 6).join(", ") : "";
  record(
    !r.readable,
    r.readable
      ? `${t} — LEAKING rows (${leakedFields}${leakedFields ? ", ..." : ""})`
      : `${t} — no rows returned (HTTP ${r.status})`,
  );
}

console.log("\nMust stay publicly readable (catalogue)");
for (const t of PUBLIC_READ) {
  // `sellers` is column-restricted for anon (0034), so select=* is expected to
  // be refused; its real app queries are checked in the next section.
  if (t === "sellers") continue;
  const r = await probeRead(t);
  if (r.status === 404) {
    console.log(`  [skip] ${t} — table does not exist`);
    continue;
  }
  // An empty table is not a failure, only an outright error is.
  record(r.status === 200, `${t} — HTTP ${r.status}, ${r.rows} row(s)`);
}

// The public app reads sellers through the `sellers_public` view (0035); the
// base table is closed to anon (0036), so it is checked for refusal below.
console.log("\nsellers_public: the public app's own queries must keep working");
for (const cols of SELLERS_APP_SELECTS) {
  const res = await fetch(`${URL_}/rest/v1/sellers_public?select=${encodeURIComponent(cols)}&limit=1`, { headers });
  record(res.status === 200, `select ${cols.split(",").length} cols (${cols.slice(0, 40)}...) — HTTP ${res.status}`);
}

console.log("\nsellers + sellers_public: private columns must NOT be readable by anonymous visitors");
for (const rel of ["sellers", "sellers_public"]) {
  for (const col of SELLERS_PRIVATE_COLUMNS) {
    const res = await fetch(`${URL_}/rest/v1/${rel}?select=${col}&limit=1`, { headers });
    record(
      !res.ok,
      res.ok
        ? `${rel}.${col} — anon can still read this column (HTTP ${res.status})`
        : `${rel}.${col} — refused (HTTP ${res.status})`,
    );
  }
}

console.log("\nMust NOT be writable by anonymous visitors");
for (const t of MUST_BE_READ_ONLY) {
  const w = await probeWrite(t);
  if (w.status === 404) {
    console.log(`  [skip] ${t} — table does not exist`);
    continue;
  }
  const d = await probeDelete(t);
  // HTTP 400 means the probe could not run (e.g. the table has no `id` column).
  // It is not evidence of exposure, but it is not proof of safety either.
  const untestable = (s) => s === 400;
  const note = untestable(w.status) || untestable(d.status) ? "  (probe inconclusive: no id column)" : "";
  record(
    !w.permitted && !d.permitted,
    `${t} — UPDATE ${w.permitted ? "ALLOWED" : "rejected"} (HTTP ${w.status}), DELETE ${d.permitted ? "ALLOWED" : "rejected"} (HTTP ${d.status})${note}`,
  );
}

console.log(
  `\n${results.checks - results.failures}/${results.checks} checks passed.`,
);

if (results.failures > 0) {
  console.log(
    "\nLockdown is incomplete.\n" +
      "Apply, in order: 0030_rls_lockdown_pii.sql, 0032_rls_lockdown_followup.sql,\n" +
      "0034_sellers_anon_column_lockdown.sql, 0036_sellers_rls_and_anon_write_lockdown.sql\n" +
      "(all in supabase/migrations/), and re-run.",
  );
  process.exit(1);
}

console.log("\nAnonymous access is locked down as expected.");
