#!/usr/bin/env node
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
export function referencedTables() {
  // Documented security focus; existence still requires catalog confirmation.
  const tables = new Set(["user_roles"]);
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (["node_modules", ".next", ".git", ".turbo"].includes(entry.name)) continue;
      const file = join(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (/\.(tsx?|mjs|sql)$/.test(entry.name)) {
        const source = readFileSync(file, "utf8");
        for (const match of source.matchAll(/(?<!\.storage)\.from\(\s*["'`]([a-z_][a-z0-9_]*)["'`]\s*\)/g)) tables.add(match[1]);
        for (const match of source.matchAll(/(?:create|alter)\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z_][a-z0-9_]*)/gi)) tables.add(match[1].toLowerCase());
        if (entry.name.endsWith(".sql")) for (const match of source.matchAll(/\b(?:from|join|on|table|update|into)\s+public\.([a-z_][a-z0-9_]*)\b(?!\s*\()/gi)) tables.add(match[1].toLowerCase());
      }
    }
  }
  walk(join(root, "apps"));
  walk(join(root, "supabase"));
  return [...tables].sort();
}

export function sourcePolicyReview() {
  const mentions = new Map();
  const directory = join(root, "supabase/migrations");
  for (const file of readdirSync(directory).filter(name => name.endsWith(".sql")).sort()) {
    const sql = readFileSync(join(directory, file), "utf8");
    for (const m of sql.matchAll(/create\s+policy\s+(?:"([^"]+)"|([a-z0-9_]+))\s+on\s+(?:public\.)?([a-z0-9_]+)/gi)) {
      const entries = mentions.get(m[3]) ?? [];
      entries.push({ policy: m[1] ?? m[2], source: `supabase/migrations/${file}`, effectiveInLiveDatabase: "unknown" });
      mentions.set(m[3], entries);
    }
  }
  const notes = {
    sellers: "0036 documents owner UPDATE of mutable approval/private fields; current column guards and effective grants need live verification.",
    profiles: "0037 documents mutable role/free-delivery-credit fields; verify guards separately from immutable app_metadata authorization.",
    user_roles: "0037 documents historical public role-table reads. Verify effective read/write grants and role-escalation boundaries.",
    pwa_events: "0036 intends anon INSERT here. Verify exact policies/column grants, limits and retention; intentional is not automatically risk-free.",
    sellers_public: "Intended public allowlisted view. Verify columns, view-owner/security-invoker behavior and underlying grants.",
    listings: "Intended public active catalog and authenticated owner/admin writes. Verify permissive/restrictive policy combination and private columns.",
    weekly_featured: "0037 intends pending-only seller writes and admin approval. Verify effective policies, not just CREATE statements.",
  };
  return {
    evidence: "tracked_source_only_not_effective_live_policy_set",
    liveAuditComplete: false, applicationRowsRead: false, writesExecuted: false,
    publicAnonKeyIsExpected: true,
    warning: "Historical policy mentions may have been dropped/replaced by later dynamic SQL. They are NOT the current policy list.",
    tables: referencedTables().map(table => ({
      table, candidateIdentityVerified: false,
      historicalPolicyMentions: mentions.get(table) ?? [],
      risk: notes[table] ?? "Unknown until live catalog ACL/RLS/view/RPC diagnostics are reviewed; no clean result inferred.",
      anonRead: "unknown", anonInsert: "unknown", anonUpdate: "unknown", anonDelete: "unknown",
    })),
    requiredDiagnostic: "supabase/diagnostics/anon_rls_catalog.sql",
  };
}

/** No data rows, write probes or RPC execution. HEAD is not proof of row visibility. */
export async function auditAnonRead({ url, key, fetcher = fetch, candidates = referencedTables() }) {
  const report = { liveAuditComplete: false, schemaCoverage: "unknown", writePrivilegesVerified: false, tables: [] };
  if (!url || !key) return { ...report, blocker: "PUBLIC_CONFIGURATION_MISSING", candidates };
  const origin = new URL(url);
  if (origin.protocol !== "https:" || origin.username || origin.password || origin.search || origin.hash || origin.pathname !== "/") {
    throw new Error("Invalid public origin");
  }
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const names = new Set(candidates);
  let openApiAvailable = false;
  try {
    const response = await fetcher(`${origin.origin}/rest/v1/`, { headers, redirect: "error", signal: AbortSignal.timeout(10000) });
    if (response.ok) {
      const specification = await response.json();
      for (const path of Object.keys(specification.paths ?? {})) {
        if (/^\/[a-z_][a-z0-9_]*$/.test(path)) names.add(path.slice(1));
      }
      openApiAvailable = true;
    }
  } catch { /* No schema visibility is not a clean security finding. */ }
  for (const table of [...names].filter(name => /^[a-z_][a-z0-9_]*$/.test(name)).sort()) {
    let status = null;
    try {
      const response = await fetcher(`${origin.origin}/rest/v1/${encodeURIComponent(table)}?select=*&limit=0`, {
        method: "HEAD", headers, redirect: "error", signal: AbortSignal.timeout(10000),
      });
      status = response.status;
    } catch { /* Keep the observation unknown; never print request/secret details. */ }
    report.tables.push({
      table, headStatus: status,
      selectExecution: status !== null && status >= 200 && status < 300 ? "allowed_row_visibility_unknown"
        : status === 401 || status === 403 ? "blocked_for_this_projection"
          : status === 404 ? "not_exposed_or_not_found" : "unknown",
      policies: "requires_catalog_diagnostic", anonInsert: "unknown", anonUpdate: "unknown", anonDelete: "unknown",
      risk: "catalog_and_column_privilege_review_required",
    });
  }
  return { ...report, openApiAvailable, diagnostic: "supabase/diagnostics/anon_rls_catalog.sql" };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.slice(2).some(arg => arg !== "--source-only")) throw new Error("Unsupported audit mode");
    const report = process.argv.includes("--source-only") ? sourcePolicyReview()
      : await auditAnonRead({ url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY });
    console.log(JSON.stringify(report, null, 2));
    // Actual catalog/write-policy completeness is intentionally never inferred
    // from an empty projection or an inaccessible OpenAPI endpoint.
    process.exitCode = 2;
  } catch {
    console.log(JSON.stringify({ liveAuditComplete: false, blocker: "READ_OBSERVATION_UNAVAILABLE" }));
    process.exitCode = 2;
  }
}
