"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, ChevronRight, Loader2, RefreshCw, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatPrice } from "@/lib/utils";

type Invoice = {
  id: string;
  invoice_number: string;
  seller_id: string;
  seller_legal_name: string | null;
  period_start: string;
  period_end: string;
  total_gross_cents: number;
  total_commission_cents: number;
  total_net_cents: number;
  status: string;
  generated_at: string;
};

const statusMap: Record<string, { label: string; cls: string }> = {
  draft:     { label: "Sagatavots", cls: "bg-gray-100 text-gray-600" },
  sent:      { label: "Nosūtīts",   cls: "bg-blue-100 text-blue-700" },
  paid:      { label: "Apmaksāts",  cls: "bg-green-100 text-green-700" },
  disputed:  { label: "Strīdīgs",   cls: "bg-amber-100 text-amber-700" },
  cancelled: { label: "Atcelts",    cls: "bg-red-100 text-red-600" },
};

export default function AdminRekiniPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generateMsg, setGenerateMsg] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase
      .from("invoices")
      .select("id, invoice_number, seller_id, seller_legal_name, period_start, period_end, total_gross_cents, total_commission_cents, total_net_cents, status, generated_at")
      .order("generated_at", { ascending: false });
    setInvoices(data ?? []);
    setLoading(false);
  }

  async function manualGenerate() {
    setGenerating(true);
    setGenerateMsg("");
    try {
      const cronSecret = prompt("Ievadi CRON_SECRET (no .env):");
      if (!cronSecret) { setGenerating(false); return; }
      const res = await fetch("/api/cron/generate-invoices", {
        headers: { Authorization: `Bearer ${cronSecret}` },
      });
      const data = await res.json();
      setGenerateMsg(
        data.ok
          ? `Ģenerēti ${data.generated?.length ?? 0} rēķini · izlaists ${data.skipped?.length ?? 0}`
          : `Kļūda: ${data.error}`
      );
      await load();
    } catch (e) {
      setGenerateMsg(`Kļūda: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setGenerating(false);
    }
  }

  const visible = invoices.filter((i) => {
    const q = search.toLowerCase();
    return !q || i.invoice_number.toLowerCase().includes(q) || i.seller_legal_name?.toLowerCase().includes(q);
  });

  if (loading) return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 size={24} className="animate-spin text-gray-400" />
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Rēķini</h1>
          <p className="mt-0.5 text-sm text-gray-500">{invoices.length} kopā</p>
        </div>
        <button onClick={manualGenerate} disabled={generating}
          className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
          {generating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Ģenerēt manuāli
        </button>
      </div>

      {generateMsg && (
        <div className="mb-4 rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800">
          {generateMsg}
        </div>
      )}

      <div className="mb-5 relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Meklēt pa numuru vai tirgotāju..."
          className="input pl-9 w-full max-w-sm" />
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-12 text-center">
          <FileText size={36} className="mx-auto text-gray-300" />
          <p className="mt-3 font-semibold text-gray-900">Nav rēķinu</p>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((inv) => {
            const st = statusMap[inv.status] ?? statusMap.draft;
            return (
              <Link key={inv.id} href={`/dashboard/rekini/${inv.id}`}
                className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white px-5 py-4 shadow-sm hover:border-gray-300 transition">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50">
                  <FileText size={16} className="text-brand-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-mono font-bold text-gray-900">{inv.invoice_number}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${st.cls}`}>{st.label}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                    {inv.seller_legal_name ?? "—"} · {inv.period_start} → {inv.period_end}
                  </p>
                </div>
                <div className="text-right shrink-0 text-xs">
                  <p className="text-gray-400">Bruto: {formatPrice(inv.total_gross_cents / 100)}</p>
                  <p className="font-bold text-gray-900">Neto: {formatPrice(inv.total_net_cents / 100)}</p>
                </div>
                <ChevronRight size={16} className="shrink-0 text-gray-300" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
