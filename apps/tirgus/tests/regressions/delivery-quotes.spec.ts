import { test, expect } from "@playwright/test";
import {
  calculateDeliveryQuote, deliveryGrossCents, deliveryStorageType,
  DELIVERY_TARIFF_VERSION, type DeliveryQuoteInput,
} from "../../lib/delivery-policy";
import { lookupPostalCode, postalCodesByZone, nearestLockersForCode, effectiveCourierZone } from "../../lib/postal-zones";
import { deliveryListingForCartItem } from "../../lib/delivery-cart-metadata";

const chilled = { storageType: "chilled", category: "Piens", expressDelivery: true };
const frozen = { category: "Saldēta pārtika", expressDelivery: true };

test("cart delivery metadata supports exact catalog and real variants, not forged suffixes", () => {
  const catalog = [{ id: "listing", sellerId: "actual-seller", variants: [{ id: "large" }], ...frozen }];
  expect(deliveryListingForCartItem("listing", catalog)).toBe(catalog[0]);
  expect(deliveryListingForCartItem("listing-large", catalog)).toBe(catalog[0]);
  expect(deliveryListingForCartItem("listing-forged", catalog)).toBeUndefined();
  expect(deliveryListingForCartItem("unknown", catalog)).toBeUndefined();
});
function input(overrides: Partial<DeliveryQuoteInput> = {}): DeliveryQuoteInput {
  return {
    method: "courier", buyerPostalCode: "LV-1010",
    sellers: [{ sellerId: "seller-a", homeLockerIds: ["brivibas"], items: [chilled] }],
    ...overrides,
  };
}

for (const [zone, code, single, dual, expressSingle, expressDual] of [
  [0, "1010", 774, 883, 908, 1029],
  [1, "1005", 774, 883, 1089, 1210],
  [2, "1016", 1016, 1125, 1513, 1634],
  [3, "2008", 1198, 1319, null, null],
] as const) {
  for (const temperature of ["single", "dual"] as const) {
    test(`zone ${zone} ${temperature}: exact cold-chain courier and express gross cents`, () => {
      const data = input({
        buyerPostalCode: code,
        sellers: [{ sellerId: "a", homeLockerIds: ["brivibas"],
          items: temperature === "dual" ? [chilled, frozen] : [frozen] }],
      });
      const courier = calculateDeliveryQuote(data);
      expect(courier.ok).toBe(true);
      if (!courier.ok) throw new Error(courier.error);
      expect(courier.totalCents).toBe(temperature === "dual" ? dual : single);
      const snapshot = courier.breakdown[0];
      expect(snapshot).toMatchObject({
        sellerId: "a", buyerZone: zone, effectiveZone: zone, senderZone: 0,
        temperature, method: "courier", tariffVersion: DELIVERY_TARIFF_VERSION,
        buyerPostalCode: `LV-${code}`, lockerId: null,
      });
      expect(snapshot.netCents! + snapshot.vatCents!).toBe(snapshot.totalCents);
      const express = calculateDeliveryQuote({ ...data, method: "express" });
      const expected = temperature === "dual" ? expressDual : expressSingle;
      if (expected === null) {
        expect(express).toMatchObject({ ok: false, error: "express_unsupported", totalCents: null, breakdown: [] });
      } else {
        expect(express).toMatchObject({ ok: true, totalCents: expected });
      }
    });
  }
}

test("locker is 300 once per seller/address, never multiplied by products or temperatures", () => {
  const quote = calculateDeliveryQuote(input({
    method: "locker", lockerId: "brivibas",
    sellers: [
      { sellerId: "a", homeLockerIds: ["brivibas"], items: [chilled, frozen, chilled] },
      { sellerId: "a", homeLockerIds: ["brivibas"], items: [frozen] },
      { sellerId: "b", homeLockerIds: ["salaspils"], items: [chilled] },
    ],
  }));
  expect(quote.ok).toBe(true);
  if (!quote.ok) throw new Error(quote.error);
  expect(quote.totalCents).toBe(600);
  expect(quote.breakdown).toHaveLength(2);
  expect(quote.breakdown[0]).toMatchObject({ temperature: "dual", totalCents: 300, netCents: null, vatCents: null });
});

test("multiple sellers round VAT per shipment before summing; repeated product count adds no fees", () => {
  const quote = calculateDeliveryQuote(input({
    method: "express",
    sellers: [
      { sellerId: "a", homeLockerIds: ["brivibas"], items: [chilled, chilled] },
      { sellerId: "b", homeLockerIds: ["brivibas"], items: [chilled] },
    ],
  }));
  expect(deliveryGrossCents(750)).toBe(908);
  expect(deliveryGrossCents(1250)).toBe(1513);
  expect(quote).toMatchObject({ ok: true, totalCents: 1816 });
});

test("sender MAX applies to all actual known home lockers; unsupported sender express fails whole quote", () => {
  const data = input({ sellers: [
    { sellerId: "a", homeLockerIds: ["brivibas", "ikskile"], items: [chilled] },
    { sellerId: "b", homeLockerIds: ["brivibas"], items: [chilled] },
  ] });
  expect(calculateDeliveryQuote(data)).toMatchObject({
    ok: true, totalCents: 1972,
    breakdown: [{ senderZone: 3, effectiveZone: 3 }, { senderZone: 0, effectiveZone: 0 }],
  });
  expect(calculateDeliveryQuote({ ...data, method: "express" })).toMatchObject({
    ok: false, error: "express_unsupported", sellerId: "a", totalCents: null, breakdown: [],
  });
});

test("unknown sender remains null, verified buyer zone still prices; unknown buyer never becomes free", () => {
  for (const ids of [[], ["unknown"], ["tukums"]]) {
    const data = input({ sellers: [{ sellerId: "a", homeLockerIds: ids, items: [chilled] }] });
    expect(calculateDeliveryQuote(data)).toMatchObject({
      ok: true, totalCents: 774, breakdown: [{ senderZone: null, buyerZone: 0, effectiveZone: 0 }],
    });
  }
  for (const code of ["", "9999", "3001", "LV-2136", "LV-2140", "LV-2141", "LV-2150", "abc1010"]) {
    expect(calculateDeliveryQuote(input({ buyerPostalCode: code }))).toMatchObject({
      ok: false, totalCents: null, error: "unknown_buyer_zone", breakdown: [],
    });
  }
  expect(effectiveCourierZone("brivibas", null)).toBeNull();
});

test("courier delivery fails closed when an actual product disables it", () => {
  expect(calculateDeliveryQuote(input({
    sellers: [{ sellerId: "a", homeLockerIds: ["brivibas"], items: [{ ...chilled, courierDelivery: false }] }],
  }))).toMatchObject({ ok: false, error: "courier_unsupported", totalCents: null });
});

test("express requires affirmative real item flags, including legacy carts", () => {
  for (const expressDelivery of [false, null, undefined]) {
    expect(calculateDeliveryQuote(input({
      method: "express",
      sellers: [{ sellerId: "a", homeLockerIds: [], items: [chilled, { ...frozen, expressDelivery }] }],
    }))).toMatchObject({ ok: false, error: "express_unsupported" });
  }
});

test("closed, future and pickup-only destination validation stays fail closed", () => {
  for (const lockerId of ["tukums", "saga", "unknown", "", "dundaga"]) {
    expect(calculateDeliveryQuote(input({ method: "locker", lockerId }))).toMatchObject({
      ok: false, error: "invalid_locker", totalCents: null,
    });
  }
  expect(calculateDeliveryQuote(input({
    method: "locker", lockerId: "dundaga",
    sellers: [{ sellerId: "local", homeLockerIds: ["dundaga"], items: [chilled, frozen] }],
  }))).toMatchObject({ ok: true, totalCents: 300 });
  expect(calculateDeliveryQuote(input({ sellers: [] }))).toMatchObject({ ok: false, error: "invalid_seller" });
  expect(calculateDeliveryQuote(input({
    sellers: [{ sellerId: "", homeLockerIds: [], items: [chilled] }],
  }))).toMatchObject({ ok: false, error: "invalid_seller" });
});

test("postcode sets match published source without invented city names or coordinate distances", () => {
  expect(postalCodesByZone(0)).toHaveLength(14);
  expect(postalCodesByZone(1)).toHaveLength(35);
  expect(postalCodesByZone(2)).toHaveLength(15);
  expect(postalCodesByZone(3)).toEqual([2008, 2010, 2011, 2012, 2015, 2016, 2105, 5001, 5015, 5016, 5041, 5052, 5060, 5070, 5071]);
  for (const zone of [0, 1, 2, 3] as const) {
    for (const code of postalCodesByZone(zone)) {
      expect(lookupPostalCode(`LV-${code}`)).toMatchObject({ found: true, zone, place: `LV-${code}`, nearestLockers: [] });
    }
  }
  expect(nearestLockersForCode(3101, 3)).toEqual([]);
  expect(deliveryStorageType(frozen)).toBe("frozen");
  expect(deliveryStorageType({ ...frozen, storageType: "ambient" })).toBe("chilled");
});
