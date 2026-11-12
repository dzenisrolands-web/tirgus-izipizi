import type { SupabaseClient } from "@supabase/supabase-js";
import type { CanonicalCartItem, CheckoutIssue, CheckoutItemReference } from "./checkout-contract";
import { canonicalCartId } from "./cart-identity";
import { publicProductImage } from "./product-image";
import { getStorageType } from "./utils";
import { COMMISSION_RATE } from "./commission";

export const MAX_CHECKOUT_ITEMS = 100;
export const MAX_CHECKOUT_QUANTITY = 999;
const PAGE_SIZE = 200;
const MAX_CATALOG_ROWS = 5000;
const LISTING_COLUMNS = "id, slug, title, price, quantity, unit, image_url, seller_id, status, variants, category, storage_type, courier_delivery, express_delivery";

export class CheckoutError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public issues?: CheckoutIssue[],
  ) { super(message); }
}

export function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export type CheckoutListing = {
  id: string; slug?: string | null; title: string; price: number; quantity: number; unit: string;
  image_url?: string | null; seller_id: string | null; status: string; variants: unknown;
  category?: string | null; storage_type?: string | null;
  courier_delivery?: boolean | null; express_delivery?: boolean | null;
};
type Variant = { id: string; title: string; price: number; quantity: number };
type Candidate = { listing: CheckoutListing; variant: Variant | null; invalid?: boolean; needsVariant?: boolean };

export function priceCents(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new CheckoutError(409, "INVALID_PRICE", "Preces cena nav pieejama.");
  }
  const cents = Math.round(value * 100);
  if (!Number.isSafeInteger(cents) || cents <= 0 || Math.abs(value * 100 - cents) > 0.000001) {
    throw new CheckoutError(409, "INVALID_PRICE", "Preces cena nav pieejama.");
  }
  return cents;
}

export function safeAdd(a: number, b: number): number {
  const total = a + b;
  if (!Number.isSafeInteger(total) || total < 0) throw new CheckoutError(400, "INVALID_AMOUNT", "Nederīga summa.");
  return total;
}

export function parseItemReferences(value: unknown): CheckoutItemReference[] {
  if (!Array.isArray(value) || !value.length || value.length > MAX_CHECKOUT_ITEMS) {
    throw new CheckoutError(400, "INVALID_CART", "Nederīgs grozs.");
  }
  return value.map(item => {
    if (!record(item) || typeof item.id !== "string" || !item.id.trim() || item.id.length > 512
      || !Number.isSafeInteger(item.quantity) || Number(item.quantity) < 1 || Number(item.quantity) > MAX_CHECKOUT_QUANTITY
      || (item.listingId !== undefined && (typeof item.listingId !== "string" || !item.listingId || item.listingId.length > 200))
      || (item.variantId !== undefined && item.variantId !== null && (typeof item.variantId !== "string" || !item.variantId || item.variantId.length > 200))
      || (item.variantId !== undefined && item.listingId === undefined)) {
      throw new CheckoutError(400, "INVALID_CART", "Nederīga prece vai daudzums.");
    }
    return {
      id: item.id, quantity: Number(item.quantity),
      ...(item.listingId !== undefined ? { listingId: item.listingId as string } : {}),
      ...(item.variantId !== undefined ? { variantId: item.variantId as string | null } : {}),
    };
  });
}

/** Exact counts prevent a server row cap from turning an ambiguous key into a unique match. */
export async function loadCheckoutListings(supabase: SupabaseClient): Promise<CheckoutListing[]> {
  const listings: CheckoutListing[] = [];
  let expected: number | null = null;
  for (let offset = 0; offset <= MAX_CATALOG_ROWS; offset += PAGE_SIZE) {
    const { data, count, error } = await supabase.from("listings")
      .select(LISTING_COLUMNS, { count: "exact" }).eq("status", "active")
      .order("id", { ascending: true }).range(offset, offset + PAGE_SIZE - 1);
    if (error || !Array.isArray(data) || !Number.isSafeInteger(count) || count! < 0 || count! > MAX_CATALOG_ROWS
      || (expected !== null && expected !== count)) {
      throw new CheckoutError(503, "CATALOG_UNAVAILABLE", "Neizdevās pārbaudīt preces.");
    }
    expected = count;
    listings.push(...data as CheckoutListing[]);
    if (listings.length === count) {
      if (new Set(listings.map(item => item.id)).size !== count) break;
      return listings;
    }
    if (listings.length > count! || data.length !== PAGE_SIZE) break;
  }
  throw new CheckoutError(503, "CATALOG_UNAVAILABLE", "Neizdevās pilnīgi pārbaudīt preces.");
}

function variantsFor(listing: CheckoutListing): { variants: Variant[]; invalid: boolean } {
  if (listing.variants === null || listing.variants === undefined) return { variants: [], invalid: false };
  if (!Array.isArray(listing.variants)) return { variants: [], invalid: true };
  const ids = new Set<string>();
  const variants: Variant[] = [];
  let invalid = false;
  for (const value of listing.variants) {
    if (!record(value) || typeof value.id !== "string" || !value.id.trim() || value.id.length > 200
      || typeof value.title !== "string" || !value.title.trim() || ids.has(value.id)) {
      invalid = true;
      continue;
    }
    ids.add(value.id);
    variants.push(value as Variant);
  }
  return { variants, invalid };
}

export function normalizeCheckoutItems(references: CheckoutItemReference[], listings: CheckoutListing[]): CanonicalCartItem[] {
  references = parseItemReferences(references);
  const aliases = new Map<string, Candidate[]>();
  const byId = new Map(listings.map(listing => [listing.id, listing]));
  const addAlias = (alias: string | undefined | null, candidate: Candidate) => {
    if (alias) aliases.set(alias, [...(aliases.get(alias) ?? []), candidate]);
  };
  for (const listing of listings) {
    if (listing.status !== "active") continue;
    const { variants, invalid } = variantsFor(listing);
    const base: Candidate = { listing, variant: variants.length === 1 ? variants[0] : null, invalid, needsVariant: variants.length > 1 };
    addAlias(listing.id, base);
    addAlias(listing.slug, base);
    for (const variant of variants) {
      const candidate = { listing, variant, invalid };
      addAlias(variant.id, candidate);
      addAlias(canonicalCartId(listing.id, variant.id), candidate);
      if (listing.slug) addAlias(canonicalCartId(listing.slug, variant.id), candidate);
    }
  }

  const issues: CheckoutIssue[] = [];
  const resolved = new Map<string, CanonicalCartItem>();
  for (const item of references) {
    let matches: Candidate[];
    if (item.listingId !== undefined) {
      const listing = byId.get(item.listingId);
      if (!listing) matches = [];
      else if (item.variantId !== undefined) {
        const { variants, invalid } = variantsFor(listing);
        const variant = item.variantId === null ? null : variants.find(value => value.id === item.variantId);
        matches = item.id !== canonicalCartId(listing.id, item.variantId)
          || (item.variantId === null && variants.length > 0) || variant === undefined
          ? [] : [{ listing, variant, invalid }];
      } else {
        matches = (aliases.get(item.id) ?? []).filter(candidate => candidate.listing.id === listing.id);
      }
    } else matches = aliases.get(item.id) ?? [];

    const unique = new Map(matches.map(candidate => [
      JSON.stringify([candidate.listing.id, candidate.variant?.id ?? null, !!candidate.needsVariant]), candidate,
    ]));
    const candidate = unique.size === 1 ? [...unique.values()][0] : null;
    const fail = (code: string, message: string) => issues.push({ id: item.id, code, message });
    if (!candidate || candidate.needsVariant) {
      fail(unique.size > 1 ? "AMBIGUOUS_ITEM" : candidate?.needsVariant ? "VARIANT_REQUIRED" : "ITEM_UNAVAILABLE",
        "Prece ir mainījusies vai nav viennozīmīgi atpazīstama. Izvēlies preci un apjomu vēlreiz.");
      continue;
    }
    const { listing, variant } = candidate;
    if (item.listingId !== undefined && item.variantId === undefined
      && item.id !== canonicalCartId(listing.id, variant?.id) && item.id !== listing.id) {
      fail("IDENTITY_CONFLICT", "Izvēlies preci un apjomu vēlreiz."); continue;
    }
    if (candidate.invalid || listing.status !== "active" || !listing.seller_id || typeof listing.title !== "string") {
      fail("ITEM_UNAVAILABLE", "Prece pašlaik nav pieejama. Izvēlies citu preci.");
      continue;
    }
    let unitCents: number;
    try { priceCents(listing.price); unitCents = priceCents(variant ? variant.price : listing.price); }
    catch { fail("INVALID_PRICE", "Preces cena ir mainījusies vai nav pieejama."); continue; }
    const availableQuantity = variant ? variant.quantity : listing.quantity;
    if (!Number.isSafeInteger(availableQuantity) || availableQuantity < 0) {
      fail("INVALID_STOCK", "Preces atlikumu nevar apstiprināt."); continue;
    }
    const id = canonicalCartId(listing.id, variant?.id);
    const previous = resolved.get(id);
    const quantity = (previous?.quantity ?? 0) + item.quantity;
    if (!Number.isSafeInteger(quantity) || quantity > MAX_CHECKOUT_QUANTITY || quantity > availableQuantity) {
      fail("INSUFFICIENT_STOCK", "Norādītais preces daudzums nav pieejams."); continue;
    }
    resolved.set(id, {
      id, listingId: listing.id, variantId: variant?.id ?? null,
      title: variant ? `${listing.title} — ${variant.title}` : listing.title,
      price: unitCents / 100, unitCents, quantity, availableQuantity,
      unit: variant ? "gab." : listing.unit || "gab.", image: publicProductImage(listing.image_url),
      sellerId: listing.seller_id, sellerName: "",
      storageType: getStorageType({ category: listing.category ?? "", storageType: listing.storage_type ?? undefined }),
      ...(process.env.MARKETPLACE_LIFECYCLE_V1 === "enabled" ? { sourceStorageType: listing.storage_type ?? null } : {}),
      category: listing.category ?? "", courier_delivery: listing.courier_delivery === true,
      express_delivery: listing.express_delivery === true,
      ...(typeof listing.slug === "string" && listing.slug ? { slug: listing.slug } : {}),
    });
  }
  if (issues.length) throw new CheckoutError(409, "CART_ISSUES", "Pārbaudi groza preces.", issues);
  return [...resolved.values()].sort((a, b) => a.id.localeCompare(b.id));
}

/** Cart keys must never become stock references or replace real listing IDs in orders. */
export function orderItemSnapshot(item: CanonicalCartItem & { sourceStorageType?: string | null }) {
  return {
    id: item.listingId, listing_id: item.listingId, variant_id: item.variantId, cart_item_id: item.id,
    title: item.title, price: item.price, quantity: item.quantity, unit: item.unit, image: item.image,
    seller_id: item.sellerId, sellerId: item.sellerId, sellerName: item.sellerName,
    commission_rate: COMMISSION_RATE, storage_type: item.storageType, category: item.category,
    courier_delivery: item.courier_delivery, express_delivery: item.express_delivery,
    ...(item.sourceStorageType !== undefined ? { source_storage_type: item.sourceStorageType } : {}),
  };
}
