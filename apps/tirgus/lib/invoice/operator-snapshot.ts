import { invoiceHeader, operatorInfo } from "../operator-info";

export type InvoiceOperatorSnapshot = Record<keyof ReturnType<typeof invoiceHeader>, string> & {
  complaintsEmail: string;
};

export const INVOICE_OPERATOR_VERSION = "svaigi-3.0";

// Accounting history, not live operator configuration. These identities are
// frozen from the archived agreements v1/v2; never replace them on rebranding.
const archivedSvaigi: InvoiceOperatorSnapshot = {
  name: 'Sabiedrība ar ierobežotu atbildību "Svaigi"',
  regNr: "40103915568",
  vatNr: "LV40103915568",
  address: "Margrietas iela 7, Rīga, LV-1046, Latvija",
  phone: "+371 20031552",
  email: "tirgus@izipizi.lv",
  bankName: "AS Citadele banka",
  iban: "LV08PARX0017085950001",
  bic: "PARXLV22",
  complaintsEmail: "birojs@izipizi.lv",
};

const archivedIziPizi: InvoiceOperatorSnapshot = {
  ...archivedSvaigi,
  name: 'Sabiedrība ar ierobežotu atbildību "IziPizi"',
  regNr: "40203272626",
  vatNr: "LV40203272626",
  address: '"Miltu cehs", Ogresgala pag., Ogres nov., LV-5041, Latvija',
  iban: "LV72PARX0023541960001",
};

export function newInvoiceOperatorSnapshot() {
  return {
    operator_version: INVOICE_OPERATOR_VERSION,
    operator_snapshot: {
      ...invoiceHeader(),
      complaintsEmail: operatorInfo.contact.emailComplaints,
    },
  };
}

export type InvoiceOperatorRecord = {
  invoice_number: string;
  generated_at: string;
  operator_version?: string | null;
  operator_snapshot?: unknown;
};

function validSnapshot(value: unknown): value is InvoiceOperatorSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return ["name", "regNr", "vatNr", "address", "phone", "email",
    "bankName", "iban", "bic", "complaintsEmail"].every(
    key => typeof row[key] === "string" && row[key].trim().length > 0,
  );
}

export function resolveInvoiceOperator(invoice: InvoiceOperatorRecord): InvoiceOperatorSnapshot | null {
  // An explicit but malformed snapshot must never silently fall back.
  if (invoice.operator_snapshot != null || invoice.operator_version != null) {
    return invoice.operator_version?.trim() && validSnapshot(invoice.operator_snapshot)
      ? invoice.operator_snapshot : null;
  }

  const issued = Date.parse(invoice.generated_at);
  if (!Number.isFinite(issued)) return null;
  const number = /^(SV|TIR)-(\d{4})-\d{4,}$/.exec(invoice.invoice_number);
  if (!number) return null;
  // The historical eras are Latvian calendar dates, not UTC dates.
  const date = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Riga", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(issued));
  if (number[2] !== date.slice(0, 4)) return null;
  if (number[1] === "SV" && date >= "2026-04-29" && date < "2026-09-01") {
    return { ...archivedSvaigi };
  }
  if (number[1] === "TIR" && date >= "2026-09-01" && date < "2026-11-09") {
    return { ...archivedIziPizi };
  }
  // The restoration's legal date does not prove deployment time. TIR continued
  // across the change: later legacy rows require verified accounting records.
  return null;
}

export const UNRESOLVED_INVOICE_OPERATOR =
  "Rēķina operatora vēsturiskie rekvizīti nav droši nosakāmi. Sazinieties ar administratoru; nepieciešams pārbaudīts operatora momentuzņēmums.";
