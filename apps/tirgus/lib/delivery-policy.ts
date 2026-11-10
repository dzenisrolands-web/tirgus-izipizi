import { deliveryLockersForSellers, getOpenLocker } from "./locker-policy";
import { lookupPostalCode, LOCKER_ZONES, COLD_CHAIN_NET_CENTS, type DeliveryZone } from "./postal-zones";

/** Owner-confirmed gross tariff, once per seller/destination, including dual-temperature orders. */
export const BUYER_LOCKER_FEE_CENTS = 300;
/** @deprecated Minimum only; checkout must use calculateDeliveryQuote, never a flat courier fee. */
export const BUYER_COURIER_FEE_CENTS = 774;
export const DELIVERY_TARIFF_VERSION = "izipizi-cold-chain-2026-11-10";
export type DeliveryMethod = "locker" | "courier" | "express";
export type DeliveryQuoteItem = {
  storageType?: string | null;
  category: string;
  expressDelivery?: boolean | null;
  courierDelivery?: boolean | null;
};
export type DeliveryQuoteInput = {
  method: DeliveryMethod;
  buyerPostalCode?: string | null;
  lockerId?: string | null;
  sellers: readonly {
    sellerId: string;
    homeLockerIds: readonly string[];
    items: readonly DeliveryQuoteItem[];
  }[];
};
export type DeliveryFeeSnapshot = {
  sellerId: string;
  method: DeliveryMethod;
  lockerId: string | null;
  buyerPostalCode: string | null;
  buyerZone: DeliveryZone | null;
  senderZone: DeliveryZone | null;
  effectiveZone: DeliveryZone | null;
  temperature: "single" | "dual";
  netCents: number | null;
  vatCents: number | null;
  totalCents: number;
  tariffVersion: string;
};
export type DeliveryQuote =
  | { ok: true; totalCents: number; breakdown: DeliveryFeeSnapshot[] }
  | {
    ok: false; totalCents: null; breakdown: [];
    error: "invalid_seller" | "invalid_locker" | "unknown_buyer_zone" | "express_unsupported" | "courier_unsupported";
    sellerId?: string;
  };

/** Match the existing food-storage convention, including legacy category-only listings. */
export function deliveryStorageType(item: DeliveryQuoteItem): "chilled" | "frozen" {
  if (item.storageType === "frozen") return "frozen";
  if (item.storageType === "chilled" || item.storageType === "ambient") return "chilled";
  return item.category === "Saldēta pārtika" ? "frozen" : "chilled";
}

/** Integer-cent VAT conversion; round each seller shipment, then sum gross cents. */
export function deliveryGrossCents(netCents: number): number {
  return Math.round(netCents * 121 / 100);
}

/**
 * One destination per quote. Server callers MUST supply persisted seller/listing
 * metadata, not buyer-submitted prices, storage, express flags or home lockers.
 * Duplicate seller entries merge into one shipment. Unknown sender zones remain
 * null; only a verified buyer postcode can establish courier availability.
 */
export function calculateDeliveryQuote(input: DeliveryQuoteInput): DeliveryQuote {
  const fail = (error: Extract<DeliveryQuote, { ok: false }>["error"], sellerId?: string): DeliveryQuote =>
    ({ ok: false, error, sellerId, totalCents: null, breakdown: [] });
  if (!input.sellers.length) return fail("invalid_seller");
  const grouped = new Map<string, { homeLockerIds: string[]; items: DeliveryQuoteItem[] }>();
  for (const seller of input.sellers) {
    if (!seller.sellerId.trim() || !seller.items.length) return fail("invalid_seller", seller.sellerId);
    const group = grouped.get(seller.sellerId) ?? { homeLockerIds: [], items: [] };
    group.items.push(...seller.items);
    group.homeLockerIds.push(...seller.homeLockerIds);
    grouped.set(seller.sellerId, group);
  }
  const destination = input.method === "locker" ? getOpenLocker(input.lockerId) : undefined;
  if (input.method === "locker" && (!destination ||
    !deliveryLockersForSellers([...grouped.values()].map(s => s.homeLockerIds)).some(l => l.id === destination.id))) {
    return fail("invalid_locker");
  }
  const buyer = lookupPostalCode(input.buyerPostalCode ?? "");
  if (input.method !== "locker" && !buyer.found) return fail("unknown_buyer_zone");
  const breakdown: DeliveryFeeSnapshot[] = [];
  for (const [sellerId, seller] of grouped) {
    if (input.method === "courier" && seller.items.some(item => item.courierDelivery === false)) {
      return fail("courier_unsupported", sellerId);
    }
    const zones = seller.homeLockerIds
      .filter(id => !!getOpenLocker(id))
      .map(id => LOCKER_ZONES[id])
      .filter((zone): zone is DeliveryZone => zone !== undefined);
    const senderZone = zones.length ? Math.max(...zones) as DeliveryZone : null;
    const buyerZone = input.method !== "locker" && buyer.found ? buyer.zone : null;
    const effectiveZone = buyerZone === null ? null : Math.max(senderZone ?? buyerZone, buyerZone) as DeliveryZone;
    const temperature = new Set(seller.items.map(deliveryStorageType)).size > 1 ? "dual" : "single";
    let netCents: number | null = null;
    let totalCents = BUYER_LOCKER_FEE_CENTS;
    if (input.method !== "locker" && effectiveZone !== null) {
      const tariff = COLD_CHAIN_NET_CENTS[effectiveZone];
      const rates = input.method === "express" ? tariff.express : tariff.courier;
      if (!rates || (input.method === "express" && !seller.items.every(i => i.expressDelivery === true))) {
        return fail("express_unsupported", sellerId);
      }
      netCents = rates[temperature];
      totalCents = deliveryGrossCents(netCents);
    }
    breakdown.push({
      sellerId, method: input.method, lockerId: destination?.id ?? null,
      buyerPostalCode: buyerZone !== null && buyer.found ? `LV-${buyer.code}` : null,
      buyerZone, senderZone, effectiveZone, temperature, netCents,
      vatCents: netCents === null ? null : totalCents - netCents,
      totalCents, tariffVersion: DELIVERY_TARIFF_VERSION,
    });
  }
  return { ok: true, totalCents: breakdown.reduce((sum, fee) => sum + fee.totalCents, 0), breakdown };
}
