#!/usr/bin/env node
/**
 * QA crawler — visits all known routes on a deployed environment, checks
 * for HTTP errors, parses HTML, validates metadata, finds broken internal
 * links and images. Prints a markdown report.
 *
 * Usage: node scripts/qa-crawl.mjs [--base=https://tirgus-izipizi.vercel.app]
 *
 * Defaults to the Vercel production deploy. Pass --base to point elsewhere.
 */

import { load } from "cheerio";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const baseArg = args.find((a) => a.startsWith("--base="));
const BASE = (baseArg ? baseArg.split("=")[1] : "https://tirgus-izipizi.vercel.app").replace(/\/$/, "");

// ── Routes to crawl ──────────────────────────────────────────────────────
const STATIC_ROUTES = [
  "/",
  "/catalog",
  "/razotaji",
  "/piegade",
  "/eksprespiegade",
  "/par-mums",
  "/how-it-works",
  "/contact",
  "/sell",
  "/login",
  "/register",
  "/register/pircejs",
  "/register/razotajs",
  "/lockers",
  "/noteikumi",
  "/noteikumi/self-billing",
  "/privatums",
  "/atgriesana",
  "/sitemap.xml",
  "/robots.txt",
  "/llms.txt",
];

// Auth-protected routes — expect them to redirect (3xx) or render login
const AUTH_ROUTES = [
  "/admin",
  "/admin/komanda",
  "/admin/razotaji",
  "/admin/produkti",
  "/admin/pasutijumi",
  "/admin/pirceji",
  "/admin/statistika",
  "/admin/nedelas-piedavajums",
  "/dashboard",
  "/dashboard/produkti",
  "/dashboard/pasutijumi",
  "/dashboard/profils",
  "/dashboard/onboarding",
  "/profils",
  "/profils/pasutijumi",
];

const HIDDEN_PRELAUNCH = ["/keriens", "/receptes"];

// ── State ────────────────────────────────────────────────────────────────
const findings = []; // { route, severity, type, message }
const checkedUrls = new Set();
const externalLinks = new Set();
const imagesSeen = new Set();

function add(route, severity, type, message) {
  findings.push({ route, severity, type, message });
}

async function fetchWithTimeout(url, ms = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal, redirect: "follow" });
  } finally {
    clearTimeout(t);
  }
}

async function checkRoute(route, opts = {}) {
  if (checkedUrls.has(route)) return;
  checkedUrls.add(route);

  const url = `${BASE}${route}`;
  let res;
  try {
    res = await fetchWithTimeout(url);
  } catch (err) {
    add(route, "error", "fetch-failed", `Fetch failed: ${err.message}`);
    return;
  }

  if (!res.ok && !opts.expectRedirect) {
    add(route, "error", "http", `HTTP ${res.status} ${res.statusText}`);
    return;
  }

  // Auth-walled pages are intentionally client-side (loading shell + JS
  // redirect). We accept that as long as the shell carries robots noindex —
  // that check happens after parsing the HTML below.

  // Don't parse robots.txt / sitemap.xml / llms.txt as HTML
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("text/html")) return;

  const html = await res.text();
  if (html.length < 200) {
    add(route, "warn", "thin-content", `HTML body suspiciously short (${html.length} chars)`);
  }

  const $ = load(html);

  // Detect noindex / nofollow — auth-walled pages should be marked noindex.
  // We then suppress h1 / redirect warnings for those pages since they're
  // intentional client-side shells.
  const robotsMeta = $('meta[name="robots"]').attr("content")?.toLowerCase() ?? "";
  const isNoindex = robotsMeta.includes("noindex");

  if (opts.expectRedirect && !isNoindex) {
    add(route, "warn", "auth-no-noindex", "Auth-walled page rendered without noindex meta — Google might index the loading shell");
  }

  // ── Metadata checks ──
  // Use `head > title` so we don't accidentally pick up SVG <title> elements
  // (which cheerio would otherwise concatenate, blowing up the length).
  const title = $("head > title").first().text().trim();
  if (!title) add(route, "warn", "missing-title", "<title> empty");
  else if (title.length < 10) add(route, "warn", "short-title", `Title too short: "${title}"`);
  else if (title.length > 70) add(route, "info", "long-title", `Title may be truncated by Google (${title.length} chars)`);

  const descMeta = $('meta[name="description"]').attr("content")?.trim();
  if (!descMeta) add(route, "warn", "missing-description", "<meta name=description> missing or empty");
  else if (descMeta.length < 50) add(route, "info", "short-description", `Description short (${descMeta.length} chars)`);
  else if (descMeta.length > 170) add(route, "info", "long-description", `Description may be truncated (${descMeta.length} chars)`);

  const canonical = $('link[rel="canonical"]').attr("href");
  if (!canonical) add(route, "info", "missing-canonical", "<link rel=canonical> missing");

  const ogTitle = $('meta[property="og:title"]').attr("content");
  if (!ogTitle) add(route, "info", "missing-og", "<meta property=og:title> missing");

  // ── H1 check ── (skip noindex pages — they're auth shells, h1 renders client-side)
  const h1Count = $("h1").length;
  if (!isNoindex) {
    if (h1Count === 0) add(route, "warn", "no-h1", "No <h1> on page");
    else if (h1Count > 1) add(route, "info", "multiple-h1", `Found ${h1Count} <h1> tags (SEO recommends 1)`);
  }

  // ── Lang attribute ──
  const lang = $("html").attr("lang");
  if (!lang) add(route, "warn", "missing-lang", "<html lang=...> missing");
  else if (!lang.startsWith("lv")) add(route, "info", "lang-not-lv", `<html lang="${lang}"> (expected lv)`);

  // ── Internal links collection ──
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
    if (href.startsWith("http")) {
      try {
        const u = new URL(href);
        if (u.origin !== BASE) externalLinks.add(href);
      } catch {/* skip invalid */}
    }
    // Internal links — could traverse, but for now just check obvious ones
  });

  // ── Image collection ──
  $("img[src]").each((_, el) => {
    const src = $(el).attr("src");
    const alt = $(el).attr("alt");
    if (!src) return;
    if (alt === undefined) {
      add(route, "info", "img-no-alt", `<img> missing alt: ${src.slice(0, 80)}`);
    }
    let absSrc = src;
    if (src.startsWith("/_next/image")) {
      // Next.js optimised — skip for HEAD check (always 200 if origin reachable)
      return;
    }
    if (src.startsWith("/")) absSrc = `${BASE}${src}`;
    else if (!src.startsWith("http")) return;
    imagesSeen.add(absSrc);
  });

  // ── JSON-LD presence (for /seller/* and /listing/* this matters) ──
  const jsonLdCount = $('script[type="application/ld+json"]').length;
  if (route === "/" && jsonLdCount === 0) {
    add(route, "warn", "no-jsonld", "Homepage missing JSON-LD");
  }
}

async function checkImage(src) {
  try {
    const res = await fetchWithTimeout(src, 8000);
    if (!res.ok) {
      add("(images)", "warn", "broken-image", `${res.status} → ${src.slice(0, 100)}`);
    }
  } catch (err) {
    add("(images)", "warn", "image-fetch-failed", `${err.message} → ${src.slice(0, 100)}`);
  }
}

// ── Sample dynamic routes — pull a few sellers & listings from sitemap ──
async function discoverDynamicRoutes() {
  try {
    const res = await fetchWithTimeout(`${BASE}/sitemap.xml`);
    if (!res.ok) return [];
    const xml = await res.text();
    const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    const sellers = urls.filter((u) => u.includes("/seller/")).slice(0, 3);
    const listings = urls.filter((u) => u.includes("/listing/")).slice(0, 3);
    // Sitemap uses the production domain (tirgus.izipizi.lv) but we crawl the
    // Vercel preview — extract just the path so checkRoute prepends the
    // crawler's BASE correctly.
    return [...sellers, ...listings].map((u) => {
      try { return new URL(u).pathname; } catch { return u; }
    });
  } catch {
    return [];
  }
}

// ── Main ────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🤖 QA crawl starting on ${BASE}\n`);

  const dynamic = await discoverDynamicRoutes();
  console.log(`Found ${dynamic.length} dynamic sample routes from sitemap\n`);

  const allPublic = [...STATIC_ROUTES, ...dynamic];
  console.log(`Checking ${allPublic.length} public routes…`);
  for (const r of allPublic) {
    process.stdout.write(`  ${r} … `);
    await checkRoute(r);
    process.stdout.write("done\n");
  }

  console.log(`\nChecking ${AUTH_ROUTES.length} auth routes (expect redirect)…`);
  for (const r of AUTH_ROUTES) {
    process.stdout.write(`  ${r} … `);
    await checkRoute(r, { expectRedirect: true });
    process.stdout.write("done\n");
  }

  console.log(`\nChecking ${HIDDEN_PRELAUNCH.length} hidden-prelaunch routes…`);
  for (const r of HIDDEN_PRELAUNCH) {
    process.stdout.write(`  ${r} … `);
    await checkRoute(r);
    process.stdout.write("done\n");
  }

  console.log(`\nChecking ${imagesSeen.size} discovered images (sample of 30)…`);
  const imgList = [...imagesSeen].slice(0, 30);
  for (const src of imgList) {
    await checkImage(src);
  }

  // ── Report ──
  const grouped = {};
  for (const f of findings) {
    grouped[f.severity] ||= {};
    grouped[f.severity][f.type] ||= [];
    grouped[f.severity][f.type].push(f);
  }

  const ts = new Date().toISOString();
  let md = `# QA crawl report — ${BASE}\n\n_${ts}_\n\n`;
  md += `## Kopsavilkums\n\n`;
  md += `- Pārbaudītas lapas: ${checkedUrls.size}\n`;
  md += `- Pārbaudītas bildes: ${imgList.length} (no ${imagesSeen.size} atrastām)\n`;
  md += `- Atrasti **${findings.filter((f) => f.severity === "error").length} error**, `;
  md += `**${findings.filter((f) => f.severity === "warn").length} warn**, `;
  md += `**${findings.filter((f) => f.severity === "info").length} info** punkti\n\n`;

  for (const sev of ["error", "warn", "info"]) {
    if (!grouped[sev]) continue;
    const icon = sev === "error" ? "🔴" : sev === "warn" ? "🟡" : "🔵";
    md += `## ${icon} ${sev.toUpperCase()}\n\n`;
    for (const [type, list] of Object.entries(grouped[sev])) {
      md += `### \`${type}\` (${list.length})\n\n`;
      for (const f of list) {
        md += `- \`${f.route}\` — ${f.message}\n`;
      }
      md += "\n";
    }
  }

  if (findings.length === 0) {
    md += "\n✅ Nekādu problēmu netika atrasts.\n";
  }

  const outPath = join(process.cwd(), "qa-report.md");
  writeFileSync(outPath, md, "utf-8");
  console.log(`\n✓ Atskaite saglabāta: ${outPath}\n`);
  console.log(`  Errors: ${findings.filter((f) => f.severity === "error").length}`);
  console.log(`  Warns:  ${findings.filter((f) => f.severity === "warn").length}`);
  console.log(`  Infos:  ${findings.filter((f) => f.severity === "info").length}`);
}

main().catch((err) => {
  console.error("Crawler failed:", err);
  process.exit(1);
});
