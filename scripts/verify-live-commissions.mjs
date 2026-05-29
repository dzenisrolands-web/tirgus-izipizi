/**
 * Production invoice commission verification.
 *
 * Connects to the production Supabase DB, fetches all invoices + their lines,
 * and cross-checks every number against the commission formula:
 *
 *   commissionNet  = exVat  × 15%
 *   commissionVat  = commissionNet × 21%
 *   commissionTotal = commissionNet + commissionVat
 *   net            = gross - commissionTotal
 *
 * Reports any discrepancies > 2 cents (rounding tolerance).
 *
 * Run: node scripts/verify-live-commissions.mjs
 */

import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

// ─── Load .env.local ──────────────────────────────────────────────────────────

function loadEnv(path) {
  try {
    const lines = readFileSync(path, "utf8").split(/\r?\n/);
    const env = {};
    for (const line of lines) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
    }
    return env;
  } catch {
    return {};
  }
}

const env = loadEnv(".env.local");
const SUPABASE_URL = env["NEXT_PUBLIC_SUPABASE_URL"] || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = env["SUPABASE_SECRET_KEY"] || process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY. Check .env.local.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Commission math (mirrors lib/commission.ts) ──────────────────────────────

const COMMISSION_RATE     = 15;
const COMMISSION_SVC_VAT  = 21;

function r2(n) { return Math.round(n * 100) / 100; }

function commissionBreakdown(price, productVatRate) {
  const exVat  = r2(price / (1 + productVatRate / 100));
  const cNet   = r2(exVat  * (COMMISSION_RATE / 100));
  const cVat   = r2(cNet   * (COMMISSION_SVC_VAT / 100));
  const cTotal = r2(cNet + cVat);
  const net    = r2(price - cTotal);
  return { exVat, commissionNet: cNet, commissionVat: cVat, commissionTotal: cTotal, netToSeller: net };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TOLERANCE = 2; // cents — acceptable rounding gap
let errors = 0;
let warnings = 0;

function check(label, actual, expected, context = "") {
  const diff = Math.abs(actual - expected);
  if (diff > TOLERANCE) {
    console.error(`  ✗  ${label}: got ${actual}, expected ${expected} (diff ${diff}¢)${context ? "  [" + context + "]" : ""}`);
    errors++;
    return false;
  }
  return true;
}

function c(cents) { return `€${(cents / 100).toFixed(2)}`; }

// ─── Main ─────────────────────────────────────────────────────────────────────

console.log("\n── Fetching invoices from production ───────────────────────────────────────");

const { data: invoices, error: invErr } = await supabase
  .from("invoices")
  .select("id, invoice_number, period_start, period_end, status, total_gross_cents, total_ex_vat_cents, total_product_vat_cents, total_commission_cents, commission_vat_rate, commission_vat_cents, total_net_cents")
  .order("created_at", { ascending: false });

if (invErr) {
  console.error("Failed to fetch invoices:", invErr.message);
  process.exit(1);
}

if (!invoices || invoices.length === 0) {
  console.log("\n  No invoices found in the database.");
  console.log("  Invoices are generated on the 1st and 16th of each month.");
  console.log("  You can trigger generation manually via POST /api/cron/generate-invoices.");
  console.log("\n  Showing a sample calculation to confirm formula is correct:");

  const sample = commissionBreakdown(10.00, 21);
  console.log(`\n  Sample: €10.00 product @ 21% VAT`);
  console.log(`    exVat          = ${c(Math.round(sample.exVat * 100))}`);
  console.log(`    commissionNet  = ${c(Math.round(sample.commissionNet * 100))}  (15% of exVat)`);
  console.log(`    commissionVat  = ${c(Math.round(sample.commissionVat * 100))}  (21% of commissionNet)`);
  console.log(`    commissionTotal= ${c(Math.round(sample.commissionTotal * 100))}`);
  console.log(`    net to seller  = ${c(Math.round(sample.netToSeller * 100))}`);
  process.exit(0);
}

console.log(`  Found ${invoices.length} invoice(s)\n`);

// Fetch all invoice lines in one query
const invoiceIds = invoices.map(i => i.id);
const { data: allLines, error: linesErr } = await supabase
  .from("invoice_lines")
  .select("invoice_id, line_gross_cents, ex_vat_cents, vat_rate, commission_rate, commission_cents, net_cents")
  .in("invoice_id", invoiceIds);

if (linesErr) {
  console.error("Failed to fetch invoice lines:", linesErr.message);
  process.exit(1);
}

const linesByInvoice = new Map();
for (const line of (allLines ?? [])) {
  if (!linesByInvoice.has(line.invoice_id)) linesByInvoice.set(line.invoice_id, []);
  linesByInvoice.get(line.invoice_id).push(line);
}

// ─── Verify each invoice ──────────────────────────────────────────────────────

console.log("── Verifying invoice-level totals ───────────────────────────────────────────");

let invoicesOk = 0;

for (const inv of invoices) {
  const lines = linesByInvoice.get(inv.id) ?? [];
  const tag = `${inv.invoice_number} (${inv.period_start}→${inv.period_end}, ${inv.status})`;

  // Re-aggregate from lines
  let sumGross = 0, sumExVat = 0, sumProductVat = 0;
  let sumCommNet = 0, sumCommVat = 0, sumNet = 0;

  for (const line of lines) {
    const gross = Number(line.line_gross_cents);
    const vatRate = Number(line.vat_rate ?? 21);
    const cb = commissionBreakdown(gross / 100, vatRate);

    sumGross     += gross;
    sumExVat     += Math.round(cb.exVat          * 100);
    sumProductVat += Math.round((gross - Math.round(cb.exVat * 100)));  // gross - exVat in cents
    sumCommNet   += Math.round(cb.commissionNet   * 100);
    sumCommVat   += Math.round(cb.commissionVat   * 100);
    sumNet       += Math.round(cb.netToSeller     * 100);

    // ── Per-line checks ──
    // commission_cents should be commissionTotal (net+vat)
    const expectedLineComm = Math.round(cb.commissionTotal * 100);
    check(`line commission_cents`, Number(line.commission_cents), expectedLineComm, tag);

    // net_cents should be gross - commissionTotal
    const expectedLineNet = gross - expectedLineComm;
    check(`line net_cents`, Number(line.net_cents), expectedLineNet, tag);
  }

  // ── Invoice-level checks ──
  const invOk = [
    check(`total_gross_cents`,      Number(inv.total_gross_cents),      sumGross,    tag),
    check(`total_ex_vat_cents`,     Number(inv.total_ex_vat_cents),     sumExVat,    tag),
    check(`total_commission_cents`, Number(inv.total_commission_cents), sumCommNet,  tag),
    check(`commission_vat_cents`,   Number(inv.commission_vat_cents),   sumCommVat,  tag),
    check(`total_net_cents`,        Number(inv.total_net_cents),        sumNet,      tag),
  ].every(Boolean);

  if (invOk) {
    const netEur = (Number(inv.total_net_cents) / 100).toFixed(2);
    console.log(`  ✓  ${tag}  gross=${c(Number(inv.total_gross_cents))}  net=${c(Number(inv.total_net_cents))}  lines=${lines.length}`);
    invoicesOk++;
  }
}

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n────────────────────────────────────────────────────────────────────────────`);
console.log(`  Invoices: ${invoicesOk} OK, ${invoices.length - invoicesOk} with errors`);
console.log(`  Field errors: ${errors}  Warnings: ${warnings}`);

if (errors > 0) {
  console.error("\n  FAIL — discrepancies found. Check output above.");
  process.exit(1);
} else {
  console.log("\n  PASS — all invoice commission figures match the formula.");
}
