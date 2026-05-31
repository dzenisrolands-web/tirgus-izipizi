"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, FileText, CheckCircle, Send, XCircle, AlertTriangle } from "lucide-react";
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
  courier_fee_cents: number | null;
  courier_order_count: number | null;
  status: string;
  generated_at: string;
  paid_at: string | null;
  seller_id: string;
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

const statusMap: Record<string, { label: string; cls: string }> = {
  draft:     { label: "Sagatavots",  cls: "bg-gray-100 text-gray-600" },
  sent:      { label: "Nosūtīts",    cls: "bg-blue-100 text-blue-700" },
  paid:      { label: "Apmaksāts",   cls: "bg-green-100 text-green-700" },
  disputed:  { label: "Strīdīgs",    cls: "bg-amber-100 text-amber-700" },
  cancelled: { label: "Atcelts",     cls: "bg-red-100 text-red-600" },
};

const TRANSITIONS: Record<string, { to: string; label: string; icon: React.ReactNode; cls: string }[]> = {
  draft:    [
    { to: "sent",      label: "Atzīmēt kā nosūtītu",  icon: <Send size={14} />,         cls: "bg-blue-600 text-white hover:bg-blue-700" },
    { to: "cancelled", label: "Atcelt",                icon: <XCircle size={14} />,      cls: "bg-red-100 text-red-700 hover:bg-red-200" },
  ],
  sent:     [
    { to: "paid",      label: "Atzīmēt kā apmaksātu", icon: <CheckCircle size={14} />,  cls: "bg-green-600 text-white hover:bg-green-700" },
    { to: "disputed",  label: "Atzīmēt kā strīdīgu",  icon: <AlertTriangle size={14} />, cls: "bg-amber-100 text-amber-800 hover:bg-amber-200" },
    { to: "cancelled", label: "Atcelt",                icon: <XCircle size={14} />,      cls: "bg-red-100 text-red-700 hover:bg-red-200" },
  ],
  disputed: [
    { to: "paid",      label: "Atzīmēt kā apmaksātu", icon: <CheckCircle size={14} />,  cls: "bg-green-600 text-white hover:bg-green-700" },
    { to: "cancelled", label: "Atcelt",                icon: <XCircle size={14} />,      cls: "bg-red-100 text-red-700 hover:bg-red-200" },
  ],
};

function eur(cents: number) {
  return (cents / 100).toFixed(2) + " €";
}

export default function AdminInvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [msg, setMsg] = useState("");

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

  async function updateStatus(newStatus: string) {
    if (!invoice) return;
    setUpdating(true);
    setMsg("");
    const updates: Record<string, unknown> = { status: newStatus };
    if (newStatus === "paid") updates.paid_at = new Date().toISOString();
    const { error } = await supabase.from("invoices").update(updates).eq("id", invoice.id);
    if (error) {
      setMsg(`Kļūda: ${error.message}`);
    } else {
      setInvoice({ ...invoice, status: newStatus, paid_at: newStatus === "paid" ? new Date().toISOString() : invoice.paid_at });
      setMsg(`Statuss mainīts uz "${statusMap[newStatus]?.label ?? newStatus}"`);
    }
    setUpdating(false);
  }

  if (loading) return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 size={24} className="animate-spin text-gray-400" />
    </div>
  );

  if (!invoice) return (
    <div className="mx-auto max-w-md px-4 py-12 text-center">
      <p className="text-gray-500">Rēķins nav atrasts</p>
      <Link href="/admin/rekini" className="btn-primary mt-4 inline-block">Atpakaļ</Link>
    </div>
  );

  const st = statusMap[invoice.status] ?? statusMap.draft;
  const transitions = TRANSITIONS[invoice.status] ?? [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      {/* Toolbar */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <Link href="/admin/rekini" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900">
          <ArrowLeft size={14} /> Visi rēķini
        </Link>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${st.cls}`}>{st.label}</span>
          {transitions.map((t) => (
            <button key={t.to} onClick={() => updateStatus(t.to)} disabled={updating}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${t.cls}`}>
              {updating ? <Loader2 size={12} className="animate-spin" /> : t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {msg && (
        <div className="mb-4 rounded-xl bg-blue-50 border border-blue-200 px-4 py-2 text-sm text-blue-800">
          {msg}
        </div>
      )}

      {/* Invoice card */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
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
              {invoice.paid_at && (
                <p className="text-sm text-green-700 font-medium">
                  Apmaksāts: {new Date(invoice.paid_at).toLocaleDateString("lv-LV")}
                </p>
              )}
            </div>
            <FileText size={32} className="text-brand-600 shrink-0" />
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

        {/* Lines */}
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
                  <td className="px-2 py-2 text-right text-amber-700">
                    −{eur(l.commission_cents)}<br />
                    <span className="text-[9px]">({l.commission_rate}%)</span>
                  </td>
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
              <span>Komisija 15% (no cenas bez PVN):</span>
              <span className="font-mono">−{eur(invoice.total_commission_cents)}</span>
            </div>
            {invoice.vat_amount_cents !== null && invoice.vat_amount_cents > 0 && (
              <div className="flex justify-between text-orange-700 text-xs">
                <span>PVN {invoice.vat_rate}% par komisijas pakalpojumu:</span>
                <span className="font-mono">−{eur(invoice.vat_amount_cents)}</span>
              </div>
            )}
            {!!invoice.courier_fee_cents && invoice.courier_fee_cents > 0 && (
              <div className="flex justify-between text-gray-600 text-xs">
                <span>Kurjera savakšana ({invoice.courier_order_count ?? 1}× par pasūtījumu à 3,50 €):</span>
                <span className="font-mono">−{eur(invoice.courier_fee_cents)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-gray-200 pt-2 text-base font-extrabold text-gray-900">
              <span>Izmaksājams:</span>
              <span className="font-mono text-green-700">{eur(invoice.total_net_cents)}</span>
            </div>
          </div>
        </div>

        {/* Admin status flow hint */}
        <div className="px-8 py-4 text-xs text-gray-400">
          Statusa plūsma: <span className="font-mono">draft → sent → paid</span> vai <span className="font-mono">disputed → paid / cancelled</span>
        </div>
      </div>
    </div>
  );
}
