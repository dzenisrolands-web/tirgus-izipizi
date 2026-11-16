/**
 * Current public marketplace operator — SINGLE SOURCE OF TRUTH.
 *
 * Every current public reference to the platform operator (footer, JSON-LD,
 * emails, legal pages, AI assistant context) must read from here. Do NOT
 * hardcode the operator name, registration number, address or bank details
 * anywhere else in the codebase.
 *
 * Static assets that cannot import TypeScript still duplicate these values and
 * must be updated by hand whenever this file changes:
 *   - email-templates/auth/*.html  (uploaded to Supabase Auth dashboard)
 * Historical self-billing agreements and invoice views deliberately retain
 * their existing identity in lib/legal/legacy-self-billing-operator.ts.
 *
 * SIA "Svaigi" restored at the owner's request. Identifiers, address and bank
 * match the archived v1 agreement and git history before d4f5be3. This is not
 * a fresh company-register verification or confirmation of Paysera ownership.
 */
import { legacySelfBillingOperatorInfo, legacySelfBillingFormattedAddress } from "./legal/legacy-self-billing-operator";

export const operatorInfo = {
  legalName: 'Sabiedrība ar ierobežotu atbildību "Svaigi"',
  shortName: 'SIA Svaigi',
  registrationNumber: '40103915568',
  vatNumber: 'LV40103915568',
  brandName: 'IziPizi',
  brandRelationship: 'SIA Svaigi ir IziPizi uzņēmums un apkalpo IziPizi zīmola projektu tirgus.izipizi.lv.',
  isVatRegistered: true,
  vatRate: 21,

  legalAddress: {
    street: 'Margrietas iela 7',
    city: 'Rīga',
    postalCode: 'LV-1046',
    country: 'Latvija',
  },

  contact: {
    phone: '+371 20031552',
    emailGeneral: 'tirgus@izipizi.lv',
    emailComplaints: 'birojs@izipizi.lv',
    website: 'https://tirgus.izipizi.lv',
    publicWebsite: 'https://izipizi.lv',
  },

  bank: {
    name: 'AS Citadele banka',
    iban: 'LV08PARX0017085950001',
    bic: 'PARXLV22',
  },

  invoice: {
    /**
     * Prefix for self-billing invoice numbers: `${prefix}YYYY-NNNN`.
     *
     * Must stay in sync with the `next_invoice_number()` Postgres function —
     * see scripts/migrations/0023_operator_migration_izipizi.sql. Invoices
     * already issued under the previous operator keep their `SV-` prefix and
     * must never be renumbered.
     */
    numberPrefix: 'TIR-',
  },

  paysera: {
    /**
     * Historical public reference only; not used to route payments. Checkout
     * reads its merchant credentials from the server environment. Confirm that
     * merchant project's legal recipient is SIA Svaigi before release; changing
     * the public operator or this reference cannot switch a Paysera account.
     */
    projectId: '210216',
  },
} as const;

export function formattedAddress(): string {
  const a = operatorInfo.legalAddress;
  return `${a.street}, ${a.city}, ${a.postalCode}, ${a.country}`;
}

export function invoiceHeader() {
  // Keep the existing v2 invoice presentation unchanged; no issuer migration.
  const o = legacySelfBillingOperatorInfo;
  return {
    name: o.legalName,
    regNr: o.registrationNumber,
    vatNr: o.vatNumber,
    address: legacySelfBillingFormattedAddress(),
    phone: o.contact.phone,
    email: o.contact.emailGeneral,
    bankName: o.bank.name,
    iban: o.bank.iban,
    bic: o.bank.bic,
  };
}

export function footerRekviziti(): string {
  const o = operatorInfo;
  return [
    o.legalName,
    `Reģ. Nr.: ${o.registrationNumber}`,
    `PVN reģ. Nr.: ${o.vatNumber}`,
    formattedAddress(),
    `Tālr.: ${o.contact.phone}`,
    `E-pasts: ${o.contact.emailGeneral}`,
  ].join(' · ');
}

/**
 * Compact one-liner for transactional email footers.
 * e.g. `SIA Svaigi · Reģ. nr. 40103915568 · tirgus.izipizi.lv`
 */
export function emailFooterLine(): string {
  const o = operatorInfo;
  return `${o.shortName} · Reģ. nr. ${o.registrationNumber} · tirgus.izipizi.lv`;
}

/**
 * Compact one-liner for the site footer — legal identifiers, no contacts.
 * e.g. `SIA Svaigi · Reģ. Nr. 40103915568 · PVN reģ. Nr. LV40103915568 · Margrietas iela 7, Rīga, LV-1046`
 */
export function siteFooterLine(): string {
  const o = operatorInfo;
  const a = o.legalAddress;
  return [
    o.shortName,
    `Reģ. Nr. ${o.registrationNumber}`,
    `PVN reģ. Nr. ${o.vatNumber}`,
    `${a.street}, ${a.city}, ${a.postalCode}`,
  ].join(' · ');
}
