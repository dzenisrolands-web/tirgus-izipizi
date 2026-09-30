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
 * cannot exist, so a "permitted" result means RLS allowed the statement
 * through (0 rows matched), never that data changed.
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

/** Tables anonymous users must never be able to modify. */
const MUST_BE_READ_ONLY = ["orders", "pakomati", "compartments"];

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
  const res = await fetch(
    `${URL_}/rest/v1/${table}?id=eq.${IMPOSSIBLE_ID}`,
    {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({}),
    },
  );
  // 2xx / 404-with-empty-body means the statement was accepted (RLS allowed it).
  // 401/403/42501 means RLS blocked it, which is what we want.
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
  const r = await probeRead(t);
  if (r.status === 404) {
    console.log(`  [skip] ${t} — table does not exist`);
    continue;
  }
  // An empty table is not a failure, only an outright error is.
  record(r.status === 200, `${t} — HTTP ${r.status}, ${r.rows} row(s)`);
}

console.log("\nMust NOT be writable by anonymous visitors");
for (const t of MUST_BE_READ_ONLY) {
  const w = await probeWrite(t);
  record(
    !w.permitted,
    w.permitted
      ? `${t} — anonymous UPDATE ACCEPTED (HTTP ${w.status})`
      : `${t} — anonymous UPDATE rejected (HTTP ${w.status})`,
  );
}

console.log(
  `\n${results.checks - results.failures}/${results.checks} checks passed.`,
);

if (results.failures > 0) {
  console.log(
    "\nMigration 0030 has not been applied, or did not fully take effect.\n" +
      "Apply supabase/migrations/0030_rls_lockdown_pii.sql and re-run.",
  );
  process.exit(1);
}

console.log("\nAnonymous access is locked down as expected.");
