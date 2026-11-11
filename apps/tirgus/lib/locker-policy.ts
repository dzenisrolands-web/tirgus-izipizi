import { lockers, type Locker } from "./mock-data";

/** Retain historical location records, but never offer the closed site for a new shipment. */
export function isClosedLockerId(id: unknown): boolean {
  return typeof id === "string" && id.trim().toLowerCase() === "tukums";
}

export const publicLockers = lockers.filter(locker => !isClosedLockerId(locker.id));
export const openLockers = publicLockers.filter(locker => !locker.coming_soon);

export function getOpenLocker(id: unknown): Locker | undefined {
  return typeof id === "string" ? openLockers.find(locker => locker.id === id) : undefined;
}

/** Pickup-only places cannot receive a transfer for somebody else's seller.
 * Every seller, not merely any one seller, must already deliver locally there.
 */
export function deliveryLockersForSellers(homeIds: readonly (readonly string[])[]): Locker[] {
  if (!Array.isArray(homeIds) || !homeIds.length || homeIds.some(ids => !Array.isArray(ids))) return [];
  return openLockers.filter(locker =>
    !locker.pickup_only || homeIds.every(ids => ids.includes(locker.id)),
  );
}
