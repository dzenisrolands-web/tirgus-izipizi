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

// ─── PVN (VAT) helpers ────────────────────────────────────────────────────────

/**
 * Latvian VAT rates available for sellers.
 * 0%  — exempt (e.g. financial services, not typical for food)
 * 5%  — reduced (certain basic food products, fresh produce)
 * 12% — reduced (medicines, printed books, some food)
 * 21% — standard rate
 */
export const VAT_RATES = [0, 5, 12, 21] as const;
export type VatRate = typeof VAT_RATES[number];

/**
 * Extract VAT amount from a VAT-inclusive price.
 * vatAmount = price × rate / (100 + rate)
 */
export function vatAmountFromInclusive(price: number, vatRate: number): number {
  if (vatRate === 0) return 0;
  return Math.round(price * vatRate / (100 + vatRate) * 100) / 100;
}

/** Price without VAT (ex-VAT) from a VAT-inclusive price. */
export function exVatPrice(price: number, vatRate: number): number {
  if (vatRate === 0) return price;
  return Math.round(price / (1 + vatRate / 100) * 100) / 100;
}

/**
 * Commission is calculated on the FULL (VAT-inclusive) price.
 * Seller is responsible for remitting VAT to the tax authority separately.
 */
export function sellerNetWithVat(
  price: number,
  vatRate: number,
  isCourier = false
): { exVat: number; vatAmount: number; commission: number; net: number } {
  const vatAmount = vatAmountFromInclusive(price, vatRate);
  const exVat = exVatPrice(price, vatRate);
  const commission = commissionForPrice(price); // on full inc-VAT price
  const net = Math.round((price - commission) * 100) / 100;
  return { exVat, vatAmount, commission, net };
}
