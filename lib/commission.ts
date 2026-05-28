/**
 * Fixed platform commission and delivery fees.
 *
 * Every product on tirgus.izipizi.lv uses the same commission rate.
 * Change constants here and they propagate everywhere:
 * product form, checkout, invoices, statistics.
 */

/** Commission rate in percent — applied to the ex-VAT (net of product VAT) price. */
export const COMMISSION_RATE = 15;

/** Fraction form of the rate (0.15). */
export const COMMISSION_FRACTION = COMMISSION_RATE / 100;

/**
 * VAT rate charged by the operator (SIA Svaigi) ON ITS COMMISSION SERVICE.
 * The operator is VAT-registered; its commission is a taxable service.
 */
export const COMMISSION_SERVICE_VAT = 21;

/**
 * Full commission breakdown for a product.
 *
 * Law: commission is 15% of the ex-VAT (net) price.
 * SIA Svaigi adds 21% VAT on top of that as a taxable service provider.
 *
 * Example (21% product VAT, 10€ price):
 *   exVat         = 10 / 1.21       = 8.26 €
 *   commissionNet = 8.26 × 0.15    = 1.24 €  (operator's net revenue)
 *   commissionVat = 1.24 × 0.21    = 0.26 €  (operator remits to VID)
 *   commissionTotal                = 1.50 €
 *   netToSeller   = 10 - 1.50      = 8.50 €  (= 85%)
 */
export function commissionBreakdown(
  price: number,
  productVatRate: number,
): {
  exVat: number;          // price without product VAT
  commissionNet: number;  // 15% of exVat (operator's net revenue)
  commissionVat: number;  // 21% VAT on commissionNet (operator remits to VID)
  commissionTotal: number; // commissionNet + commissionVat (total deducted from seller)
  netToSeller: number;    // price - commissionTotal
} {
  const exVat    = Math.round(price / (1 + productVatRate / 100) * 100) / 100;
  const cNet     = Math.round(exVat * (COMMISSION_RATE / 100) * 100) / 100;
  const cVat     = Math.round(cNet * (COMMISSION_SERVICE_VAT / 100) * 100) / 100;
  const cTotal   = Math.round((cNet + cVat) * 100) / 100;
  const net      = Math.round((price - cTotal) * 100) / 100;
  return { exVat, commissionNet: cNet, commissionVat: cVat, commissionTotal: cTotal, netToSeller: net };
}

/**
 * Courier pickup fee charged to the seller per order.
 * Applies only when seller uses delivery_mode = 'courier'.
 * Locker mode (seller brings to locker) is free.
 */
export const COURIER_FEE = 3.50;

/**
 * Commission amount for a given gross price (assuming 21% product VAT).
 * For 21% VAT products: equals commissionBreakdown(price, 21).commissionTotal.
 * Use commissionBreakdown() for exact per-VAT-rate calculation.
 */
export function commissionForPrice(price: number): number {
  const { commissionTotal } = commissionBreakdown(price, 21);
  return commissionTotal;
}

/** Net-to-seller for 21% VAT products. */
export function netForPrice(price: number): number {
  return commissionBreakdown(price, 21).netToSeller;
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
 * 5%  — reduced (certain basic food products, fresh produce)
 * 12% — reduced (medicines, printed books, some food)
 * 21% — standard rate
 */
export const VAT_RATES = [5, 12, 21] as const;
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
