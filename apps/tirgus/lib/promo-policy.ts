/** Temporarily hidden first-order offer; other campaigns remain unchanged. */
export const FIRST_ORDER_PROMO_ENABLED = false;
export const FIRST_ORDER_PROMO_CODE = "PIRMAIS";

export function isDisabledFirstOrderPromo(code: string): boolean {
  return !FIRST_ORDER_PROMO_ENABLED && code.trim().toUpperCase() === FIRST_ORDER_PROMO_CODE;
}
