import { lockers, type Locker } from "./mock-data";

/** Closed locations remain in historical data but cannot accept new shipments. */
export const CLOSED_LOCKER_IDS: ReadonlySet<string> = new Set(["tukums"]);

export function isClosedLockerId(id: unknown): boolean {
  return typeof id === "string" && CLOSED_LOCKER_IDS.has(id);
}

/** Public locations may include explicitly labelled future openings, never closed sites. */
export const publicLockers = lockers.filter((locker) => !isClosedLockerId(locker.id));
export const openLockers = publicLockers.filter((locker) => !locker.coming_soon);

export function getOpenLocker(id: unknown): Locker | undefined {
  return typeof id === "string" ? openLockers.find((locker) => locker.id === id) : undefined;
}

export function isOpenLockerId(id: unknown): boolean {
  return !!getOpenLocker(id);
}

/** Pickup-only destinations require every seller in the order to serve the location. */
export function deliveryLockersForSellers(sellerLockerIds: readonly (readonly string[])[]): Locker[] {
  return openLockers.filter((locker) =>
    !locker.pickup_only ||
    (sellerLockerIds.length > 0 && sellerLockerIds.every((ids) => ids.includes(locker.id)))
  );
}
