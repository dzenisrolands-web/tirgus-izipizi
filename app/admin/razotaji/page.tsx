"use client";

import { useEffect, useState } from "react";
import { CheckCircle, XCircle, Clock, AlertCircle, Search, Home, Plus, X } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Seller = {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  status: "draft" | "pending" | "approved" | "rejected";
  created_at: string;
  home_locker_ids: string[] | null;
};

const statusMap = {
  draft:    { label: "Melnraksts", cls: "bg-gray-100 text-gray-500" },
  pending:  { label: "Gaida",      cls: "bg-amber-100 text-amber-700" },
  approved: { label: "Apstiprināts", cls: "bg-green-100 text-green-700" },
  rejected: { label: "Noraidīts",  cls: "bg-red-100 text-red-600" },
};

const LOCKERS = [
  { id: "brivibas",  label: "Brīvības 253, Rīga" },
  { id: "agenskalna", label: "Āgenskalna tirgus, Rīga" },
  { id: "salaspils", label: "Salaspils" },
  { id: "ikskile",   label: "Ikšķile" },
  { id: "tukums",    label: "Tukuma tirgus" },
  { id: "dundaga",   label: "Dundagas tirgus" },
];

export default function AdminRazotajiPage() {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [search, setSearch] = useState("");
  const [expandedLocker, setExpandedLocker] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase
      .from("sellers")
      .select("id,name,description,location,status,created_at,home_locker_ids")
      .order("created_at", { ascending: false });
    setSellers(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function updateStatus(id: string, status: "approved" | "rejected") {
    await supabase.from("sellers").update({ status }).eq("id", id);
    setSellers(p => p.map(s => s.id === id ? { ...s, status } : s));
  }

  async function toggleHomeLocker(sellerId: string, lockerId: string) {
    const seller = sellers.find(s => s.id === sellerId);
    if (!seller) return;
    const current = seller.home_locker_ids ?? [];
    const updated = current.includes(lockerId)
      ? current.filter(id => id !== lockerId)
      : [...current, lockerId];
    await supabase.from("sellers").update({ home_locker_ids: updated }).eq("id", sellerId);
    setSellers(p => p.map(s => s.id === sellerId ? { ...s, home_locker_ids: updated } : s));
  }

  const visible = sellers.filter(s => {
    const matchStatus = filter === "all" || s.status === filter;
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  if (loading) return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Ražotāji</h1>
          <p className="mt-0.5 text-sm text-gray-500">{sellers.length} kopā</p>
        </div>
        {sellers.filter(s => s.status === "pending").length > 0 && (
          <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5">
            <AlertCircle size={16} className="text-amber-600" />
            <span className="text-sm font-semibold text-amber-800">
              {sellers.filter(s => s.status === "pending").length} gaida apstiprinājumu
            </span>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Meklēt ražotāju..."
            className="input pl-9 w-full"
          />
        </div>
        <div className="flex gap-1.5">
          {(["all", "pending", "approved", "rejected"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                filter === f ? "bg-[#192635] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}>
              {f === "all" ? "Visi" : f === "pending" ? "Gaida" : f === "approved" ? "Apstiprināti" : "Noraidīti"}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-12 text-center">
          <p className="text-gray-400">Nav atrasts neviens ražotājs</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          <div className="divide-y divide-gray-50">
            {visible.map(seller => {
              const st = statusMap[seller.status];
              const homeLockers = seller.home_locker_ids ?? [];
              const isExpanded = expandedLocker === seller.id;
              return (
                <div key={seller.id} className="px-5 py-4 hover:bg-gray-50 transition">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                        seller.status === "pending" ? "bg-amber-100 text-amber-700" :
                        seller.status === "approved" ? "bg-green-100 text-green-700" :
                        "bg-gray-100 text-gray-500"
                      }`}>
                        {seller.status === "pending" ? <AlertCircle size={15} /> :
                         seller.status === "approved" ? <CheckCircle size={15} /> :
                         <Clock size={15} />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{seller.name}</p>
                        <p className="text-xs text-gray-400">
                          {seller.location ?? "—"} · {new Date(seller.created_at).toLocaleDateString("lv-LV")}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.cls}`}>
                        {st.label}
                      </span>
                      {/* Home locker toggle */}
                      <button
                        onClick={() => setExpandedLocker(isExpanded ? null : seller.id)}
                        className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                          homeLockers.length > 0
                            ? "bg-brand-50 text-brand-700 hover:bg-brand-100"
                            : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                        }`}
                        title="Mājas pakomāti"
                      >
                        <Home size={12} />
                        {homeLockers.length > 0 ? homeLockers.length : <Plus size={11} />}
                      </button>
                      {seller.status === "pending" && (
                        <>
                          <button onClick={() => updateStatus(seller.id, "approved")}
                            className="flex items-center gap-1 rounded-lg bg-green-50 px-2.5 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-100 transition">
                            <CheckCircle size={12} /> Apstiprināt
                          </button>
                          <button onClick={() => updateStatus(seller.id, "rejected")}
                            className="flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 transition">
                            <XCircle size={12} /> Noraidīt
                          </button>
                        </>
                      )}
                      {seller.status === "approved" && (
                        <button onClick={() => updateStatus(seller.id, "rejected")}
                          className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 transition">
                          Noraidīt
                        </button>
                      )}
                      {seller.status === "rejected" && (
                        <button onClick={() => updateStatus(seller.id, "approved")}
                          className="rounded-lg bg-green-50 px-2.5 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-100 transition">
                          Apstiprināt
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Home locker expanded panel */}
                  {isExpanded && (
                    <div className="mt-3 ml-12 rounded-xl border border-gray-100 bg-white p-3">
                      <p className="mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Mājas pakomāti
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {LOCKERS.map(locker => {
                          const active = homeLockers.includes(locker.id);
                          return (
                            <button
                              key={locker.id}
                              onClick={() => toggleHomeLocker(seller.id, locker.id)}
                              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                                active
                                  ? "bg-brand-100 text-brand-700 hover:bg-brand-200"
                                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                              }`}
                            >
                              {active ? <X size={10} /> : <Plus size={10} />}
                              {locker.label}
                            </button>
                          );
                        })}
                      </div>
                      {homeLockers.length > 0 && (
                        <p className="mt-2 text-[11px] text-brand-600">
                          Aktīvi: {homeLockers.map(id => LOCKERS.find(l => l.id === id)?.label ?? id).join(", ")}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
