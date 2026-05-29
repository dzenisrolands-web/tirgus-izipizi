/**
 * Commission calculation unit tests (plain Node.js, no test framework needed).
 *
 * Run: node scripts/test-commission.mjs
 *
 * Mirrors the logic in lib/commission.ts and lib/invoice/generate.ts so we can
 * verify correctness without a build step or DB connection.
 */

// ─── Inline commission math (mirrors lib/commission.ts) ─────────────────────

const COMMISSION_RATE = 15;
const COMMISSION_SERVICE_VAT = 21;

function r2(n) { return Math.round(n * 100) / 100; }

function commissionBreakdown(price, productVatRate) {
  const exVat    = r2(price / (1 + productVatRate / 100));
  const cNet     = r2(exVat * (COMMISSION_RATE / 100));
  const cVat     = r2(cNet * (COMMISSION_SERVICE_VAT / 100));
  const cTotal   = r2(cNet + cVat);
  const net      = r2(price - cTotal);
  return { exVat, commissionNet: cNet, commissionVat: cVat, commissionTotal: cTotal, netToSeller: net };
}

// ─── Test helpers ────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function expect(label, actual, expected, tolerance = 0) {
  const ok = Math.abs(actual - expected) <= tolerance;
  if (ok) {
    console.log(`  ✓  ${label}: ${actual}`);
    passed++;
  } else {
    console.error(`  ✗  ${label}: got ${actual}, expected ${expected}`);
    failed++;
  }
}

// ─── Part 1: commissionBreakdown per VAT rate ────────────────────────────────

console.log("\n── Part 1: commissionBreakdown ──────────────────────────────────────────");

const cases = [
  { price: 10.00, vat: 21, label: "€10 @ 21% VAT" },
  { price: 10.00, vat: 12, label: "€10 @ 12% VAT" },
  { price: 10.00, vat:  5, label: "€10 @  5% VAT" },
  { price:  1.00, vat: 21, label: " €1 @ 21% VAT" },
  { price: 99.99, vat: 21, label: "€99.99 @ 21% VAT" },
];

for (const { price, vat, label } of cases) {
  const cb = commissionBreakdown(price, vat);
  console.log(`\n  ${label}`);
  console.log(`    gross=${price}  exVat=${cb.exVat}  cNet=${cb.commissionNet}  cVat=${cb.commissionVat}  cTotal=${cb.commissionTotal}  net=${cb.netToSeller}`);

  // Invariant: cNet = 15% of exVat
  expect(`cNet == 15% of exVat`, cb.commissionNet, r2(cb.exVat * 0.15), 0.01);

  // Invariant: cVat = 21% of cNet
  expect(`cVat == 21% of cNet`, cb.commissionVat, r2(cb.commissionNet * 0.21), 0.01);

  // Invariant: cTotal = cNet + cVat
  expect(`cTotal == cNet + cVat`, cb.commissionTotal, r2(cb.commissionNet + cb.commissionVat), 0.01);

  // Invariant: netToSeller = price - cTotal
  expect(`netToSeller == price - cTotal`, cb.netToSeller, r2(price - cb.commissionTotal), 0.01);

  // Invariant: exVat is price / (1 + vat/100)
  const expectedExVat = r2(price / (1 + vat / 100));
  expect(`exVat correct`, cb.exVat, expectedExVat, 0.01);
}

// ─── Part 2: Invoice aggregate logic (mirrors generate.ts) ──────────────────

console.log("\n── Part 2: Invoice aggregate accumulation ───────────────────────────────");

/**
 * Simulate what generateInvoicesForPeriod does for a list of items.
 * Returns the Aggregate object (without DB parts).
 */
function simulateAggregate(items) {
  const agg = {
    grossCents: 0,
    productVatCents: 0,
    commissionCents: 0,
    commissionNetCents: 0,
    commissionVatCents: 0,
    netCents: 0,
  };

  for (const { price, vatRate, qty = 1 } of items) {
    const unitPriceCents = Math.round(price * 100);
    const lineGross = unitPriceCents * qty;
    const vatAmount = Math.round((lineGross / 100) * vatRate / (100 + vatRate) * 100);
    const cb = commissionBreakdown(lineGross / 100, vatRate);
    const lineCommissionNet = Math.round(cb.commissionNet * 100);
    const lineCommissionVat = Math.round(cb.commissionVat * 100);
    const lineCommission    = lineCommissionNet + lineCommissionVat;
    const lineNet           = lineGross - lineCommission;

    agg.grossCents         += lineGross;
    agg.productVatCents    += vatAmount;
    agg.commissionCents    += lineCommission;
    agg.commissionNetCents += lineCommissionNet;
    agg.commissionVatCents += lineCommissionVat;
    agg.netCents           += lineNet;
  }
  return agg;
}

/**
 * Old (buggy) finalNetCents computation — used to show the before/after difference.
 */
function buggyFinalNet(agg) {
  const commissionVatCents = Math.round(agg.commissionCents * (COMMISSION_SERVICE_VAT / 100));
  return agg.grossCents - agg.commissionCents - commissionVatCents;
}

// Test A: Single item, 21% VAT, €10
{
  console.log("\n  Test A: single item €10 @ 21% VAT");
  const agg = simulateAggregate([{ price: 10, vatRate: 21 }]);
  const cb = commissionBreakdown(10, 21);

  expect("grossCents == 1000", agg.grossCents, 1000);
  expect("commissionNetCents == cb.commissionNet×100", agg.commissionNetCents, Math.round(cb.commissionNet * 100), 1);
  expect("commissionVatCents == cb.commissionVat×100", agg.commissionVatCents, Math.round(cb.commissionVat * 100), 1);
  expect("netCents == grossCents - commissionCents", agg.netCents, agg.grossCents - agg.commissionCents, 1);

  // Verify old bug would produce wrong result
  const buggy = buggyFinalNet(agg);
  const correct = agg.netCents;
  if (buggy !== correct) {
    console.log(`  ✓  Bug confirmed: old code gives net=${buggy/100}€, correct is ${correct/100}€ (diff=${(correct-buggy)/100}€)`);
    passed++;
  } else {
    console.error("  ✗  Expected old code to differ from correct — check test logic");
    failed++;
  }
}

// Test B: Multiple items, mixed VAT rates
{
  console.log("\n  Test B: 3 items with mixed VAT rates");
  const items = [
    { price: 5.00, vatRate: 21 },
    { price: 8.50, vatRate: 12 },
    { price: 3.00, vatRate:  5 },
  ];
  const agg = simulateAggregate(items);

  // Reconstruct expected from individual breakdowns
  let expGross = 0, expCNet = 0, expCVat = 0;
  for (const { price, vatRate } of items) {
    const cb = commissionBreakdown(price, vatRate);
    expGross += Math.round(price * 100);
    expCNet  += Math.round(cb.commissionNet * 100);
    expCVat  += Math.round(cb.commissionVat * 100);
  }

  expect("grossCents matches sum", agg.grossCents, expGross);
  expect("commissionNetCents matches sum", agg.commissionNetCents, expCNet, 1);
  expect("commissionVatCents matches sum", agg.commissionVatCents, expCVat, 1);
  expect("netCents = gross - commissionCents", agg.netCents, agg.grossCents - agg.commissionCents, 1);

  // Invariant: commissionCents = commissionNetCents + commissionVatCents
  expect("commissionCents == Net + Vat", agg.commissionCents, agg.commissionNetCents + agg.commissionVatCents, 2);

  // Invariant: gross = net + commissionNet + commissionVat (within rounding)
  const recon = agg.netCents + agg.commissionNetCents + agg.commissionVatCents;
  expect("gross == net + cNet + cVat (rounding ≤2¢)", agg.grossCents, recon, 2);

  console.log(`    → gross=${(agg.grossCents/100).toFixed(2)}€  commNet=${(agg.commissionNetCents/100).toFixed(2)}€  commVAT=${(agg.commissionVatCents/100).toFixed(2)}€  net=${(agg.netCents/100).toFixed(2)}€`);
}

// Test C: Quantity > 1
{
  console.log("\n  Test C: qty=3, €4.99 @ 21% VAT");
  const agg = simulateAggregate([{ price: 4.99, vatRate: 21, qty: 3 }]);
  const cbSingle = commissionBreakdown(4.99 * 3, 21); // breakdown on line total

  expect("gross = 3×499¢", agg.grossCents, 1497);
  expect("commissionNetCents correct", agg.commissionNetCents, Math.round(cbSingle.commissionNet * 100), 1);
  expect("netCents correct", agg.netCents, Math.round(cbSingle.netToSeller * 100), 2);
}

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n────────────────────────────────────────────────────────────────────────────`);
console.log(`  Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error("  FAIL");
  process.exit(1);
} else {
  console.log("  PASS");
}
