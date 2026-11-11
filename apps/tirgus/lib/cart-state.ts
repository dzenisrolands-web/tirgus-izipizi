import type { CanonicalCartItem, CheckoutItemReference } from "./checkout-contract";
import { canonicalCartId } from "./cart-identity";

export type CartItem = {
  id: string;
  listingId?: string;
  variantId?: string | null;
  title: string;
  price: number;
  unit: string;
  image: string;
  sellerName: string;
  sellerId?: string;
  quantity: number;
  storageType: "frozen" | "chilled";
  courier_delivery?: boolean;
  express_delivery?: boolean;
};

export const MAX_CART_QUANTITY = 999;
export function validQuantity(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0 && Number(value) <= MAX_CART_QUANTITY;
}

export function parseCart(raw: string | null): CartItem[] {
  if (raw === null) return [];
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value) || value.length > 500) throw new Error("Nederīgs saglabātais grozs");
  for (const item of value) {
    if (!item || typeof item !== "object" ||
      !["id", "title", "unit", "image", "sellerName"].every(key => typeof item[key] === "string") ||
      !item.id || !validQuantity(item.quantity) || typeof item.price !== "number" ||
      !Number.isFinite(item.price) || item.price < 0 ||
      !Number.isSafeInteger(Math.round(item.price * 100) * item.quantity) ||
      (item.storageType !== "frozen" && item.storageType !== "chilled") ||
      (item.sellerId !== undefined && typeof item.sellerId !== "string") ||
      (item.express_delivery !== undefined && typeof item.express_delivery !== "boolean") ||
      (item.courier_delivery !== undefined && typeof item.courier_delivery !== "boolean") ||
      (item.listingId !== undefined && (typeof item.listingId !== "string" || !item.listingId)) ||
      (item.variantId !== undefined && item.variantId !== null && typeof item.variantId !== "string")) {
      throw new Error("Saglabātajā grozā ir nederīgi dati");
    }
  }
  if (new Set(value.map(item => item.id)).size !== value.length) throw new Error("Grozā ir atkārtotas atsauces");
  if (!Number.isSafeInteger(value.reduce((sum, item) => sum + Math.round(item.price * 100) * item.quantity, 0))) {
    throw new Error("Nederīga groza summa");
  }
  return value;
}

export function cartReferences(items: readonly CartItem[]): CheckoutItemReference[] {
  return items.map(({ id, listingId, variantId, quantity }) => ({
    id, quantity, ...(listingId ? { listingId, ...(variantId !== undefined ? { variantId } : {}) } : {}),
  }));
}

/** Only hydrate a complete, provably corresponding response; never drop unresolved lines. */
export function quoteMatchesReferences(items: readonly CheckoutItemReference[], canonical: CanonicalCartItem[]): boolean {
  const quantities = new Map<string, number>();
  for (const item of items) {
    const matches = canonical.filter(next => {
      const legacyMatch = next.id === item.id || next.variantId === item.id ||
        next.listingId === item.id || next.slug === item.id ||
        (next.slug && next.variantId !== null && canonicalCartId(next.slug, next.variantId) === item.id);
      return item.listingId
        ? next.listingId === item.listingId && (item.variantId === undefined ? legacyMatch : next.variantId === item.variantId)
        : legacyMatch;
    });
    if (matches.length !== 1) return false;
    const key = matches[0].id;
    quantities.set(key, (quantities.get(key) ?? 0) + item.quantity);
  }
  if (quantities.size !== canonical.length || canonical.some(item =>
    quantities.get(item.id) !== item.quantity || !validQuantity(item.quantity))) return false;
  return true;
}

export function hydrateCart(items: CartItem[], canonical: CanonicalCartItem[]): CartItem[] {
  if (!quoteMatchesReferences(items, canonical)) return items;
  try { return parseCart(JSON.stringify(canonical)); } catch { return items; }
}
