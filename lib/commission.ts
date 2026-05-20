/**
 * Fixed platform commission and delivery fees.
 *
 * Every product on tirgus.izipizi.lv uses the same commission rate.
 * Change constants here and they propagate everywhere:
 * product form, checkout, invoices, statistics.
 */

/** Commission rate in percent (e.g. 15 = 15 %). */
export const COMMISSION_RATE = 15;

/** Fraction form of the rate (0.15). */
export const COMMISSION_FRACTION = COMMISSION_RATE / 100;

/**
 * Courier pickup fee charged to the seller per order.
 * Applies only when seller uses delivery_mode = 'courier'.
 * Locker mode (seller brings to locker) is free.
 */
export const COURIER_FEE = 3.50;

/** Calculate commission amount for a given price. */
export function commissionForPrice(price: number): number {
  return Math.round(price * COMMISSION_FRACTION * 100) / 100;
}

/** Calculate net-to-seller amount (commission only, no courier fee). */
export function netForPrice(price: number): number {
  return Math.round((price - commissionForPrice(price)) * 100) / 100;
}

/**
 * Calculate net-to-seller including optional courier pickup fee.
 * @param price  Order total in EUR
 * @param isCourier  true if seller uses courier pickup mode
 */
export function netForPriceWithDelivery(price: number, isCourier: boolean): number {
  return Math.round((netForPrice(price) - (isCourier ? COURIER_FEE : 0)) * 100) / 100;
}
