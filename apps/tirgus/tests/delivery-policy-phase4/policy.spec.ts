import { test, expect } from "@playwright/test";
import {
  calculateDeliveryQuote, deliveryGrossCents, deliveryStorageType, BUYER_LOCKER_FEE_CENTS, ZONE_POLICY,
  type DeliveryQuoteInput, type DeliveryQuoteItem,
} from "../../lib/delivery-policy";
import {
  COLD_CHAIN_NET_CENTS, lookupPostalCode, postalCodesByZone, pricingForZone,
  effectiveCourierZone, placeForCode, nearestLockersForCode, type DeliveryZone,
} from "../../lib/postal-zones";
import { deliveryLockersForSellers, getOpenLocker } from "../../lib/locker-policy";
import { COURIER_FEE } from "../../lib/commission";

// No network is needed. Even accidental fetch calls cannot contact real services.
const originalFetch = globalThis.fetch;
test.beforeEach(() => {
  globalThis.fetch = async input => {
    const url = new URL(input instanceof Request ? input.url : String(input), "https://example.invalid");
    if (url.origin !== "https://example.invalid") throw new Error("Non-dummy network forbidden");
    throw new Error("Pure delivery policy must not fetch even dummy services");
  };
});
test.afterEach(() => { globalThis.fetch = originalFetch; });

const chilled: DeliveryQuoteItem = { category: "Olas", storageType: "chilled", courierDelivery: true, expressDelivery: true };
const frozen: DeliveryQuoteItem = { ...chilled, storageType: "frozen" };
const quote = (patch: Partial<DeliveryQuoteInput> = {}) => calculateDeliveryQuote({
  method: "courier", buyerPostalCode: "LV-1001",
  sellers: [{ sellerId: "seller", homeLockerIds: ["brivibas"], items: [chilled] }],
  ...patch,
});
const official = [
  [1001,1002,1003,1004,1009,1010,1011,1012,1013,1019,1045,1046,1048,1050],
  [1005,1006,1007,1014,1015,1021,1023,1024,1026,1029,1034,1035,1039,1053,1055,1057,1058,1063,1064,1067,1069,1073,1076,1079,1082,1083,1084,2101,2108,2111,2112,2119,2128,2130,2167],
  [1016,1030,2103,2107,2114,2117,2118,2121,2123,2127,2137,2163,2164,2166,2169],
  [2008,2010,2011,2012,2015,2016,2105,5001,5015,5016,5041,5052,5060,5070,5071],
] as const;

test("all and only the 79 published destination postcodes are billable", () => {
  const codes = official.flat();
  expect(codes).toHaveLength(79);
  for (const zone of [0,1,2,3] as const) {
    expect(postalCodesByZone(zone)).toEqual(official[zone]);
    for (const code of official[zone]) {
      expect(lookupPostalCode(`LV-${code}`)).toMatchObject({ found: true, zone });
      const result = quote({ buyerPostalCode: String(code) });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.breakdown[0].buyerZone).toBe(zone);
    }
  }
  for (let code = 1000; code <= 9999; code++) {
    expect(lookupPostalCode(String(code)).found).toBe((codes as readonly number[]).includes(code));
  }
});

for (const [zone, expectedSingle, expectedDual, expressSingle, expressDual] of [
  [0,774,883,908,1029], [1,774,883,1089,1210], [2,1016,1125,1513,1634], [3,1198,1319,null,null],
] as const) {
  test(`zone${zone} full single/dual NET+21% matrix is consistent`, () => {
    const code = String(official[zone][0]);
    for (const [items, temperature, gross, expressGross] of [
      [[chilled], "single", expectedSingle, expressSingle],
      [[chilled, frozen], "dual", expectedDual, expressDual],
    ] as const) {
      const sellers = [{ sellerId: "seller", homeLockerIds: ["sigulda"], items }];
      const result = quote({ buyerPostalCode: code, sellers });
      expect(result).toMatchObject({
        ok: true, totalCents: gross,
        breakdown: [{ buyerZone: zone, temperature, netCents: COLD_CHAIN_NET_CENTS[zone].courier[temperature], zonePolicy: ZONE_POLICY }],
      });
      const express = quote({ method: "express", buyerPostalCode: code, sellers });
      expect(express).toMatchObject(expressGross === null
        ? { ok: false, error: "express_unsupported", totalCents: null, breakdown: [] }
        : { ok: true, totalCents: expressGross });
      expect(pricingForZone(zone)?.[temperature === "single" ? "singleTemp" : "dualTemp"]).toBe(gross / 100);
    }
  });
}

test("all nine current seller-origin fixtures and multi-home order never change destination tariff", () => {
  const homes = [["agenskalna"],["brivibas"],["ikskile","salaspils"],["ikskile"],["salaspils"],["sigulda"],["brivibas"],["agenskalna"],["ikskile"]];
  const result = quote({ sellers: homes.map((homeLockerIds, i) => ({ sellerId: `seller-${i}`, homeLockerIds, items: [chilled] })) });
  expect(result).toMatchObject({ ok: true, totalCents: 9 * 774 });
  for (const homeLockerIds of [homes[2], [...homes[2]].reverse()]) {
    expect(quote({ sellers: [{ sellerId: "seller", homeLockerIds, items: [chilled] }] })).toMatchObject({ ok: true, totalCents: 774 });
  }
  expect(effectiveCourierZone("sigulda", 0)).toBe(0);
  expect(effectiveCourierZone("brivibas", null)).toBeNull();
  expect(placeForCode(2105, 3)).toBe("LV-2105");
  expect(nearestLockersForCode(2105, 3)).toEqual([]);
});

test("strict postcode parsing rejects unknown/extra/ambiguous inputs, never free delivery", () => {
  for (const value of ["LV-2136","2140","2141","2150","9999","LV-3101","","10010","x1001","1001x","LV--1001","1 0 0 1","address LV-1001","1e03"]) {
    expect(quote({ buyerPostalCode: value })).toMatchObject({ ok: false, error: "unknown_buyer_zone", totalCents: null, breakdown: [] });
  }
  for (const value of ["1001","LV1001","LV-1001"," lv-1001 "]) {
    expect(quote({ buyerPostalCode: value })).toMatchObject({ ok: true, totalCents: 774 });
  }
  expect(quote({ buyerPostalCode: "LV-2105" })).toMatchObject({ ok: true, totalCents: 1198 });
});

test("duplicate seller products merge once, dual locker is300 not600, sellers add separately", () => {
  const sellers = [
    { sellerId: "a", homeLockerIds: ["brivibas"], items: [chilled] },
    { sellerId: "a", homeLockerIds: ["brivibas"], items: [frozen, chilled] },
    { sellerId: "b", homeLockerIds: ["agenskalna"], items: [chilled] },
  ];
  expect(quote({ method: "locker", lockerId: "ikskile", sellers })).toMatchObject({
    ok: true, totalCents: 600, breakdown: [
      { sellerId: "a", temperature: "dual", totalCents: 300, netCents: null, vatCents: null },
      { sellerId: "b", temperature: "single", totalCents: 300 },
    ],
  });
  expect(quote({ sellers })).toMatchObject({ ok: true, totalCents: 883 + 774 });
  expect(BUYER_LOCKER_FEE_CENTS).toBe(300);
  expect(COURIER_FEE).toBe(3.50); // Separate seller pickup remains untouched.
});

test("every item and every shipment must explicitly permit the chosen courier/express service", () => {
  for (const method of ["courier","express"] as const) {
    for (const value of [false, null, undefined]) {
      const denied = { ...chilled, [method === "courier" ? "courierDelivery" : "expressDelivery"]: value };
      for (const sellers of [
        [{ sellerId: "seller", homeLockerIds: ["brivibas"], items: [chilled, denied] }],
        [{ sellerId: "yes", homeLockerIds: ["brivibas"], items: [chilled] }, { sellerId: "no", homeLockerIds: ["agenskalna"], items: [denied] }],
      ]) expect(quote({ method, sellers })).toMatchObject({
        ok: false, error: `${method}_unsupported`, totalCents: null, breakdown: [],
      });
    }
  }
});

test("pickup-only destination requires every seller local, never any-one or duplicate metadata union", () => {
  expect(deliveryLockersForSellers([["dundaga"],["brivibas"]]).map(locker => locker.id)).not.toContain("dundaga");
  expect(deliveryLockersForSellers([["dundaga"],["dundaga","brivibas"]]).map(locker => locker.id)).toContain("dundaga");
  const local = [{ sellerId: "a", homeLockerIds: ["dundaga"], items: [chilled] }];
  expect(quote({ method: "locker", lockerId: "dundaga", sellers: local })).toMatchObject({ ok: true, totalCents: 300 });
  expect(quote({ method: "locker", lockerId: "dundaga", sellers: [...local, { sellerId: "b", homeLockerIds: ["brivibas"], items: [chilled] }] })).toMatchObject({ ok: false, error: "invalid_locker" });
  expect(quote({ method: "locker", lockerId: "dundaga", sellers: [...local, { sellerId: "a", homeLockerIds: ["brivibas"], items: [chilled] }] })).toMatchObject({ ok: false, error: "invalid_locker" });
});

test("closed/future/unknown destinations are rejected and optional home entries never affect prices", () => {
  for (const id of ["tukums","saga","unknown"]) {
    expect(getOpenLocker(id)).toBeUndefined();
    expect(quote({ method: "locker", lockerId: id })).toMatchObject({ ok: false, error: "invalid_locker" });
    expect(quote({ sellers: [{ sellerId: "seller", homeLockerIds: [id], items: [chilled] }] })).toMatchObject({ ok: true, totalCents: 774 });
  }
  expect(deliveryLockersForSellers([])).toEqual([]);
  expect(deliveryLockersForSellers([["dundaga"]]).map(locker => locker.id)).not.toContain("tukums");
});

test("storage convention stays conservative and no ambient/nonthermal shortcut appears", () => {
  expect(deliveryStorageType({ category: "Saldēta pārtika" })).toBe("frozen");
  expect(deliveryStorageType({ category: "Saldēta pārtika", storageType: "ambient" })).toBe("chilled");
  expect(deliveryStorageType(chilled)).toBe("chilled");
  expect(quote({ sellers: [{ sellerId: "seller", homeLockerIds: ["brivibas"], items: [{ ...chilled, storageType: "ambient" }] }] })).toMatchObject({ ok: true, totalCents: 774 });
});

test("malformed runtime input, counts and cents fail safely without zero-success", () => {
  for (const input of [null, {}, { method: "bad" }]) {
    expect(calculateDeliveryQuote(input as unknown as DeliveryQuoteInput)).toMatchObject({ ok: false, error: "invalid_method", totalCents: null });
  }
  for (const sellers of [null, [], [{}], [{ sellerId: "seller", homeLockerIds: [], items: [] }]]) {
    expect(quote({ sellers: sellers as unknown as DeliveryQuoteInput["sellers"] })).toMatchObject({ ok: false, error: "invalid_seller", totalCents: null });
  }
  expect(quote({ sellers: Array.from({ length: 101 }, (_, i) => ({ sellerId: `s${i}`, homeLockerIds: ["brivibas"], items: [chilled] })) })).toMatchObject({ ok: false, error: "invalid_amount" });
  for (const value of [-1,0.5,NaN,Infinity,Number.MAX_SAFE_INTEGER]) expect(() => deliveryGrossCents(value)).toThrow(RangeError);
  expect(deliveryGrossCents(640)).toBe(774);
  expect(deliveryGrossCents(990)).toBe(1198);
  expect(pricingForZone(99 as DeliveryZone)).toBeNull();
});

test("manufacturers with courier pickup and no home lockers retain regular delivery eligibility", () => {
  const sellers = [{ sellerId: "seller", homeLockerIds: [], items: [chilled] }];
  expect(quote({ sellers })).toMatchObject({ ok: true, totalCents: 774 });
  expect(quote({ method: "express", sellers })).toMatchObject({ ok: true, totalCents: 908 });
  expect(quote({ method: "locker", lockerId: "brivibas", sellers })).toMatchObject({ ok: true, totalCents: 300 });
  expect(quote({ method: "locker", lockerId: "dundaga", sellers })).toMatchObject({ ok: false, error: "invalid_locker" });
});
