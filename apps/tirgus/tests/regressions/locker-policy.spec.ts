import { test, expect } from "@playwright/test";
import { lockers } from "../../lib/mock-data";
import { openLockers, publicLockers, getOpenLocker, deliveryLockersForSellers } from "../../lib/locker-policy";
import { LOCKER_ZONES, lookupPostalCode, nearestLockersForCode, ZONE_PRICING } from "../../lib/postal-zones";
import { BUYER_LOCKER_FEE_CENTS, BUYER_COURIER_FEE_CENTS } from "../../lib/delivery-policy";
import { hasConsent, readConsent, CONSENT_VERSION } from "../../lib/cookie-consent";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("Tukums remains resolvable historically but is never an active choice", () => {
  expect(lockers.find((locker) => locker.id === "tukums")?.city).toBe("Tukums");
  expect(getOpenLocker("tukums")).toBeUndefined();
  expect(getOpenLocker("saga")).toBeUndefined();
  expect(getOpenLocker("unknown")).toBeUndefined();
  expect(getOpenLocker(null)).toBeUndefined();
  expect(getOpenLocker("brivibas")?.id).toBe("brivibas");
  expect(publicLockers.some((locker) => locker.id === "tukums")).toBe(false);
  expect(openLockers.some((locker) => locker.id === "tukums")).toBe(false);
});

test("nearby suggestions exclude closed and pickup-only locations; city courier coverage is retained", () => {
  expect(LOCKER_ZONES.tukums).toBeUndefined();
  expect(nearestLockersForCode(3101, 3, 50).map((locker) => locker.id)).not.toContain("tukums");
  expect(nearestLockersForCode(3101, 3, 50).map((locker) => locker.id)).not.toContain("dundaga");
  // Closing a locker must not erase the existing postcode coverage table.
  expect(lookupPostalCode("LV-2105").found).toBe(true);
});

test("pickup-only destinations require all sellers, not just any one seller", () => {
  expect(deliveryLockersForSellers([["dundaga"], ["brivibas"]]).some((l) => l.id === "dundaga")).toBe(false);
  expect(deliveryLockersForSellers([["dundaga"], ["dundaga"]]).some((l) => l.id === "dundaga")).toBe(true);
  expect(deliveryLockersForSellers([]).some((l) => l.id === "dundaga")).toBe(false);
});

test("buyer delivery tariff is free locker / 3.50 courier per seller irrespective of temperature zones", () => {
  expect(BUYER_LOCKER_FEE_CENTS).toBe(0);
  expect(BUYER_COURIER_FEE_CENTS).toBe(350);
  for (const pricing of Object.values(ZONE_PRICING)) {
    expect(pricing.singleTemp).toBe(3.5);
    expect(pricing.dualTemp).toBe(3.5);
    if (pricing.expressSingle !== null) expect(pricing.expressSingle).toBe(3.5);
    if (pricing.expressDual !== null) expect(pricing.expressDual).toBe(3.5);
  }
});

test("analytics defaults off in server rendering and unconditional Google tracking is removed", () => {
  expect(readConsent()).toBeNull();
  expect(hasConsent("analytics")).toBe(false);
  expect(CONSENT_VERSION).toBeGreaterThan(1);
  const layout = readFileSync(resolve(__dirname, "../../app/layout.tsx"), "utf8");
  expect(layout).not.toContain("googletagmanager.com");
  expect(layout).toContain("<ConsentedAnalytics />");
});
