import { COMMISSION_RATE } from "./commission";

export type CheckoutListing = {
  id: string; title: string; price: number; quantity: number; unit: string;
  seller_id: string | null; status: string; variants: unknown;
  vat_rate: number | null;
  courier_delivery?: boolean; express_delivery?: boolean;
};

type RequestedItem = { id: string; quantity: number };
type Variant = { id: string; title: string; price: number; quantity: number };

/** Candidate listing IDs support both plain IDs and the legacy `${listingId}-${variantId}` cart key. */
export function checkoutListingIds(items: RequestedItem[]): string[] {
  return [...new Set(items.flatMap(item => {
    const candidates = [item.id];
    for (let i = item.id.indexOf("-"); i !== -1; i = item.id.indexOf("-", i + 1)) {
      candidates.push(item.id.slice(0, i));
    }
    return candidates;
  }))];
}

export function normalizeCheckoutItems(items: RequestedItem[], listings: CheckoutListing[], method: string) {
  const seen = new Set<string>();
  const skuQuantities = new Map<string, number>();
  return items.map(item => {
    if (typeof item.id !== "string" || !Number.isSafeInteger(item.quantity) || item.quantity < 1 ||
        item.quantity > 999 || seen.has(item.id)) throw new Error("Nederīga prece vai daudzums");
    seen.add(item.id);
    let listing = listings.find(l => l.id === item.id);
    let variant: Variant | undefined;
    // Quick-add cards use the plain listing ID, representing the first variant.
    if (listing && Array.isArray(listing.variants) && listing.variants.length) variant = listing.variants[0];
    if (!listing) {
      for (const candidate of listings) {
        const variants = Array.isArray(candidate.variants) ? candidate.variants as Variant[] : [];
        const match = variants.find(v => `${candidate.id}-${v.id}` === item.id);
        if (match) { listing = candidate; variant = match; break; }
      }
    }
    if (!listing || listing.status !== "active" || !listing.seller_id) throw new Error("Prece nav pieejama");
    if (method === "courier" && listing.courier_delivery === false) throw new Error("Precei nav kurjera piegādes");
    if (method === "express" && listing.express_delivery !== true) throw new Error("Precei nav eksprespiegādes");
    const price = Number(variant?.price ?? listing.price);
    const cents = Math.round(price * 100);
    const stock = variant?.quantity ?? listing.quantity;
    const sku = `${listing.id}:${variant?.id ?? "base"}`;
    const skuQty = (skuQuantities.get(sku) ?? 0) + item.quantity;
    skuQuantities.set(sku, skuQty);
    if (!Number.isSafeInteger(cents) || cents <= 0 || !Number.isFinite(Number(stock)) ||
        Number(stock) < skuQty) throw new Error("Nepietiekams atlikums vai nederīga cena");
    if (listing.vat_rate !== null && ![0, 5, 12, 21].includes(listing.vat_rate)) throw new Error("Precei nav norādīta PVN likme");
    return {
      id: item.id, listing_id: listing.id, title: variant ? `${listing.title} — ${variant.title}` : listing.title,
      price: cents / 100, quantity: item.quantity, unit: variant ? "gab." : listing.unit,
      seller_id: listing.seller_id, sellerId: listing.seller_id, commission_rate: COMMISSION_RATE, vat_rate: listing.vat_rate,
    };
  });
}
