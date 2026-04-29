"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Printer, Loader2, FileText } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { operatorInfo, formattedAddress } from "@/lib/operator-info";

type Invoice = {
  id: string;
  invoice_number: string;
  period_start: string;
  period_end: string;
  total_gross_cents: number;
  total_commission_cents: number;
  total_net_cents: number;
  vat_rate: number | null;
  vat_amount_cents: number | null;
  status: string;
  generated_at: string;
  seller_legal_name: string | null;
  seller_reg_number: string | null;
  seller_vat_number: string | null;
  seller_legal_address: string | null;
  seller_bank_name: string | null;
  seller_bank_iban: string | null;
};

type Line = {
  id: string;
  order_number: string;
  order_date: string;
  product_title: string;
  quantity: number;
  unit: string | null;
  unit_price_cents: number;
  line_gross_cents: number;
  commission_rate: number;
  commission_cents: number;
  net_cents: number;
  line_order: number;
};

function eur(cents: number) {
  return (cents / 100).toFixed(2) + " €";
}

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!params?.id) return;
    (async () => {
      const [{ data: inv }, { data: ls }] = await Promise.all([
        supabase.from("invoices").select("*").eq("id", params.id).single(),
        supabase.from("invoice_lines").select("*").eq("invoice_id", params.id).order("line_order"),
      ]);
      setInvoice(inv as Invoice | null);
      setLines((ls ?? []) as Line[]);
      setLoading(false);
    })();
  }, [params?.id]);

  if (loading) return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 size={24} className="animate-spin text-gray-400" />
    </div>
  );

  if (!invoice) return (
    <div className="mx-auto max-w-md px-4 py-12 text-center">
      <p className="text-gray-500">Rēķins nav atrasts</p>
      <Link href="/dashboard/rekini" className="btn-primary mt-4 inline-block">Atpakaļ</Link>
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      {/* Top toolbar — hidden when printing */}
      <div className="mb-6 flex items-center justify-between print:hidden">
        <Link href="/dashboard/rekini" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900">
          <ArrowLeft size={14} /> Visi rēķini
        </Link>
        <button onClick={() => window.print()}
          className="flex items-center gap-2 rounded-xl bg-[#192635] px-4 py-2 text-sm font-semibold text-white hover:bg-[#243647]">
          <Printer size={14} /> Drukāt / saglabāt PDF
        </button>
      </div>

      {/* Invoice card */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm print:rounded-none print:border-0 print:shadow-none">
        {/* Header */}
        <div className="border-b border-gray-200 px-8 py-6">
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Rēķins (self-billing)</p>
              <h1 className="mt-1 font-mono text-2xl font-extrabold text-gray-900">{invoice.invoice_number}</h1>
              <p className="mt-1 text-sm text-gray-500">
                Sastādīts: {new Date(invoice.generated_at).toLocaleDateString("lv-LV")}
              </p>
              <p className="text-sm text-gray-500">
                Periods: {invoice.period_start} līdz {invoice.period_end}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <FileText size={32} className="text-brand-600" />
            </div>
          </div>
        </div>

        {/* Parties */}
        <div className="grid grid-cols-1 gap-6 border-b border-gray-200 px-8 py-6 sm:grid-cols-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Operators (sastādītājs)</p>
            <p className="mt-1.5 font-bold text-gray-900">{operatorInfo.legalName}</p>
            <p className="text-xs text-gray-600">Reģ. Nr.: {operatorInfo.registrationNumber}</p>
            <p className="text-xs text-gray-600">PVN: {operatorInfo.vatNumber}</p>
            <p className="mt-1 text-xs text-gray-500">{formattedAddress()}</p>
            <p className="mt-1 text-xs text-gray-500">{operatorInfo.bank.name}</p>
            <p className="text-xs font-mono text-gray-500">{operatorInfo.bank.iban}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Tirgotājs (saņēmējs)</p>
            <p className="mt-1.5 font-bold text-gray-900">{invoice.seller_legal_name ?? "—"}</p>
            <p className="text-xs text-gray-600">Reģ. Nr.: {invoice.seller_reg_number ?? "—"}</p>
            {invoice.seller_vat_number && (
              <p className="text-xs text-gray-600">PVN: {invoice.seller_vat_number}</p>
            )}
            <p className="mt-1 text-xs text-gray-500 whitespace-pre-line">{invoice.seller_legal_address ?? "—"}</p>
            <p className="mt-1 text-xs text-gray-500">{invoice.seller_bank_name ?? "—"}</p>
            <p className="text-xs font-mono text-gray-500">{invoice.seller_bank_iban ?? "—"}</p>
          </div>
        </div>

        {/* Lines table */}
        <div className="overflow-x-auto border-b border-gray-200 px-2 py-4 sm:px-8">
          <table className="w-full text-xs">
            <thead className="border-b border-gray-100">
              <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-gray-400">
                <th className="px-2 py-2">Datums</th>
                <th className="px-2 py-2">Pasūtījums</th>
                <th className="px-2 py-2">Produkts</th>
                <th className="px-2 py-2 text-right">Daudz.</th>
                <th className="px-2 py-2 text-right">Cena</th>
                <th className="px-2 py-2 text-right">Bruto</th>
                <th className="px-2 py-2 text-right">Komis.</th>
                <th className="px-2 py-2 text-right">Neto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {lines.map((l) => (
                <tr key={l.id} className="text-gray-700">
                  <td className="px-2 py-2 whitespace-nowrap">{l.order_date}</td>
                  <td className="px-2 py-2 font-mono text-[10px]">{l.order_number}</td>
                  <td className="px-2 py-2">{l.product_title}</td>
                  <td className="px-2 py-2 text-right">{l.quantity} {l.unit ?? ""}</td>
                  <td className="px-2 py-2 text-right">{eur(l.unit_price_cents)}</td>
                  <td className="px-2 py-2 text-right font-medium">{eur(l.line_gross_cents)}</td>
                  <td className="px-2 py-2 text-right text-amber-700">−{eur(l.commission_cents)}<br /><span className="text-[9px]">({l.commission_rate}%)</span></td>
                  <td className="px-2 py-2 text-right font-bold text-green-700">{eur(l.net_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="border-b border-gray-200 px-8 py-6">
          <div className="ml-auto max-w-sm space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Bruto pārdošana:</span>
              <span className="font-mono">{eur(invoice.total_gross_cents)}</span>
            </div>
            <div className="flex justify-between text-amber-700">
              <span>Operatora komisija:</span>
              <span className="font-mono">−{eur(invoice.total_commission_cents)}</span>
            </div>
            {invoice.vat_amount_cents !== null && invoice.vat_amount_cents > 0 && (
              <div className="flex justify-between text-gray-500 text-xs">
                <span>t.sk. PVN ({invoice.vat_rate}%) par komisiju:</span>
                <span className="font-mono">{eur(invoice.vat_amount_cents)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-gray-200 pt-2 text-base font-extrabold text-gray-900">
              <span>Izmaksājams Tirgotājam:</span>
              <span className="font-mono text-green-700">{eur(invoice.total_net_cents)}</span>
            </div>
          </div>
        </div>

        {/* Footer note */}
        <div className="px-8 py-4 text-[10px] leading-relaxed text-gray-500">
          Šis rēķins sastādīts klienta self-billing kārtībā saskaņā ar PVN direktīvas
          224. pantu un Tirgotāja-Operatora vienošanos. Iebildumi: 7 dienu laikā uz{" "}
          {operatorInfo.contact.emailComplaints}. Samaksa: 5 darba dienu laikā pēc
          klusas pieņemšanas vai iebildumu atrisināšanas.
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body { background: white; }
          @page { margin: 1.5cm; }
        }
      `}</style>
    </div>
  );
}
