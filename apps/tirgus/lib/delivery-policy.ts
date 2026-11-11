import { deliveryLockersForSellers, getOpenLocker } from "./locker-policy";
import { COLD_CHAIN_NET_CENTS, deliveryGrossCents, lookupPostalCode } from "./postal-zones";
import type {
  DeliveryQuote, DeliveryQuoteError, DeliveryQuoteInput, DeliveryQuoteItem, DeliveryFeeSnapshot,
} from "./checkout-contract";

export type {
  DeliveryMethod, DeliveryStorageType, DeliveryQuoteItem, DeliveryQuoteInput,
  DeliveryFeeSnapshot, DeliveryQuoteError, DeliveryQuote,
} from "./checkout-contract";
export { deliveryGrossCents } from "./postal-zones";

/** Negotiated buyer gross price, once per seller/destination, including dual temperature. */
export const BUYER_LOCKER_FEE_CENTS = 300;
export const DELIVERY_TARIFF_VERSION = "izipizi-cold-chain-2026-11-11";
export const ZONE_POLICY = "published-destination-postcode-v1" as const;
const MAX_SELLERS = 100;
const MAX_ENTRIES = 1000;
const MAX_ITEMS = 10000;

/** Preserve existing food-storage convention; ambient never gets nonthermal tariffs. */
export function deliveryStorageType(item: DeliveryQuoteItem): "chilled" | "frozen" {
  if (item.storageType === "frozen") return "frozen";
  if (item.storageType === "chilled" || item.storageType === "ambient") return "chilled";
  return item.category === "Saldēta pārtika" ? "frozen" : "chilled";
}

function validItem(item: DeliveryQuoteItem): boolean {
  return !!item && typeof item === "object" &&
    typeof item.category === "string" && item.category.length <= 256 &&
    (item.storageType == null || ["frozen", "chilled", "ambient"].includes(item.storageType)) &&
    (item.courierDelivery == null || typeof item.courierDelivery === "boolean") &&
    (item.expressDelivery == null || typeof item.expressDelivery === "boolean");
}

/**
 * Pure destination-tariff calculation, not carrier route certification.
 * Server callers resolve persisted listing/seller metadata first. Home lockers
 * affect eligibility only; no origin zone, MAX markup or guessed geography.
 */
export function calculateDeliveryQuote(input: DeliveryQuoteInput): DeliveryQuote {
  const fail = (error: DeliveryQuoteError, sellerId?: string): DeliveryQuote =>
    ({ ok: false, error, ...(sellerId ? { sellerId } : {}), totalCents: null, breakdown: [] });
  if (!input || !["locker", "courier", "express"].includes(input.method)) return fail("invalid_method");
  if (!Array.isArray(input.sellers) || !input.sellers.length) return fail("invalid_seller");
  if (input.sellers.length > MAX_ENTRIES) return fail("invalid_amount");

  const grouped = new Map<string, { homes: Set<string>; items: DeliveryQuoteItem[] }>();
  let itemCount = 0;
  for (const seller of input.sellers) {
    if (!seller || typeof seller.sellerId !== "string" || !seller.sellerId.trim() ||
        seller.sellerId.length > 128 || seller.sellerId !== seller.sellerId.trim() ||
        !Array.isArray(seller.items) || !seller.items.length ||
        !Array.isArray(seller.homeLockerIds) || seller.homeLockerIds.length > 100 ||
        seller.homeLockerIds.some((id: unknown) => typeof id !== "string" || id.length > 128) ||
        Array.from<DeliveryQuoteItem>(seller.items).some(item => !validItem(item))) return fail("invalid_seller");
    itemCount += seller.items.length;
    if (itemCount > MAX_ITEMS) return fail("invalid_amount");
    const homes = new Set<string>(seller.homeLockerIds.filter((id: string) => !!getOpenLocker(id)));
    const previous = grouped.get(seller.sellerId);
    if (previous) {
      // Duplicate input cannot broaden local-only permissions by unioning conflicting metadata.
      previous.homes = new Set([...previous.homes].filter(id => homes.has(id)));
      previous.items.push(...seller.items);
    } else {
      grouped.set(seller.sellerId, { homes, items: [...seller.items] });
    }
    if (grouped.size > MAX_SELLERS) return fail("invalid_amount");
  }

  const groups = [...grouped.values()];
  const destination = input.method === "locker" ? getOpenLocker(input.lockerId) : undefined;
  if (input.method === "locker" && (!destination ||
      !deliveryLockersForSellers(groups.map(seller => [...seller.homes])).some(locker => locker.id === destination.id))) {
    return fail("invalid_locker");
  }
  const buyer = lookupPostalCode(input.buyerPostalCode ?? "");
  if (input.method !== "locker" && !buyer.found) return fail("unknown_buyer_zone");
  const buyerZone = input.method !== "locker" && buyer.found ? buyer.zone : null;
  const breakdown: DeliveryFeeSnapshot[] = [];
  let total = 0;
  for (const [sellerId, seller] of grouped) {
    if (input.method === "courier" && !seller.items.every(item => item.courierDelivery === true)) {
      return fail("courier_unsupported", sellerId);
    }
    if (input.method === "express" && !seller.items.every(item => item.expressDelivery === true)) {
      return fail("express_unsupported", sellerId);
    }
    const temperature = new Set(seller.items.map(deliveryStorageType)).size > 1 ? "dual" : "single";
    let netCents: number | null = null;
    let totalCents = BUYER_LOCKER_FEE_CENTS;
    if (input.method !== "locker") {
      if (buyerZone === null) return fail("unknown_buyer_zone");
      const tariff = COLD_CHAIN_NET_CENTS[buyerZone];
      const rate = input.method === "express" ? tariff.express : tariff.courier;
      if (!rate) return fail("express_unsupported", sellerId);
      netCents = rate[temperature];
      try { totalCents = deliveryGrossCents(netCents); }
      catch { return fail("invalid_amount", sellerId); }
    }
    if (!Number.isSafeInteger(totalCents) || totalCents <= 0 || !Number.isSafeInteger(total + totalCents)) {
      return fail("invalid_amount", sellerId);
    }
    total += totalCents;
    breakdown.push({
      sellerId, method: input.method, lockerId: destination?.id ?? null,
      buyerPostalCode: buyerZone !== null && buyer.found ? `LV-${buyer.code}` : null,
      buyerZone, temperature, netCents,
      vatCents: netCents === null ? null : totalCents - netCents,
      totalCents, tariffVersion: DELIVERY_TARIFF_VERSION, zonePolicy: ZONE_POLICY,
    });
  }
  return { ok: true, totalCents: total, breakdown };
}
