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

// Pakomāts piegādes maksa — 3 € par skapīti (vienā temperatūras zonā).
// Ja pasūtījums ietver 2 temperatūras zonas (dzesēts + saldēts), tiek
// rezervēti 2 skapīši → 6 €. Logika nopirka cart-page.tsx.
export const LOCKER_FEE = 3;

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
