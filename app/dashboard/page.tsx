"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Package, Plus, ArrowRight, Clock, CheckCircle, AlertCircle, User } from "lucide-react";
import { supabase } from "@/lib/supabase";

type SellerStatus = "draft" | "pending" | "approved" | "rejected";

const statusConfig: Record<SellerStatus, { label: string; color: string; icon: React.ReactNode; desc: string }> = {
  draft:    { label: "Nepabeigts",       color: "bg-gray-100 text-gray-600",   icon: <Clock size={14} />,        desc: "Aizpildi profilu un iesniedz apstiprināšanai." },
  pending:  { label: "Gaida apstiprinājumu", color: "bg-amber-100 text-amber-700", icon: <Clock size={14} />,   desc: "Mēs izskatīsim tavu pieteikumu 1–2 darba dienu laikā." },
  approved: { label: "Aktīvs",           color: "bg-green-100 text-green-700", icon: <CheckCircle size={14} />, desc: "Profils ir apstiprināts. Vari pievienot produktus." },
  rejected: { label: "Noraidīts",        color: "bg-red-100 text-red-600",     icon: <AlertCircle size={14} />, desc: "Sazinies ar mums, lai noskaidrotu iemeslu." },
};

export default function DashboardPage() {
  const [status, setStatus] = useState<SellerStatus>("draft");
  const [sellerName, setSellerName] = useState("");
  const [productCount, setProductCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: seller } = await supabase
        .from("sellers")
        .select("name, farm_name, status")
        .eq("user_id", user.id)
        .single();

      if (seller) {
        setStatus((seller.status as SellerStatus) ?? "draft");
        setSellerName(seller.farm_name || seller.name || "");
      }

      const { count } = await supabase
        .from("listings")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);

      setProductCount(count ?? 0);
      setLoading(false);
    }
    load();
  }, []);

  const st = statusConfig[status];

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      {/* Greeting */}
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-gray-900">
          Sveiks{sellerName ? `, ${sellerName}` : ""}! 👋
        </h1>
        <p className="mt-1 text-sm text-gray-500">Šeit pārvaldi savu tirgotāja profilu un produktus.</p>
      </div>

      {/* Status card */}
      <div className={`mb-6 flex items-start gap-4 rounded-2xl border p-5 ${
        status === "approved" ? "border-green-200 bg-green-50" :
        status === "pending"  ? "border-amber-200 bg-amber-50" :
        status === "rejected" ? "border-red-200 bg-red-50" :
        "border-gray-200 bg-gray-50"
      }`}>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
          status === "approved" ? "bg-green-100 text-green-600" :
          status === "pending"  ? "bg-amber-100 text-amber-600" :
          status === "rejected" ? "bg-red-100 text-red-500" :
          "bg-gray-200 text-gray-500"
        }`}>
          {st.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900">Profila statuss: <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${st.color}`}>{st.label}</span></p>
          <p className="mt-0.5 text-sm text-gray-600">{st.desc}</p>
          {status === "draft" && (
            <Link href="/dashboard/profils" className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-[#192635] hover:underline">
              Aizpildīt profilu <ArrowRight size={13} />
            </Link>
          )}
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-4 mb-6 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Produkti</p>
          <p className="mt-2 text-3xl font-extrabold text-gray-900">{productCount}</p>
          <Link href="/dashboard/produkti" className="mt-1 flex items-center gap-1 text-xs text-brand-600 hover:underline">
            Skatīt <ArrowRight size={11} />
          </Link>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Pasūtījumi</p>
          <p className="mt-2 text-3xl font-extrabold text-gray-900">0</p>
          <p className="mt-1 text-xs text-gray-400">Drīzumā</p>
        </div>
        <div className="col-span-2 sm:col-span-1 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Apgrozījums</p>
          <p className="mt-2 text-3xl font-extrabold text-gray-900">—</p>
          <p className="mt-1 text-xs text-gray-400">Drīzumā</p>
        </div>
      </div>

      {/* Quick actions */}
      <h2 className="mb-3 text-sm font-extrabold text-gray-700">Ātrās darbības</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/dashboard/produkti/jauns"
          className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm hover:shadow-md transition group">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#192635] text-white">
            <Plus size={18} />
          </div>
          <div>
            <p className="font-semibold text-gray-900 group-hover:text-brand-600">Pievienot produktu</p>
            <p className="text-xs text-gray-400">Jauns produkts katalogā</p>
          </div>
          <ArrowRight size={16} className="ml-auto text-gray-300 group-hover:text-brand-400" />
        </Link>
        <Link href="/dashboard/profils"
          className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm hover:shadow-md transition group">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100">
            <User size={18} className="text-gray-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 group-hover:text-brand-600">Rediģēt profilu</p>
            <p className="text-xs text-gray-400">Apraksts, bildes, video</p>
          </div>
          <ArrowRight size={16} className="ml-auto text-gray-300 group-hover:text-brand-400" />
        </Link>
      </div>
    </div>
  );
}
