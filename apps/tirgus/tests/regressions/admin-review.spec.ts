import { test, expect } from "@playwright/test";
import { needsListingReview } from "../../lib/listing-review";
import { commissionBreakdown, sellerNetWithVat, COURIER_FEE } from "../../lib/commission";

test("new active products enter admin review without waiting for publication approval", () => {
  expect(needsListingReview({ status: "active" })).toBe(true);
  expect(needsListingReview({ status: "active", commission_approved_at: "2026-11-10" })).toBe(false);
  expect(needsListingReview({ status: "pending_review" })).toBe(true);
  expect(needsListingReview({ status: "paused" })).toBe(false);
});

test("seller net uses actual product VAT and optional pickup fee, not an implicit 21% rate", () => {
  for (const vatRate of [0, 5, 12, 21]) {
    const expected = commissionBreakdown(10, vatRate);
    expect(sellerNetWithVat(10, vatRate).commission).toBe(expected.commissionTotal);
    expect(sellerNetWithVat(10, vatRate).net).toBe(expected.netToSeller);
    expect(sellerNetWithVat(10, vatRate, true).net).toBe(
      Math.round((expected.netToSeller - COURIER_FEE) * 100) / 100
    );
  }
});
