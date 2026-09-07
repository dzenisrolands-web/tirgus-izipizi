import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat("lv-LV", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(price);
}

export function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat("lv-LV", {
    day: "numeric",
    month: "long",
  }).format(new Date(dateString));
}

export function getStorageType(listing: { storageType?: string; category: string }): "frozen" | "chilled" {
  if (listing.storageType === "frozen") return "frozen";
  if (listing.storageType === "chilled" || listing.storageType === "ambient") return "chilled";
  if (listing.category === "Saldēta pārtika") return "frozen";
  return "chilled";
}

export const storageConfig = {
  frozen:  { label: "-18°C",        icon: "", cls: "bg-blue-50 text-blue-700 border border-blue-200" },
  chilled: { label: "+2°C – +6°C",  icon: "", cls: "bg-cyan-50 text-cyan-700 border border-cyan-200" },
};

// Pakomāts piegādes maksa — no 3.00 € (vienā temperatūras zonā).
// Ja pasūtījums ietver 2 temperatūras zonas (dzesēts + saldēts), tiek
// rezervēti 2 zonas → 6 €. Loģika: cart-page.tsx.
// Kurjers un eksprespiegāde: maksa pēc zonām (tarifs), maksā PIRCĒJS.
export const LOCKER_FEE = 3.00;

/**
 * Validate that a listing's image URL looks like a real image, not a bogus
 * placeholder (e.g., bare domain "https://business.izipizi.lv/" from old scraped data).
 *
 * Used to hide products without working images from public catalog/listings.
 */
export function hasValidImage(l: { image?: string | null }): boolean {
  if (!l.image) return false;
  const url = l.image.trim();
  if (!url) return false;
  // Reject bare-domain URLs (no path) like "https://example.com" or "https://example.com/"
  if (/^https?:\/\/[^\/]+\/?$/.test(url)) return false;
  return true;
}

/** Products with price 0 or missing price should not appear in public catalog. */
export function hasValidPrice(l: { price?: number | null }): boolean {
  return typeof l.price === "number" && l.price > 0;
}

/** Combined check: valid image + valid price — use for public-facing product lists. */
export function isPublicReady(l: { image?: string | null; price?: number | null }): boolean {
  return hasValidImage(l) && hasValidPrice(l);
}
// Saderība ar veco kodu — abas tagad ir LOCKER_FEE
export const HOME_LOCKER_FEE = LOCKER_FEE;
export const TRANSFER_FEE = LOCKER_FEE;
export const COURIER_BASE_FEE = 7.74;

/** Latvian relative time, e.g. "tikko", "pirms 2h", "pirms 3 dienām" */
export function relativeTime(isoString: string): string {
  const ms = Date.now() - new Date(isoString).getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 30) return "tikko";
  const min = Math.floor(sec / 60);
  if (min < 1) return "pirms minūtes";
  if (min < 60) return `pirms ${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `pirms ${hr}h ${min % 60 > 0 ? `${min % 60}m` : ""}`.trim();
  const d = Math.floor(hr / 24);
  if (d === 1) return "vakar";
  if (d < 7) return `pirms ${d} dienām`;
  if (d < 30) return `pirms ${Math.floor(d / 7)} ned.`;
  return `pirms ${Math.floor(d / 30)} mēn.`;
}

export function daysUntil(dateString: string): number {
  const today = new Date();
  const target = new Date(dateString);
  const diff = target.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * Convert a product title to a URL-safe slug, handling Latvian diacritics.
 * e.g. "Brieža gaļas pelmeņi 400g" → "brieza-galas-pelmeni-400g"
 */
export function toSlug(title: string): string {
  const lv: [RegExp, string][] = [
    [/[āĀ]/g, 'a'], [/[čČ]/g, 'c'], [/[ēĒ]/g, 'e'], [/[ģĢ]/g, 'g'],
    [/[īĪ]/g, 'i'], [/[ķĶ]/g, 'k'], [/[ļĻ]/g, 'l'], [/[ņŅ]/g, 'n'],
    [/[ōŌ]/g, 'o'], [/[ŗŖ]/g, 'r'], [/[šŠ]/g, 's'], [/[ūŪ]/g, 'u'],
    [/[žŽ]/g, 'z'],
  ];
  let s = title.toLowerCase();
  for (const [r, c] of lv) s = s.replace(r, c);
  return s
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/**
 * Generate a guaranteed-unique slug by appending the first 6 chars of the UUID.
 * Used for backfilling existing listings where two products may have the same title.
 */
export function toUniqueSlug(title: string, id: string): string {
  return `${toSlug(title)}-${id.slice(0, 6)}`;
}

/**
 * Canonical URL for a listing page.
 * Uses slug if available, falls back to UUID for listings that haven't been
 * backfilled yet or are from mock data.
 */
export function listingUrl(l: { id: string; slug?: string | null }): string {
  return `/listing/${l.slug ?? l.id}`;
}

/**
 * Ensure an external URL (website, Facebook, Instagram, TikTok, YouTube, etc.)
 * has a protocol. Sellers often type "www.mysite.lv" or "mysite.lv" without
 * "https://" — an <a href> with no protocol is resolved as a RELATIVE path by
 * the browser, so it 404s on our own domain instead of leaving the site.
 *
 * Returns an empty string unchanged (so callers can still do `{url && <a .../>}`).
 */
export function normalizeUrl(url: string | null | undefined): string {
  const trimmed = (url ?? "").trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  // Also handle other explicit schemes (mailto:, tel:) by leaving them as-is —
  // unlikely for social/website fields, but avoids mangling edge cases.
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}
