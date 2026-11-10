import { test, expect } from "@playwright/test";
import { needsListingReview } from "../../lib/listing-review";

test("new active products enter admin review without waiting for publication approval", () => {
  expect(needsListingReview({ status: "active" })).toBe(true);
  expect(needsListingReview({ status: "active", commission_approved_at: "2026-11-10" })).toBe(false);
  expect(needsListingReview({ status: "pending_review" })).toBe(true);
  expect(needsListingReview({ status: "paused" })).toBe(false);
});
