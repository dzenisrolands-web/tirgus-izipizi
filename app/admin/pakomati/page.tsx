"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Building2, Plus, Search, RefreshCw, ChevronDown, ChevronUp,
  Thermometer, Wifi, WifiOff, Warehouse, MapPin, Clock, Edit2,
  Save, X, Loader2, Handshake, Package, Snowflake, AlertTriangle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Compartment = {
  id: string;
  code: string;
  size: string;
  temp_mode: string;
  status: string;
};

type Pakomats = {
  id: string;
  code: string;
  name: string;
  address: string | null;
  postal_code: string | null;
  lat: number | null;
  lng: number | null;
  franchise_partner_id: string | null;
  status: string;
  has_warehouse: boolean;
  is_hub: boolean;
  note: string | null;
  created_at: string;
  // joined
  partner_name?: string;
  compartments?: Compartment[];
};

type Partner = { id: string; company_name: string };

const STATUS_COLORS: Record<string, string> = {
  aktivs: "bg-green-100 text-green-700",
  serviss: "bg-amber-100 text-amber-700",
  neaktivs: "bg-gray-100 text-gray-500",
};

const COMP_STATUS_COLORS: Record<string, string> = {
  brivs: "bg-white border-gray-200 text-gray-600",
  rezervets: "bg-blue-50 border-blue-300 text-blue-700",
  aiznemts: "bg-green-50 border-green-300 text-green-700",
  serviss: "bg-gray-100 border-gray-300 text-gray-400",
};

const TEMP_ICONS: Record<string, { icon: typeof Thermometer; cls: string; label: string }> = {
  atdzesets: { icon: Thermometer, cls: "text-blue-500", label: "+2…+6°C" },
  saldets:   { icon: Snowflake,   cls: "text-violet-500", label: "−18°C" },
  istabas:   { icon: Thermometer, cls: "text-gray-400", label: "Istabas" },
  karsts:    { icon: Thermometer, cls: "text-red-500", label: "Karsts" },
};

// izipizi-web Supabase client
const IZP_URL = "https://wepyslyqcxpszobfkzzs.supabase.co";
const IZP_KEY = "sb_publishable_BMqu4RvrA4cl72OJQQakLA_8Amc2F8-";
function izpClient() {
  const { createClient } = require("@supabase/supabase-js");
  return createClient(IZP_URL, IZP_KEY);
}

export default function AdminPakomatiPage() {
  const [items, setItems] = useState<Pakomats[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Pakomats>>({});
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newPak, setNewPak] = useState({ code: "", name: "", address: "", postal_code: "", lat: "", lng: "", status: "aktivs", has_warehouse: false, is_hub: false, note: "", franchise_partner_id: "" });

  const load = useCallback(async () => {
    const sb = izpClient();
    const [pakRes, partRes, compRes] = await Promise.all([
      sb.from("pakomati").select("*").order("name"),
      sb.from("franchise_partners").select("id, company_name"),
      sb.from("compartments").select("*"),
    ]);
    const paks: Pakomats[] = (pakRes.data ?? []).map((p: Pakomats) => ({
      ...p,
      compartments: (compRes.data ?? []).filter((c: Compartment & { pakomats_id: string }) => c.pakomats_id === p.id),
      partner_name: (partRes.data ?? []).find((fp: Partner) => fp.id === p.franchise_partner_id)?.company_name ?? null,
    }));
    setItems(paks);
    setPartners(partRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function savePakomats(id: string) {
    setSaving(true);
    const sb = izpClient();
    const updates: Record<string, unknown> = { ...editData };
    if (updates.franchise_partner_id === "") updates.franchise_partner_id = null;
    const { error } = await sb.from("pakomati").update(updates).eq("id", id);
    if (error) { alert("Kļūda: " + error.message); }
    else {
      setEditing(null);
      await load();
    }
    setSaving(false);
  }

  async function addPakomats() {
    setSaving(true);
    const sb = izpClient();
    const insert: Record<string, unknown> = {
      ...newPak,
      lat: newPak.lat ? parseFloat(newPak.lat) : null,
      lng: newPak.lng ? parseFloat(newPak.lng) : null,
      franchise_partner_id: newPak.franchise_partner_id || null,
    };
    const { error } = await sb.from("pakomati").insert(insert);
    if (error) { alert("Kļūda: " + error.message); }
    else {
      setShowAdd(false);
      setNewPak({ code: "", name: "", address: "", postal_code: "", lat: "", lng: "", status: "aktivs", has_warehouse: false, is_hub: false, note: "", franchise_partner_id: "" });
      await load();
    }
    setSaving(false);
  }

  const visible = items.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q) || (p.address ?? "").toLowerCase().includes(q);
  });

  if (loading) return <div className="p-8 text-center text-gray-400"><Loader2 className="mx-auto animate-spin" size={24} /></div>;

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
            <Building2 size={22} /> Pakomāti
          </h1>
          <p className="text-sm text-gray-500">{items.length} lokācijas</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => load()} className="btn-outline text-xs flex items-center gap-1"><RefreshCw size={12} /> Atsvaidzināt</button>
          <button onClick={() => setShowAdd(!showAdd)} className="btn-primary text-xs flex items-center gap-1"><Plus size={12} /> Pievienot</button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4 relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Meklēt pakomātu..." className="input pl-9 w-full max-w-sm" />
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="mb-4 rounded-xl border border-brand-200 bg-brand-50/50 p-5 space-y-3">
          <p className="text-sm font-bold text-gray-900">Jauns pakomāts</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <input value={newPak.code} onChange={e => setNewPak(p => ({ ...p, code: e.target.value }))} placeholder="Kods *" className="input text-sm" />
            <input value={newPak.name} onChange={e => setNewPak(p => ({ ...p, name: e.target.value }))} placeholder="Nosaukums *" className="input text-sm" />
            <input value={newPak.address} onChange={e => setNewPak(p => ({ ...p, address: e.target.value }))} placeholder="Adrese" className="input text-sm" />
            <input value={newPak.postal_code} onChange={e => setNewPak(p => ({ ...p, postal_code: e.target.value }))} placeholder="Pasta indekss" className="input text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <input value={newPak.lat} onChange={e => setNewPak(p => ({ ...p, lat: e.target.value }))} placeholder="Lat" className="input text-sm" />
            <input value={newPak.lng} onChange={e => setNewPak(p => ({ ...p, lng: e.target.value }))} placeholder="Lng" className="input text-sm" />
            <select value={newPak.franchise_partner_id} onChange={e => setNewPak(p => ({ ...p, franchise_partner_id: e.target.value }))} className="input text-sm">
              <option value="">Nav partnera (IziPizi)</option>
              {partners.map(fp => <option key={fp.id} value={fp.id}>{fp.company_name}</option>)}
            </select>
            <select value={newPak.status} onChange={e => setNewPak(p => ({ ...p, status: e.target.value }))} className="input text-sm">
              <option value="aktivs">Aktīvs</option>
              <option value="serviss">Serviss</option>
              <option value="neaktivs">Neaktīvs</option>
            </select>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={newPak.has_warehouse} onChange={e => setNewPak(p => ({ ...p, has_warehouse: e.target.checked }))} /> Noliktava</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={newPak.is_hub} onChange={e => setNewPak(p => ({ ...p, is_hub: e.target.checked }))} /> Hub</label>
          </div>
          <textarea value={newPak.note} onChange={e => setNewPak(p => ({ ...p, note: e.target.value }))} placeholder="Piezīme" className="input text-sm w-full" rows={2} />
          <div className="flex gap-2">
            <button onClick={addPakomats} disabled={!newPak.code || !newPak.name || saving} className="btn-primary text-xs">{saving ? "Saglabā..." : "Pievienot"}</button>
            <button onClick={() => setShowAdd(false)} className="btn-outline text-xs">Atcelt</button>
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map(p => {
          const isOpen = expanded === p.id;
          const isEdit = editing === p.id;
          const comps = p.compartments ?? [];
          const bySize = { M: 0, L: 0, XL: 0 } as Record<string, number>;
          const occupied = { M: 0, L: 0, XL: 0 } as Record<string, number>;
          comps.forEach(c => { bySize[c.size] = (bySize[c.size] ?? 0) + 1; if (c.status === "aiznemts" || c.status === "rezervets") occupied[c.size] = (occupied[c.size] ?? 0) + 1; });

          return (
            <div key={p.id} className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
              {/* Header */}
              <div className={`px-4 py-3 ${p.status === "aktivs" ? "bg-[#192635]" : p.status === "serviss" ? "bg-amber-700" : "bg-gray-400"} text-white`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm truncate">{p.name}</h3>
                  <span className="text-[10px] font-mono opacity-70">{p.code}</span>
                </div>
                {p.address && <p className="text-[11px] opacity-70 mt-0.5 truncate">{p.address}</p>}
              </div>

              {/* Summary */}
              <div className="px-4 py-3">
                <div className="flex items-center gap-3 text-xs flex-wrap">
                  {/* Compartment summary */}
                  {Object.entries(bySize).filter(([, v]) => v > 0).map(([size, total]) => (
                    <span key={size} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 font-semibold">
                      {size}: {occupied[size]}/{total}
                    </span>
                  ))}
                  {comps.length === 0 && <span className="text-gray-400">Nav nodalījumu</span>}
                </div>

                <div className="mt-2 flex items-center gap-2 text-[11px] text-gray-500 flex-wrap">
                  {p.has_warehouse && <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-amber-700 font-semibold"><Warehouse size={10} /> Noliktava</span>}
                  {p.is_hub && <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-violet-700 font-semibold"><MapPin size={10} /> Hub</span>}
                  {p.partner_name ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-brand-700 font-semibold"><Handshake size={10} /> {p.partner_name}</span>
                  ) : (
                    <span className="text-gray-400">IziPizi</span>
                  )}
                </div>

                {/* Compartment grid visual */}
                {comps.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {comps.map(c => {
                      const cls = COMP_STATUS_COLORS[c.status] ?? COMP_STATUS_COLORS.brivs;
                      const temp = TEMP_ICONS[c.temp_mode];
                      return (
                        <div key={c.id} title={`${c.code} · ${c.size} · ${temp?.label ?? c.temp_mode} · ${c.status}`}
                          className={`w-8 h-8 rounded border text-[8px] font-bold flex flex-col items-center justify-center ${cls}`}>
                          <span>{c.size}</span>
                          {temp && <temp.icon size={8} className={temp.cls} />}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Expand/Edit */}
                <div className="mt-3 flex gap-1">
                  <button onClick={() => setExpanded(isOpen ? null : p.id)} className="text-[11px] text-gray-500 hover:text-gray-700 flex items-center gap-1">
                    {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />} {isOpen ? "Aizvērt" : "Detaļas"}
                  </button>
                  <button onClick={() => { setEditing(isEdit ? null : p.id); setEditData({ franchise_partner_id: p.franchise_partner_id ?? "", has_warehouse: p.has_warehouse, is_hub: p.is_hub, status: p.status, note: p.note ?? "" }); }}
                    className="text-[11px] text-brand-600 hover:text-brand-700 flex items-center gap-1 ml-auto">
                    <Edit2 size={10} /> Labot
                  </button>
                </div>
              </div>

              {/* Edit form */}
              {isEdit && (
                <div className="border-t border-gray-50 px-4 py-3 space-y-2 bg-gray-50/50">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-semibold text-gray-500">Partneris</label>
                      <select value={editData.franchise_partner_id ?? ""} onChange={e => setEditData(d => ({ ...d, franchise_partner_id: e.target.value }))} className="input text-xs w-full">
                        <option value="">Nav (IziPizi)</option>
                        {partners.map(fp => <option key={fp.id} value={fp.id}>{fp.company_name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-gray-500">Statuss</label>
                      <select value={editData.status ?? "aktivs"} onChange={e => setEditData(d => ({ ...d, status: e.target.value }))} className="input text-xs w-full">
                        <option value="aktivs">Aktīvs</option>
                        <option value="serviss">Serviss</option>
                        <option value="neaktivs">Neaktīvs</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-4 text-xs">
                    <label className="flex items-center gap-1"><input type="checkbox" checked={editData.has_warehouse ?? false} onChange={e => setEditData(d => ({ ...d, has_warehouse: e.target.checked }))} /> Noliktava</label>
                    <label className="flex items-center gap-1"><input type="checkbox" checked={editData.is_hub ?? false} onChange={e => setEditData(d => ({ ...d, is_hub: e.target.checked }))} /> Hub</label>
                  </div>
                  <textarea value={editData.note ?? ""} onChange={e => setEditData(d => ({ ...d, note: e.target.value }))} placeholder="Piezīme" className="input text-xs w-full" rows={2} />
                  <div className="flex gap-2">
                    <button onClick={() => savePakomats(p.id)} disabled={saving} className="btn-primary text-[11px] flex items-center gap-1"><Save size={10} /> {saving ? "..." : "Saglabāt"}</button>
                    <button onClick={() => setEditing(null)} className="btn-outline text-[11px]">Atcelt</button>
                  </div>
                </div>
              )}

              {/* Expanded details */}
              {isOpen && !isEdit && (
                <div className="border-t border-gray-50 px-4 py-3 text-xs space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div><span className="text-gray-500">Lat:</span> {p.lat ?? "—"}</div>
                    <div><span className="text-gray-500">Lng:</span> {p.lng ?? "—"}</div>
                    <div><span className="text-gray-500">Indekss:</span> {p.postal_code ?? "—"}</div>
                    <div><span className="text-gray-500">Izveidots:</span> {new Date(p.created_at).toLocaleDateString("lv-LV")}</div>
                  </div>
                  {p.note && <p className="text-gray-500 italic">{p.note}</p>}

                  {/* Compartments table */}
                  {comps.length > 0 && (
                    <div>
                      <p className="font-bold text-gray-700 mt-2 mb-1">Nodalījumi ({comps.length})</p>
                      <div className="rounded border border-gray-100 overflow-hidden">
                        <table className="w-full text-[11px]">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-2 py-1 text-left font-semibold text-gray-600">Kods</th>
                              <th className="px-2 py-1 text-left font-semibold text-gray-600">Izmērs</th>
                              <th className="px-2 py-1 text-left font-semibold text-gray-600">Režīms</th>
                              <th className="px-2 py-1 text-left font-semibold text-gray-600">Statuss</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {comps.map(c => {
                              const temp = TEMP_ICONS[c.temp_mode];
                              return (
                                <tr key={c.id}>
                                  <td className="px-2 py-1 font-mono">{c.code}</td>
                                  <td className="px-2 py-1 font-bold">{c.size}</td>
                                  <td className="px-2 py-1">{temp ? <span className={`flex items-center gap-1 ${temp.cls}`}><temp.icon size={10} /> {temp.label}</span> : c.temp_mode}</td>
                                  <td className="px-2 py-1"><span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${COMP_STATUS_COLORS[c.status] ?? ""}`}>{c.status}</span></td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {visible.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-12 text-center">
          <p className="text-gray-400">Nav atrasts neviens pakomāts</p>
        </div>
      )}
    </div>
  );
}
