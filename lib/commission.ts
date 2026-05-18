/**
 * Fixed platform commission.
 *
 * Every product on tirgus.izipizi.lv uses the same commission rate.
 * Change the constant here and it will propagate everywhere:
 * product form, checkout, invoices, statistics.
 */

/** Commission rate in percent (e.g. 15 = 15 %). */
export const COMMISSION_RATE = 15;

/** Fraction form of the rate (0.15). */
export const COMMISSION_FRACTION = COMMISSION_RATE / 100;

/** Calculate commission amount for a given price. */
export function commissionForPrice(price: number): number {
  return Math.round(price * COMMISSION_FRACTION * 100) / 100;
}

/** Calculate net-to-seller amount for a given price. */
export function netForPrice(price: number): number {
  return Math.round((price - commissionForPrice(price)) * 100) / 100;
}
