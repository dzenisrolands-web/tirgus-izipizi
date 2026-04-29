"use client";

import Link from "next/link";
import { Building2, FileText, CreditCard, ExternalLink } from "lucide-react";

export type LegalData = {
  legal_name: string;
  registration_number: string;
  is_vat_registered: boolean;
  vat_number: string;
  legal_address: string;
  bank_name: string;
  bank_iban: string;
  bank_swift: string;
  self_billing_agreed: boolean;
  self_billing_agreed_at?: string | null;
  self_billing_agreement_version?: string | null;
};

export const EMPTY_LEGAL: LegalData = {
  legal_name: "",
  registration_number: "",
  is_vat_registered: false,
  vat_number: "",
  legal_address: "",
  bank_name: "",
  bank_iban: "",
  bank_swift: "",
  self_billing_agreed: false,
};

export function validateLegal(d: LegalData): string[] {
  const errs: string[] = [];
  if (!d.legal_name.trim()) errs.push("Juridiskais nosaukums ir obligāts");
  if (!/^\d{11}$/.test(d.registration_number.trim()))
    errs.push("Reģistrācijas numuram jābūt 11 ciparu garam");
  if (d.is_vat_registered && !/^LV\d{11}$/i.test(d.vat_number.trim()))
    errs.push("PVN reģistrācijas numuram jābūt formātā LV + 11 cipari");
  if (!d.legal_address.trim()) errs.push("Juridiskā adrese ir obligāta");
  if (!d.bank_name.trim()) errs.push("Bankas nosaukums ir obligāts");
  if (!/^LV\d{2}[A-Z]{4}\d{13}$/i.test(d.bank_iban.replace(/\s/g, "")))
    errs.push("Nepareizs IBAN formāts (gaidītais: LV + 19 zīmes)");
  if (!d.self_billing_agreed)
    errs.push("Lai turpinātu, jāpiekrīt self-billing kārtībai");
  return errs;
}

export function SellerLegalSection({
  data,
  onChange,
  showAgreement = true,
}: {
  data: LegalData;
  onChange: (patch: Partial<LegalData>) => void;
  showAgreement?: boolean;
}) {
  const set = <K extends keyof LegalData>(k: K, v: LegalData[K]) =>
    onChange({ [k]: v } as Partial<LegalData>);

  return (
    <div className="space-y-6">
      {/* Intro */}
      <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800">
        <p className="font-semibold mb-1">Kāpēc šī informācija?</p>
        <p className="text-xs leading-relaxed">
          Mēs (SIA Svaigi) izrakstām rēķinus tavā vārdā <strong>2 reizes mēnesī</strong> par
          platformā veiktajām pārdošanām (self-billing kārtība). Lai to varētu darīt
          legāli un izmaksāt naudu, vajag tavus juridiskos rekvizītus un bankas kontu.
        </p>
      </div>

      {/* Company info */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
          <Building2 size={15} className="text-brand-600" />
          Uzņēmuma informācija
        </div>

        <Field
          label="Juridiskais nosaukums *"
          value={data.legal_name}
          onChange={(v) => set("legal_name", v)}
          placeholder='Piem., SIA "Bērziņu saimniecība" vai Jānis Bērziņš (saimnieciskās darbības veicējs)'
        />

        <Field
          label="Reģistrācijas numurs *"
          value={data.registration_number}
          onChange={(v) => set("registration_number", v.replace(/\D/g, "").slice(0, 11))}
          placeholder="11 ciparu kods"
          inputMode="numeric"
        />

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Vai esi PVN maksātājs? *
          </label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => set("is_vat_registered", false)}
              className={cls(
                "rounded-xl border-2 px-4 py-2.5 text-sm font-medium transition",
                data.is_vat_registered === false
                  ? "border-[#192635] bg-gray-50 text-gray-900"
                  : "border-gray-200 text-gray-500 hover:border-gray-300"
              )}
            >
              Nē, neesmu
            </button>
            <button
              type="button"
              onClick={() => set("is_vat_registered", true)}
              className={cls(
                "rounded-xl border-2 px-4 py-2.5 text-sm font-medium transition",
                data.is_vat_registered === true
                  ? "border-brand-600 bg-brand-50 text-brand-700"
                  : "border-gray-200 text-gray-500 hover:border-gray-300"
              )}
            >
              Jā, esmu
            </button>
          </div>
          <p className="mt-1.5 text-xs text-gray-500">
            Tas ietekmē, kā izrakstam tev rēķinus. Ja neesi drošs — pārbaudi savu statusu{" "}
            <a
              href="https://www6.vid.gov.lv/PVN"
              target="_blank"
              rel="noopener"
              className="text-brand-600 hover:underline"
            >
              VID PVN reģistrā
            </a>
            .
          </p>
        </div>

        {data.is_vat_registered && (
          <Field
            label="PVN reģistrācijas numurs *"
            value={data.vat_number}
            onChange={(v) => set("vat_number", v.toUpperCase().slice(0, 13))}
            placeholder="LV40103915568"
          />
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Juridiskā adrese *
          </label>
          <textarea
            value={data.legal_address}
            onChange={(e) => set("legal_address", e.target.value)}
            className="input mt-1 min-h-[64px] resize-y"
            placeholder="Iela 7, Pilsēta, LV-XXXX"
          />
        </div>
      </div>

      {/* Bank info */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
          <CreditCard size={15} className="text-brand-600" />
          Bankas konts
        </div>
        <p className="text-xs text-gray-500">
          Uz šo kontu tev tiks pārskaitīta neto summa pēc katra perioda rēķina (5
          darba dienu laikā).
        </p>

        <Field
          label="Bankas nosaukums *"
          value={data.bank_name}
          onChange={(v) => set("bank_name", v)}
          placeholder="AS Swedbank / AS SEB / AS Citadele banka / Luminor"
        />

        <Field
          label="IBAN *"
          value={data.bank_iban}
          onChange={(v) => set("bank_iban", v.toUpperCase().replace(/\s/g, ""))}
          placeholder="LV00XXXX0000000000000"
        />

        <Field
          label="SWIFT / BIC (neobligāti)"
          value={data.bank_swift}
          onChange={(v) => set("bank_swift", v.toUpperCase())}
          placeholder="HABALV22 / UNLALV2X / PARXLV22 / RIKOLV2X"
        />
      </div>

      {/* Self-billing agreement */}
      {showAgreement && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
            <FileText size={15} className="text-brand-600" />
            Self-billing vienošanās
          </div>

          <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 text-sm text-gray-700 leading-relaxed">
            <p className="mb-2">
              Self-billing nozīmē, ka <strong>SIA Svaigi izraksta rēķinus tavā vārdā</strong>{" "}
              par platformā veiktajām pārdošanām, un mēs tev apmaksājam neto summu (pārdošana
              mīnus mūsu komisija). Tev pašam nav jāizraksta rēķins mums.
            </p>
            <p className="text-xs text-gray-500">
              Galvenie noteikumi: 2 reizes mēnesī izrakstīti rēķini · 7 dienas iebildumiem ·
              5 darba dienas samaksai · 30 dienu uzteikums · Latvijas tiesības.
            </p>
            <Link
              href="/noteikumi/self-billing"
              target="_blank"
              className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline"
            >
              Lasīt pilno vienošanās tekstu <ExternalLink size={11} />
            </Link>
          </div>

          <label className="flex items-start gap-3 cursor-pointer rounded-xl border-2 border-gray-200 p-3 hover:border-gray-300 transition">
            <input
              type="checkbox"
              checked={data.self_billing_agreed}
              onChange={(e) => set("self_billing_agreed", e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-brand-600"
            />
            <span className="text-sm text-gray-700">
              Esmu izlasījis self-billing vienošanos (versija 1.0) un piekrītu, ka SIA Svaigi
              izraksta rēķinus manā vārdā saskaņā ar tās noteikumiem.
            </span>
          </label>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: "numeric" | "text";
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input mt-1 w-full"
        placeholder={placeholder}
        inputMode={inputMode}
      />
    </div>
  );
}

function cls(...xs: (string | false | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}
