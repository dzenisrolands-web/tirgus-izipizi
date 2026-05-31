#!/usr/bin/env npx tsx
/**
 * Standalone verification script for commission + courier fee logic.
 * Run: npx tsx scripts/verify-invoice-logic.ts
 *
 * Tests the pure calculation functions without needing Supabase.
 */

import {
  COMMISSION_RATE,
  COMMISSION_FRACTION,
  COMMISSION_SERVICE_VAT,
  COURIER_FEE,
  commissionBreakdown,
  commissionForPrice,
  netForPrice,
  netForPriceWithDelivery,
  vatAmountFromInclusive,
  exVatPrice,
} from "../lib/commission";

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${label}`);
  }
}

function assertClose(actual: number, expected: number, label: string, tolerance = 0.01) {
  const ok = Math.abs(actual - expected) <= tolerance;
  if (ok) {
    passed++;
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${label} — got ${actual}, expected ${expected}`);
  }
}

// ── Constants ──
console.log("1. Constants");
assert(COMMISSION_RATE === 15, "COMMISSION_RATE = 15");
assert(COMMISSION_FRACTION === 0.15, "COMMISSION_FRACTION = 0.15");
assert(COMMISSION_SERVICE_VAT === 21, "COMMISSION_SERVICE_VAT = 21");
assert(COURIER_FEE === 3.50, "COURIER_FEE = 3.50");

// ── Commission breakdown for 21% VAT product at 10€ ──
console.log("2. commissionBreakdown(10, 21) — standard VAT");
const cb10 = commissionBreakdown(10, 21);
assertClose(cb10.exVat, 8.26, "exVat = 8.26");
assertClose(cb10.commissionNet, 1.24, "commissionNet = 1.24");
assertClose(cb10.commissionVat, 0.26, "commissionVat = 0.26");
assertClose(cb10.commissionTotal, 1.50, "commissionTotal = 1.50");
assertClose(cb10.netToSeller, 8.50, "netToSeller = 8.50");

// ── Commission breakdown for 5% VAT product at 10€ ──
console.log("3. commissionBreakdown(10, 5) — reduced VAT");
const cb5 = commissionBreakdown(10, 5);
assertClose(cb5.exVat, 9.52, "exVat = 9.52 (10/1.05)");
assertClose(cb5.commissionNet, 1.43, "commissionNet = 1.43 (9.52*0.15)");
assertClose(cb5.commissionVat, 0.30, "commissionVat = 0.30 (1.43*0.21)");
assertClose(cb5.commissionTotal, 1.73, "commissionTotal = 1.73");
assertClose(cb5.netToSeller, 8.27, "netToSeller = 8.27");

// ── Commission for standard 21% VAT ──
console.log("4. commissionForPrice / netForPrice");
assertClose(commissionForPrice(10), 1.50, "commissionForPrice(10) = 1.50");
assertClose(netForPrice(10), 8.50, "netForPrice(10) = 8.50");
assertClose(commissionForPrice(25), 3.75, "commissionForPrice(25) = 3.75");
assertClose(netForPrice(25), 21.25, "netForPrice(25) = 21.25");

// ── Courier fee deduction ──
console.log("5. netForPriceWithDelivery");
assertClose(netForPriceWithDelivery(10, false), 8.50, "no courier: 8.50");
assertClose(netForPriceWithDelivery(10, true), 5.00, "with courier: 8.50 - 3.50 = 5.00");
assertClose(netForPriceWithDelivery(25, true), 17.75, "25€ with courier: 21.25 - 3.50 = 17.75");

// ── VAT helpers ──
console.log("6. vatAmountFromInclusive / exVatPrice");
assertClose(vatAmountFromInclusive(10, 21), 1.74, "VAT from 10€ @21% = 1.74");
assertClose(vatAmountFromInclusive(10, 5), 0.48, "VAT from 10€ @5% = 0.48");
assertClose(exVatPrice(10, 21), 8.26, "exVat from 10€ @21% = 8.26");
assertClose(exVatPrice(10, 0), 10, "exVat from 10€ @0% = 10");

// ── Multi-seller courier fee scenario ──
console.log("7. Courier fee — one per order per seller");
{
  // Simulate: Seller A has 3 items across 2 orders → 2× COURIER_FEE
  const orderIds = new Set(["order-1", "order-1", "order-2"]);
  const courierFeeCents = Math.round(COURIER_FEE * 100) * orderIds.size;
  assert(courierFeeCents === 700, "2 unique orders × 350 cents = 700 cents");

  // Seller B is locker mode → 0 courier fee
  const isCourier = false;
  const bFeeCents = isCourier ? Math.round(COURIER_FEE * 100) * 3 : 0;
  assert(bFeeCents === 0, "locker seller: 0 courier fee");
}

// ── Invoice net calculation with courier fee ──
console.log("8. Invoice net = gross - commission - courierFee");
{
  // 3 items at 10€ each, 21% VAT, courier seller, 2 unique orders
  const grossCents = 3000; // 30€
  const cb = commissionBreakdown(30, 21);
  const commissionCents = Math.round(cb.commissionTotal * 100); // ~450
  const courierFeeCents = Math.round(COURIER_FEE * 100) * 2; // 700
  const netCents = grossCents - commissionCents - courierFeeCents;
  assertClose(netCents / 100, 30 - cb.commissionTotal - 7.00, "net = 30 - commission - 7.00 courier", 0.02);
  assert(netCents > 0, "net should be positive");
}

// ── Edge cases ──
console.log("9. Edge cases");
assertClose(commissionBreakdown(0, 21).commissionTotal, 0, "0€ → 0 commission");
assertClose(commissionBreakdown(0.01, 21).netToSeller, 0.01, "0.01€ → net = 0.01 (commission rounds to 0)");
// 3.50€ product: net = 2.98€ (after commission), minus 3.50€ courier = -0.52€
// This is expected — very cheap products can go negative with courier.
// In practice, minimum product price prevents this.
assert(netForPriceWithDelivery(3.50, true) < 0, "3.50€ with courier → negative net (expected for very cheap products)");

// ── Summary ──
console.log(`\n${"═".repeat(50)}`);
console.log(`  ${passed} passed, ${failed} failed`);
console.log(`${"═".repeat(50)}`);

if (failed > 0) {
  process.exit(1);
}
