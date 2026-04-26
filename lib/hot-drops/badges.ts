import type { HotDrop, DropBadge } from "./types";
import { availableQuantity } from "./types";

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const THIRTY_MIN_MS = 30 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;
const ALMOST_GONE_UNITS = 3;
const ENDING_PERCENT = 0.2;

export function getDropBadges(drop: HotDrop): DropBadge[] {
  const now = Date.now();
  const publishedMs = new Date(drop.published_at).getTime();
  const expiresMs = new Date(drop.expires_at).getTime();
  const ageMs = now - publishedMs;
  const remainingMs = expiresMs - now;
  const available = availableQuantity(drop);
  const badges: DropBadge[] = [];

  // ✨ JAUNS — published in last 30 min (takes priority over HOT)
  if (ageMs < THIRTY_MIN_MS) {
    badges.push({ key: "new", label: "JAUNS", emoji: "✨" });
  } else if (ageMs < TWO_HOURS_MS) {
    // 🔥 KARSTS — published in last 2h
    badges.push({ key: "hot", label: "KARSTS", emoji: "🔥" });
  }

  // 💨 GANDRĪZ IZPĀRDOTS — fewer than 3 units left
  if (available > 0 && available < ALMOST_GONE_UNITS) {
    badges.push({ key: "almost_gone", label: "GANDRĪZ IZPĀRDOTS", emoji: "💨" });
  }

  // ⏰ BEIDZAS — less than 1h left OR less than 20% remaining
  const lowStock = available / drop.total_quantity < ENDING_PERCENT;
  if (remainingMs > 0 && (remainingMs < ONE_HOUR_MS || lowStock)) {
    if (!badges.find((b) => b.key === "almost_gone")) {
      badges.push({ key: "ending", label: "BEIDZAS", emoji: "⏰" });
    }
  }

  return badges;
}

export function isHot(drop: HotDrop): boolean {
  const ageMs = Date.now() - new Date(drop.published_at).getTime();
  return ageMs < TWO_HOURS_MS;
}

export function msUntilExpiry(drop: HotDrop): number {
  return Math.max(0, new Date(drop.expires_at).getTime() - Date.now());
}
