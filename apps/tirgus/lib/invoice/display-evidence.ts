export function readInvoiceOperator(invoice: { operator_version?: string | null; operator_snapshot?: unknown }): Record<string, string> | null {
  const value = invoice.operator_snapshot;
  if (!invoice.operator_version || !value || typeof value !== "object" || Array.isArray(value)) return null;
  const snapshot = value as Record<string, unknown>;
  const keys = ["name", "regNr", "vatNr", "address", "phone", "email", "bankName", "iban", "bic", "complaintsEmail"];
  if (!keys.every(key => typeof snapshot[key] === "string" && !!(snapshot[key] as string).trim())) return null;
  return Object.fromEntries(keys.map(key => [key, snapshot[key] as string]));
}
