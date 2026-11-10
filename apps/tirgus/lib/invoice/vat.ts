/** Stored service VAT only; never recalculate an issued accounting document. */
export function invoiceCommissionVat(invoice: {
  commission_vat_cents?: number | null;
  commission_vat_rate?: number | null;
  vat_amount_cents?: number | null;
  vat_rate?: number | null;
}): { cents: number; rate: number | null } {
  if (invoice.commission_vat_cents != null) {
    return { cents: invoice.commission_vat_cents, rate: invoice.commission_vat_rate ?? null };
  }
  return { cents: invoice.vat_amount_cents ?? 0, rate: invoice.vat_rate ?? null };
}
