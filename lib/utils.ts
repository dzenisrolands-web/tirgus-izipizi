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

export function daysUntil(dateString: string): number {
  const today = new Date();
  const target = new Date(dateString);
  const diff = target.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
