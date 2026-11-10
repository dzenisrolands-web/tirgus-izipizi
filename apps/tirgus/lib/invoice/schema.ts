import type { SupabaseClient } from "@supabase/supabase-js";

/** Run before numbering, inserts or notifications; never retry without snapshots. */
export async function assertInvoiceSchema(supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase.from("invoices")
    .select("operator_version, operator_snapshot, commission_vat_rate, commission_vat_cents, total_ex_vat_cents, total_product_vat_cents, courier_fee_cents, courier_order_count")
    .limit(0);
  if (error) {
    throw new Error(
      `Invoice schema unavailable. Apply 0038_invoice_operator_snapshots.sql and verify the commission/courier invoice schema before generation (${error.code ?? "unknown"}).`,
    );
  }
  const { error: linesError } = await supabase.from("invoice_lines")
    .select("vat_rate, vat_amount_cents, ex_vat_cents").limit(0);
  if (linesError) {
    throw new Error(
      `Invoice line schema unavailable. Apply 0038_invoice_operator_snapshots.sql before generation (${linesError.code ?? "unknown"}).`,
    );
  }
  const { data: ready, error: rpcError } = await supabase.rpc("invoice_generation_ready");
  if (rpcError || ready !== 1) {
    throw new Error("Atomic invoice generation unavailable. Apply 0039_atomic_invoice_generation.sql before generation.");
  }
}
