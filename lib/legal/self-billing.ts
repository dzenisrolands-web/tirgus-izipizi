/**
 * Self-billing agreement versioning.
 *
 * The agreement binds the seller to a specific operator legal entity, so any
 * change of operator requires a new version and fresh consent from every
 * seller. Consent is stored on `sellers.self_billing_agreement_version`.
 *
 * Version history:
 *   1.0 — 2026-04-29 — operator SIA "Svaigi"
 *   2.0 — operator SIA "IziPizi" (see lib/legal/self-billing-agreement-v2.lv.md)
 */

export const SELF_BILLING_VERSION = "2.0";

/** ISO date the current version takes effect. */
export const SELF_BILLING_EFFECTIVE_DATE = "2026-09-01";

/**
 * True when the seller's stored consent predates the current agreement version
 * and therefore has to be collected again.
 */
export function needsReconsent(storedVersion: string | null | undefined): boolean {
  if (!storedVersion) return false; // never consented — normal first-time flow
  return storedVersion !== SELF_BILLING_VERSION;
}
