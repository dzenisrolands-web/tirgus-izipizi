"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, ChevronRight, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatPrice } from "@/lib/utils";

type Invoice = {
  id: string;
  invoice_number: string;
  period_start: string;
  period_end: string;
  total_gross_cents: number;
  total_commission_cents: number;
  total_net_cents: number;
  status: string;
  generated_at: string;
  paid_at: string | null;
};

const statusMap: Record<string, { label: string; cls: string }> = {
  draft:     { label: "Sagatavots",  cls: "bg-gray-100 text-gray-600" },
  sent:      { label: "Nosūtīts",    cls: "bg-blue-100 text-blue-700" },
  paid:      { label: "Apmaksāts",   cls: "bg-green-100 text-green-700" },
  disputed:  { label: "Strīdīgs",    cls: "bg-amber-100 text-amber-700" },
  cancelled: { label: "Atcelts",     cls: "bg-red-100 text-red-600" },
};

export default function DashboardRekiniPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data: seller } = await supabase
        .from("sellers")
        .select("id")
        .eq("user_id", user.id)
        .single();
      if (!seller) { setLoading(false); return; }
      const { data } = await supabase
        .from("invoices")
        .select("id, invoice_number, period_start, period_end, total_gross_cents, total_commission_cents, total_net_cents, status, generated_at, paid_at")
        .eq("seller_id", seller.id)
        .order("generated_at", { ascending: false });
      setInvoices(data ?? []);
      setLoading(false);
    })();
  }, []);

  if (loading) return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 size={24} className="animate-spin text-gray-400" />
    </div>
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900">Rēķini</h1>
        <p className="mt-0.5 text-sm text-gray-500">Self-billing rēķini, kurus SIA Svaigi izrakstījusi tavā vārdā · {invoices.length} kopā</p>
      </div>

      <div className="mb-6 flex items-start gap-2 rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800">
        <AlertCircle size={16} className="mt-0.5 shrink-0" />
        <div className="text-xs leading-relaxed">
          Rēķini tiek ģenerēti automātiski 2× mēnesī (1. un 16. datumā) par iepriekšējo
          periodu. Pēc rēķina nosūtīšanas tev ir <strong>7 dienas</strong> iebildumiem,
          tad samaksa tiek pārskaitīta 5 darba dienu laikā.
        </div>
      </div>

      {invoices.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-12 text-center">
          <FileText size={36} className="mx-auto text-gray-300" />
          <p className="mt-3 font-semibold text-gray-900">Vēl nav rēķinu</p>
          <p className="mt-1 text-sm text-gray-400">Pirmais rēķins parādīsies pēc tava pirmā apmaksātā pasūtījuma perioda beigām.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {invoices.map((inv) => {
            const st = statusMap[inv.status] ?? statusMap.draft;
            return (
              <Link key={inv.id} href={`/dashboard/rekini/${inv.id}`}
                className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white px-5 py-4 shadow-sm hover:border-gray-300 hover:shadow-md transition">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50">
                  <FileText size={16} className="text-brand-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-mono font-bold text-gray-900">{inv.invoice_number}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${st.cls}`}>{st.label}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Periods {inv.period_start} līdz {inv.period_end}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-gray-400">Neto</p>
                  <p className="font-bold text-gray-900">{formatPrice(inv.total_net_cents / 100)}</p>
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
