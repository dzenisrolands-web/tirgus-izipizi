/**
 * Marketplace operator constants — SINGLE SOURCE OF TRUTH.
 *
 * Every legal reference to the platform operator (footer, JSON-LD, invoices,
 * emails, legal pages, AI assistant context) must read from here. Do NOT
 * hardcode the operator name, registration number, address or bank details
 * anywhere else in the codebase.
 *
 * Static assets that cannot import TypeScript still duplicate these values and
 * must be updated by hand whenever this file changes:
 *   - email-templates/auth/*.html  (uploaded to Supabase Auth dashboard)
 *   - current self-billing agreement snapshot; never rewrite older versions
 *
 * Operator restored to SIA "Svaigi" by owner request. Details are preserved
 * in self-billing-agreement-v1.lv.md. Older agreements remain archived.
 * Existing invoice numbers and Paysera configuration are not changed.
 */

export const operatorInfo = {
  legalName: 'Sabiedrība ar ierobežotu atbildību "Svaigi"',
  shortName: 'SIA Svaigi',
  registrationNumber: '40103915568',
  vatNumber: 'LV40103915568',
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
     * Public Paysera project ID, used by the Quality Sign badge script in the
     * document head. The server-side checkout reads PAYSERA_PROJECT_ID from the
     * environment instead, so the two must point at the same project.
     */
    projectId: '210216',
  },
} as const;

export function formattedAddress(): string {
  const a = operatorInfo.legalAddress;
  return `${a.street}, ${a.city}, ${a.postalCode}, ${a.country}`;
}

export function invoiceHeader() {
  return {
    name: operatorInfo.legalName,
    regNr: operatorInfo.registrationNumber,
    vatNr: operatorInfo.vatNumber,
    address: formattedAddress(),
    phone: operatorInfo.contact.phone,
    email: operatorInfo.contact.emailGeneral,
    bankName: operatorInfo.bank.name,
    iban: operatorInfo.bank.iban,
    bic: operatorInfo.bank.bic,
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
