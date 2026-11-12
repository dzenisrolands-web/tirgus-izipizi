import { commissionBreakdown } from "./commission";
type Row = {
  id?: string; status?: string; payment_status?: string | null; paid_at?: string | null;
  payment_review_reason?: string | null; items?: unknown;
};
export function recognizedPaidOrder(order: Row): boolean {
  return order.payment_status === "paid" && !!order.paid_at && Number.isFinite(Date.parse(order.paid_at))
    && ["paid", "processing", "shipped", "delivered"].includes(order.status ?? "") && !order.payment_review_reason;
}
export function sellerOrderAmounts(order: Row, sellerId: string, legacyListingIds: ReadonlySet<string> = new Set()) {
  let goodsCents = 0, commissionCents = 0, unknownLines = 0;
  const pickup = new Set<number>();
  for (const raw of Array.isArray(order.items) ? order.items : []) {
    if (!raw || typeof raw !== "object") { unknownLines++; continue; }
    const item = raw as Record<string, unknown>;
    if (item.seller_id && item.sellerId && item.seller_id !== item.sellerId) { unknownLines++; continue; }
    const owner = item.seller_id ?? item.sellerId;
    if (owner ? owner !== sellerId : !legacyListingIds.has(String(item.listing_id ?? item.id))) continue;
    const unit = typeof item.price === "number" ? Math.round(item.price * 100) : NaN;
    const quantity = item.quantity;
    if (!Number.isSafeInteger(unit) || unit <= 0 || Math.abs((item.price as number) * 100 - unit) > 0.000001
      || typeof quantity !== "number" || !Number.isSafeInteger(quantity) || quantity <= 0
      || !Number.isSafeInteger(goodsCents + unit * quantity)) { unknownLines++; continue; }
    goodsCents += unit * quantity;
    if (![0, 5, 12, 21].includes(item.vat_rate as number)
      || (item.seller_courier_fee_cents !== 0 && item.seller_courier_fee_cents !== 350)
      || item.commission_rate !== 15) { unknownLines++; continue; }
    commissionCents += Math.round(commissionBreakdown(unit * quantity / 100, item.vat_rate as number).commissionTotal * 100);
    pickup.add(item.seller_courier_fee_cents as number);
  }
  const complete = unknownLines === 0 && pickup.size === 1;
  const pickupCents = complete ? [...pickup][0] : null;
  return { goodsCents, unknownLines, commissionCents: complete ? commissionCents : null, pickupCents,
    netCents: complete ? goodsCents - commissionCents - pickupCents! : null };
}
