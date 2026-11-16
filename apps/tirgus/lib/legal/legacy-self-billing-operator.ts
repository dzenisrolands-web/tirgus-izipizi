/**
 * Frozen identity used by the existing self-billing v2 flow and invoice views.
 *
 * Do not retitle issued documents when the public marketplace identity changes.
 * The current invoice schema has no issuer snapshot; migrating future billing
 * needs a separately reviewed consent/provenance transition. This is NOT the
 * current public marketplace operator or a Paysera merchant configuration.
 */
export const legacySelfBillingOperatorInfo = {
  legalName: 'Sabiedrība ar ierobežotu atbildību "IziPizi"',
  shortName: 'SIA IziPizi',
  registrationNumber: '40203272626',
  vatNumber: 'LV40203272626',
  legalAddress: {
    street: '"Miltu cehs"',
    city: 'Ogresgala pag., Ogres nov.',
    postalCode: 'LV-5041',
    country: 'Latvija',
  },
  contact: {
    phone: '+371 20031552',
    emailGeneral: 'tirgus@izipizi.lv',
    emailComplaints: 'birojs@izipizi.lv',
  },
  bank: {
    name: 'AS Citadele banka',
    iban: 'LV72PARX0023541960001',
    bic: 'PARXLV22',
  },
  invoice: { numberPrefix: 'TIR-' },
} as const;

export function legacySelfBillingFormattedAddress(): string {
  const a = legacySelfBillingOperatorInfo.legalAddress;
  return `${a.street}, ${a.city}, ${a.postalCode}, ${a.country}`;
}
