"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Package, Search, RefreshCw, Download, ChevronDown, ChevronUp,
  Truck, Building2, Clock, CheckCircle, XCircle, Loader2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Sutijums = {
  id: string;
  ref: string | null;
  method: string | null;
  status: string;
  sender_name: string;
  sender_phone: string;
  sender_email: string | null;
  sender_address: string | null;
  recipient_name: string;
  recipient_phone: string;
  recipient_address: string | null;
  recipient_zip: string | null;
  cargo: string | null;
  price_eur: number | null;
  price_excl_vat: number | null;
  vat_rate: number | null;
  locker_from: string | null;
  locker_to: string | null;
  locker_same: boolean | null;
  size: string | null;
  zone: number | null;
  temp_tier: number | null;
  speed: string | null;
  time_window: string | null;
  delivery_date: string | null;
  weight_kg: number | null;
  weight_units: number | null;
  details: Record<string, unknown> | null;
  created_at: string;
};

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  jauns:              { label: "Jauns",          cls: "bg-blue-100 text-blue-700" },
  cenas_pieprasijums: { label: "Cenas piep.",   cls: "bg-amber-100 text-amber-700" },
  apmaksats:          { label: "Apmaksāts",     cls: "bg-green-100 text-green-700" },
  apstradē:           { label: "Apstrādē",      cls: "bg-purple-100 text-purple-700" },
  nosutits:           { label: "Nosūtīts",      cls: "bg-indigo-100 text-indigo-700" },
  izsniegts:          { label: "Izsniegts",      cls: "bg-gray-100 text-gray-600" },
  atcelts:            { label: "Atcelts",        cls: "bg-red-100 text-red-600" },
  gaida_apmaksu:      { label: "Gaida apmaksu", cls: "bg-yellow-100 text-yellow-700" },
};

const STATUS_FLOW = ["jauns", "apmaksats", "apstradē", "nosutits", "izsniegts"];

const METHOD_ICONS: Record<string, typeof Package> = {
  locker: Building2,
  courier: Truck,
  bus: Truck,
};

function fmt(n: number | null) {
  if (n === null || n === undefined) return "—";
  return n.toFixed(2).replace(".", ",") + " €";
}

export default function AdminSutijumiPage() {
  const [items, setItems] = useState<Sutijums[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) return;
    try {
      const res = await fetch("/api/admin/sutijumi", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      setItems(json.sutijumi ?? []);
    } catch (e) {
      console.error("Load sutijumi failed:", e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function updateStatus(id: string, newStatus: string) {
    setUpdating(id);
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) { alert("Nav sesijas"); setUpdating(null); return; }
    try {
      const res = await fetch("/api/admin/sutijumi", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, status: newStatus }),
      });
      const json = await res.json();
      if (json.ok) {
        setItems(prev => prev.map(s => s.id === id ? { ...s, status: newStatus } : s));
      } else {
        alert(`Kļūda: ${json.error}`);
      }
    } catch (e) {
      alert(`Kļūda: ${e instanceof Error ? e.message : "?"}`);
    }
    setUpdating(null);
  }

  function exportCSV() {
    const rows = visible.map(s => [
      s.ref ?? "", s.method ?? "", s.status,
      s.sender_name, s.sender_phone, s.sender_email ?? "",
      s.recipient_name, s.recipient_phone, s.recipient_address ?? "", s.recipient_zip ?? "",
      s.price_eur ?? "", s.price_excl_vat ?? "",
      s.locker_from ?? "", s.locker_to ?? "", s.size ?? "",
      s.zone ?? "", s.speed ?? "", s.delivery_date ?? "",
      s.cargo ?? "", s.created_at,
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));

    const header = "Ref,Metode,Statuss,Sūtītājs,Tālr,E-pasts,Saņēmējs,Tālr,Adrese,Indekss,Cena€,BezPVN,No,Uz,Izmērs,Zona,Ātrums,Datums,Apraksts,Izveidots";
    const csv = "\uFEFF" + header + "\n" + rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `sutijumi-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  const visible = items.filter(s => {
    if (filter !== "all" && s.status !== filter) return false;
    if (methodFilter !== "all" && s.method !== methodFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (s.ref ?? "").toLowerCase().includes(q) ||
        s.sender_name.toLowerCase().includes(q) ||
        s.recipient_name.toLowerCase().includes(q) ||
        (s.sender_email ?? "").toLowerCase().includes(q);
    }
    return true;
  });

  if (loading) return <div className="p-8 text-center text-gray-400"><Loader2 className="mx-auto animate-spin" size={24} /> Ielādē...</div>;

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
            <Package size={22} /> Sūtījumi
          </h1>
          <p className="text-sm text-gray-500">{items.length} kopā · {visible.length} rādīti</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => load()} className="btn-outline text-xs flex items-center gap-1">
            <RefreshCw size={12} /> Atsvaidzināt
          </button>
          <button onClick={exportCSV} className="btn-outline text-xs flex items-center gap-1">
            <Download size={12} /> CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Meklēt (ref, vārds, e-pasts)..."
            className="input pl-9 w-full" />
        </div>
        <div className="flex gap-1">
          {["all", "jauns", "apmaksats", "izsniegts", "atcelts", "cenas_pieprasijums"].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${filter === f ? "bg-[#192635] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {f === "all" ? "Visi" : (STATUS_MAP[f]?.label ?? f)}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {["all", "locker", "courier", "bus"].map(m => (
            <button key={m} onClick={() => setMethodFilter(m)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${methodFilter === m ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {m === "all" ? "Visi veidi" : m === "locker" ? "Pakomāts" : m === "courier" ? "Kurjers" : "Buss"}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-12 text-center">
          <p className="text-gray-400">Nav atrasts neviens sūtījums</p>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map(s => {
            const st = STATUS_MAP[s.status] ?? { label: s.status, cls: "bg-gray-100 text-gray-600" };
            const Icon = METHOD_ICONS[s.method ?? ""] ?? Package;
            const isOpen = expanded === s.id;
            return (
              <div key={s.id} className="rounded-xl border border-gray-100 bg-white shadow-sm">
                {/* Summary row */}
                <button onClick={() => setExpanded(isOpen ? null : s.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition">
                  <Icon size={16} className="text-gray-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-gray-700">{s.ref ?? s.id.slice(0, 8)}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${st.cls}`}>{st.label}</span>
                      {s.method && <span className="text-[10px] text-gray-400">{s.method}</span>}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      {s.sender_name} → {s.recipient_name}
                      {s.locker_from && ` · ${s.locker_from}`}
                      {s.locker_to && s.locker_to !== s.locker_from && ` → ${s.locker_to}`}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-gray-900 shrink-0">{fmt(s.price_eur)}</span>
                  <span className="text-[10px] text-gray-400 shrink-0">
                    {new Date(s.created_at).toLocaleDateString("lv-LV", { day: "numeric", month: "short" })}
                  </span>
                  {isOpen ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                </button>

                {/* Detail */}
                {isOpen && (
                  <div className="border-t border-gray-50 px-4 py-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="font-bold text-gray-700 mb-1">Sūtītājs</p>
                        <p>{s.sender_name}</p>
                        <p className="text-gray-500">{s.sender_phone}</p>
                        {s.sender_email && <p className="text-gray-500">{s.sender_email}</p>}
                        {s.sender_address && <p className="text-gray-500">{s.sender_address}</p>}
                      </div>
                      <div>
                        <p className="font-bold text-gray-700 mb-1">Saņēmējs</p>
                        <p>{s.recipient_name}</p>
                        <p className="text-gray-500">{s.recipient_phone}</p>
                        {s.recipient_address && <p className="text-gray-500">{s.recipient_address}</p>}
                        {s.recipient_zip && <p className="text-gray-500">LV-{s.recipient_zip}</p>}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div>
                        <span className="text-gray-500">Metode:</span>{" "}
                        <strong>{s.method ?? "—"}</strong>
                      </div>
                      <div>
                        <span className="text-gray-500">Izmērs:</span>{" "}
                        <strong>{s.size ?? "—"}</strong>
                      </div>
                      <div>
                        <span className="text-gray-500">Zona:</span>{" "}
                        <strong>{s.zone ?? "—"}</strong>
                      </div>
                      {s.speed && <div><span className="text-gray-500">Ātrums:</span> <strong>{s.speed}</strong></div>}
                      {s.delivery_date && <div><span className="text-gray-500">Datums:</span> <strong>{s.delivery_date}</strong></div>}
                      {s.time_window && <div><span className="text-gray-500">Logs:</span> <strong>{s.time_window}</strong></div>}
                      {s.weight_kg && <div><span className="text-gray-500">Svars:</span> <strong>{s.weight_kg} kg</strong></div>}
                    </div>

                    {s.cargo && (
                      <div className="text-xs"><span className="text-gray-500">Apraksts:</span> {s.cargo}</div>
                    )}

                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-gray-500">Cena:</span>
                      <strong>{fmt(s.price_eur)}</strong>
                      {s.price_excl_vat && <span className="text-gray-400">(bez PVN: {fmt(s.price_excl_vat)})</span>}
                    </div>

                    {s.details && Object.keys(s.details).length > 0 && (
                      <pre className="text-[10px] bg-gray-50 rounded p-2 overflow-auto text-gray-500">
                        {JSON.stringify(s.details, null, 2)}
                      </pre>
                    )}

                    {/* Status change */}
                    <div className="flex items-center gap-2 pt-2 border-t border-gray-50">
                      <span className="text-xs text-gray-500">Mainīt statusu:</span>
                      {STATUS_FLOW.map(st => (
                        <button key={st} onClick={() => updateStatus(s.id, st)}
                          disabled={s.status === st || updating === s.id}
                          className={`rounded-full px-3 py-1 text-[10px] font-bold transition ${
                            s.status === st
                              ? "bg-[#192635] text-white"
                              : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                          } disabled:opacity-40`}>
                          {updating === s.id ? "..." : (STATUS_MAP[st]?.label ?? st)}
                        </button>
                      ))}
                      <button onClick={() => updateStatus(s.id, "atcelts")}
                        disabled={s.status === "atcelts" || updating === s.id}
                        className="rounded-full px-3 py-1 text-[10px] font-bold bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-40">
                        Atcelt
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
