import { record } from "../checkout-items";
/** A review acknowledgement is never a repair of missing historical facts. */
export function marketplaceInvoiceEvidence(order: {
  lifecycle_version?: string | null; status?: string; payment_status?: string;
  paid_at?: string | null; payment_review_reason?: string | null; financial_snapshot?: unknown; items?: unknown;
}): { ok: true; operator: Record<string, string>; version: string } | { ok: false; reason: string } {
  if (order.lifecycle_version !== "marketplace-v1" || order.payment_status !== "paid" || !order.paid_at
    || !["paid", "processing", "shipped", "delivered"].includes(order.status ?? "") || order.payment_review_reason) {
    return { ok: false, reason: "unverified_payment_or_legacy_order" };
  }
  const snapshot = order.financial_snapshot;
  const operator = record(snapshot) && record(snapshot.operator) ? snapshot.operator : null;
  if (!record(snapshot) || snapshot.version !== "marketplace-finance-v1" || snapshot.requires_review !== false
    || typeof snapshot.operator_version !== "string" || !record(snapshot.operator)
    || !["name", "regNr", "vatNr", "address", "phone", "email", "bankName", "iban", "bic", "complaintsEmail"]
      .every(key => operator !== null && typeof operator[key] === "string" && !!(operator[key] as string).trim())) {
    return { ok: false, reason: "missing_operator_or_tax_evidence" };
  }
  if (!Array.isArray(order.items) || !order.items.length || order.items.some(item =>
    !record(item) || typeof item.seller_id !== "string" || item.commission_rate !== 15
    || ![0, 5, 12, 21].includes(item.vat_rate as number)
    || !["locker", "courier"].includes(item.seller_delivery_mode as string)
    || item.seller_courier_fee_cents !== (item.seller_delivery_mode === "courier" ? 350 : 0))) {
    return { ok: false, reason: "missing_financial_line_snapshots" };
  }
  return { ok: true, operator: snapshot.operator as Record<string, string>, version: snapshot.operator_version };
}
