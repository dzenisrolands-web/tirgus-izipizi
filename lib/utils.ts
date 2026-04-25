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

export function getStorageType(listing: { storageType?: string; category: string }): "frozen" | "chilled" | "ambient" {
  if (listing.storageType === "frozen" || listing.storageType === "chilled" || listing.storageType === "ambient") {
    return listing.storageType;
  }
  if (listing.category === "Saldēta pārtika") return "frozen";
  if (listing.category === "Garšaugi" || listing.category === "Konservi" || listing.category === "Eļļas" || listing.category === "Uztura bagātinātāji") return "ambient";
  return "chilled";
}

export const storageConfig = {
  frozen:  { label: "-18°C",        icon: "", cls: "bg-blue-50 text-blue-700 border border-blue-200" },
  chilled: { label: "+2°C – +6°C",  icon: "", cls: "bg-cyan-50 text-cyan-700 border border-cyan-200" },
  ambient: { label: "Istabas t°",   icon: "", cls: "bg-gray-50 text-gray-600 border border-gray-200" },
};

export const HOME_LOCKER_FEE = 1.50;
export const TRANSFER_FEE = 3.00;
export const COURIER_BASE_FEE = 4.50;

export function daysUntil(dateString: string): number {
  const today = new Date();
  const target = new Date(dateString);
  const diff = target.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
