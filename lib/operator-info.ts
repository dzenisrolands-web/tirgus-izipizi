/**
 * SIA Svaigi — marketplace operator constants.
 *
 * This is the static "from" data used on every self-billing invoice and in
 * the site footer. Do NOT store this in the DB — it is constant for the
 * platform owner and only changes if the operator entity itself changes.
 *
 * Source of truth: live site footer + firmas.lv + VID PVN register.
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
    publicWebsite: 'https://svaigi.lv',
  },

  bank: {
    name: 'AS Citadele banka',
    iban: 'LV08PARX0017085950001',
    bic: 'PARXLV22',
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
