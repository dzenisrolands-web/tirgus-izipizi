#!/usr/bin/env node
/**
 * Enumerate EVERY table/view the anon role can see and report which ones
 * return rows. Unlike verify-rls-lockdown.mjs (a fixed list of known-sensitive
 * tables), this discovers tables from the PostgREST OpenAPI document, so a
 * table nobody remembered cannot slip through.
 *
 *   node scripts/audit-anon-exposure.mjs
 *
 * Reads use GET with `limit=1`. The write section sends PATCH/DELETE that
 * target a row id that cannot exist (and set `id` to that same value), so no
 * row can ever change. It measures whether anon still HOLDS the privilege:
 * 401/403 = revoked, 2xx = held (RLS may still filter every row).
 *
 * INSERT cannot be probed without risking a real row, so it is NOT covered.
 * Check anon INSERT grants with the SQL in supabase/diagnostics (see PR).
 */

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!URL_ || !KEY) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
  process.exit(2);
}
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}` };

// Tables that are intentionally public catalogue data.
const EXPECTED_PUBLIC = new Set([
  "pakomati", "compartments", "listings", "sellers_public", "reviews",
  "weekly_featured", "hot_drops", "categories",
]);

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (["node_modules", ".next", ".git", ".turbo"].includes(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|js|mjs|sql)$/.test(name)) out.push(p);
  }
  return out;
}

/** Table names referenced by the app (`.from("x")`) or created by migrations. */
function tablesFromRepo() {
  const found = new Set();
  for (const f of walk(ROOT)) {
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(/\.from\(\s*["'`]([a-z_][a-z0-9_]*)["'`]\s*\)/g)) found.add(m[1]);
    for (const m of src.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z_][a-z0-9_]*)/gi)) {
      found.add(m[1].toLowerCase());
    }
  }
  return [...found].sort();
}

// 1) Ask PostgREST. Newer Supabase projects hide the schema from the
//    publishable key, in which case this returns nothing.
let tables = [];
let source = "PostgREST OpenAPI";
try {
  const spec = await (await fetch(`${URL_}/rest/v1/`, { headers })).json();
  tables = Object.keys(spec.paths ?? {})
    .filter((p) => p !== "/" && !p.startsWith("/rpc/"))
    .map((p) => p.slice(1))
    .sort();
} catch { /* fall through */ }

// 2) Fall back to every table the repo references or creates. An empty
//    discovery result must NEVER be reported as "nothing exposed".
if (tables.length === 0) {
  tables = tablesFromRepo();
  source = "repo scan (.from(...) + CREATE TABLE)";
}
if (tables.length === 0) {
  console.error("Could not discover any tables; refusing to report a clean result.");
  process.exit(2);
}

console.log(`\nProbing ${tables.length} tables, discovered via ${source}\n`);

const rowsReturned = [];
const empty = [];
const blocked = [];

for (const t of tables) {
  const res = await fetch(`${URL_}/rest/v1/${t}?select=*&limit=1`, { headers });
  if (res.status === 404) continue; // referenced in code but not an exposed table
  if (!res.ok) { blocked.push(`${t} (HTTP ${res.status})`); continue; }
  const body = await res.json().catch(() => []);
  if (Array.isArray(body) && body.length > 0) {
    rowsReturned.push({ t, cols: Object.keys(body[0]) });
  } else {
    empty.push(t);
  }
}

const PII_HINT = /(email|phone|tel|address|adrese|name|vards|iban|pin|code|token|secret|password|ip|payment)/i;

console.log("RETURNS ROWS to anonymous visitors:");
for (const { t, cols } of rowsReturned) {
  const expected = EXPECTED_PUBLIC.has(t);
  const pii = cols.filter((c) => PII_HINT.test(c));
  const flag = expected ? (pii.length ? "review" : "ok    ") : "CHECK ";
  console.log(`  [${flag}] ${t}${pii.length ? `  sensitive-looking columns: ${pii.join(", ")}` : ""}`);
}

console.log(`\nEmpty or no rows for anon (${empty.length}): ${empty.join(", ") || "-"}`);
console.log(`Blocked for anon (${blocked.length}): ${blocked.join(", ") || "-"}`);

const unexpected = rowsReturned.filter(({ t }) => !EXPECTED_PUBLIC.has(t));
console.log(
  unexpected.length
    ? `\n${unexpected.length} table(s) return rows but are not on the expected-public list. Review each.`
    : "\nNo unexpected tables return rows.",
);

// ── Write privileges (UPDATE / DELETE) across every discovered table ─────────────────────────────────
console.log("\nWRITE PRIVILEGES held by anon (UPDATE / DELETE, impossible-id probes):");
const IMPOSSIBLE_UUID = "00000000-0000-0000-0000-000000000000";
const writeHeaders = { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" };
const allowed = [];
const inconclusive = [];
let probed = 0;

for (const t of tables) {
  const sampleRes = await fetch(`${URL_}/rest/v1/${t}?select=*&limit=1`, { headers });
  if (sampleRes.status === 404) continue;
  const sample = sampleRes.ok ? (await sampleRes.json().catch(() => []))?.[0] : undefined;
  const impossible = typeof sample?.id === "number" ? -1 : IMPOSSIBLE_UUID;

  const upd = await fetch(`${URL_}/rest/v1/${t}?id=eq.${impossible}`, {
    method: "PATCH", headers: writeHeaders, body: JSON.stringify({ id: impossible }),
  });
  const del = await fetch(`${URL_}/rest/v1/${t}?id=eq.${impossible}`, {
    method: "DELETE", headers: writeHeaders,
  });
  probed += 1;

  if (upd.ok || del.ok) {
    allowed.push(`${t} (UPDATE ${upd.ok ? "yes" : "no"}, DELETE ${del.ok ? "yes" : "no"})`);
  } else if (upd.status === 400 || del.status === 400) {
    inconclusive.push(t);
  }
}

console.log(`  probed ${probed} tables`);
console.log(`  ALLOWED (anon holds the privilege): ${allowed.length ? "\n    - " + allowed.join("\n    - ") : "none"}`);
console.log(`  inconclusive (HTTP 400, e.g. no id column) — NOT proof of safety: ${inconclusive.join(", ") || "none"}`);

if (allowed.length > 0) {
  console.log("\nAnonymous write privileges remain. Revoke them (see migration 0036).");
  process.exit(1);
}
console.log("\nNo UPDATE/DELETE privilege is held by anon on any probed table.");
