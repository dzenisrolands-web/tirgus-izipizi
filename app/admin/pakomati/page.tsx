"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Building2, Plus, Search, RefreshCw, ChevronDown, ChevronUp,
  Thermometer, Wifi, WifiOff, Warehouse, MapPin, Clock, Edit2,
  Save, X, Loader2, Handshake, Package, Snowflake, AlertTriangle,
  Image, BoxIcon,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Compartment = {
  id: string;
  code: string;
  size: string;
  temp_mode: string;
  status: string;
};

type FranchiseShare = {
  id: string;
  pakomats_id: string;
  partner_id: string;
  shares_pct: number;
  price_paid: number | null;
  note: string | null;
  purchased_at: string;
  partner_name?: string;
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
  image_url: string | null;
  capabilities: string[];
  working_hours: string | null;
  description: string | null;
  total_shares: number;
  share_price_eur: number;
  revenue_split_pct: number;
  compartment_config: Record<string, number> | null;
  created_at: string;
  // joined
  partner_name?: string;
  compartments?: Compartment[];
  shares?: FranchiseShare[];
  sold_pct?: number;
  free_pct?: number;
};

const CAPABILITIES = [
  { key: "noliktava_dzeseta", label: "Noliktava +6°C", icon: "🌡️", cls: "bg-blue-50 text-blue-700" },
  { key: "noliktava_saldetava", label: "Noliktava −18°C", icon: "❄️", cls: "bg-violet-50 text-violet-700" },
  { key: "komplektesana", label: "Komplektēšana", icon: "📦", cls: "bg-amber-50 text-amber-700" },
  { key: "pasiznemsana", label: "Pašizņemšana", icon: "🛒", cls: "bg-green-50 text-green-700" },
];

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
  const [newComp, setNewComp] = useState({ code: "", size: "M", temp_mode: "atdzesets" });
  const [addingComp, setAddingComp] = useState<string | null>(null);
  const [addingShare, setAddingShare] = useState<string | null>(null);
  const [newShare, setNewShare] = useState({ partner_id: "", shares_pct: "10", price_paid: "" });

  const load = useCallback(async () => {
    const sb = izpClient();
    const [pakRes, partRes, compRes] = await Promise.all([
      sb.from("pakomati").select("*").order("name"),
      sb.from("franchise_partners").select("id, company_name"),
      sb.from("compartments").select("*"),
    ]);
    // franchise_shares may not exist yet — fetch separately with error handling
    let sharesData: FranchiseShare[] = [];
    try {
      const sharesRes = await sb.from("franchise_shares").select("*");
      sharesData = (sharesRes.data ?? []) as FranchiseShare[];
    } catch { /* table may not exist */ }

    const partnerMap = new Map((partRes.data ?? []).map((fp: Partner) => [fp.id, fp.company_name]));

    const paks: Pakomats[] = (pakRes.data ?? []).map((p: Pakomats) => {
      const pakShares = sharesData.filter((s) => s.pakomats_id === p.id)
        .map((s) => ({ ...s, partner_name: partnerMap.get(s.partner_id) ?? "?" }));
      const soldPct = pakShares.reduce((sum, s) => sum + Number(s.shares_pct), 0);
      const totalShares = Number(p.total_shares) || 100;
      return {
        ...p,
        compartments: (compRes.data ?? []).filter((c: Compartment & { pakomats_id: string }) => c.pakomats_id === p.id),
        partner_name: partnerMap.get(p.franchise_partner_id ?? "") ?? null,
        shares: pakShares,
        sold_pct: soldPct,
        free_pct: totalShares - soldPct,
      };
    });
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

  async function addCompartment(pakId: string) {
    setSaving(true);
    const sb = izpClient();
    const { error } = await sb.from("compartments").insert({ pakomats_id: pakId, ...newComp });
    if (error) alert("K\u013c\u016bda: " + error.message);
    else { setNewComp({ code: "", size: "M", temp_mode: "atdzesets" }); setAddingComp(null); await load(); }
    setSaving(false);
  }

  async function deleteCompartment(compId: string) {
    if (!confirm("Dz\u0113st nodal\u012bjumu?")) return;
    const sb = izpClient();
    const { error } = await sb.from("compartments").delete().eq("id", compId);
    if (error) alert("K\u013c\u016bda: " + error.message);
    else await load();
  }

  async function addShare(pakId: string) {
    if (!newShare.partner_id || !newShare.shares_pct) return;
    setSaving(true);
    const sb = izpClient();
    const { error } = await sb.from("franchise_shares").insert({
      pakomats_id: pakId,
      partner_id: newShare.partner_id,
      shares_pct: parseFloat(newShare.shares_pct),
      price_paid: newShare.price_paid ? parseFloat(newShare.price_paid) : null,
    });
    if (error) alert("K\u013c\u016bda: " + error.message);
    else { setNewShare({ partner_id: "", shares_pct: "10", price_paid: "" }); setAddingShare(null); await load(); }
    setSaving(false);
  }

  async function deleteShare(shareId: string) {
    if (!confirm("No\u0146emt partnera da\u013cas?")) return;
    const sb = izpClient();
    const { error } = await sb.from("franchise_shares").delete().eq("id", shareId);
    if (error) alert("K\u013c\u016bda: " + error.message);
    else await load();
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
              {/* Header with image */}
              {p.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.image_url} alt={p.name} className="w-full h-28 object-cover" />
              )}
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
                  {(p.capabilities ?? []).map(cap => {
                    const c = CAPABILITIES.find(x => x.key === cap);
                    return c ? <span key={cap} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${c.cls}`}>{c.icon} {c.label}</span> : null;
                  })}
                  {p.partner_name ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-brand-700 font-semibold"><Handshake size={10} /> {p.partner_name}</span>
                  ) : (
                    <span className="text-gray-400">IziPizi</span>
                  )}
                </div>

                {/* Franchise shares bar */}
                {(p.total_shares ?? 100) > 0 && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[10px] font-semibold mb-1">
                      <span className="text-gray-500"><Handshake size={10} className="inline" /> Franšīzes daļas</span>
                      <span className={p.free_pct === 0 ? "text-red-500" : "text-green-600"}>
                        {p.sold_pct ?? 0}% pārdots · {p.free_pct ?? 100}% brīvs
                      </span>
                    </div>
                    <div className="h-3 rounded-full bg-gray-100 overflow-hidden flex">
                      {(p.shares ?? []).map((s, i) => (
                        <div key={s.id} title={`${s.partner_name}: ${s.shares_pct}%`}
                          style={{ width: `${s.shares_pct}%` }}
                          className={`h-full ${i % 2 === 0 ? "bg-brand-400" : "bg-violet-400"}`} />
                      ))}
                      <div style={{ width: `${Math.max(0, 100 - (p.sold_pct ?? 0))}%` }} className="h-full bg-gray-200" />
                    </div>
                    {(p.shares ?? []).length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {(p.shares ?? []).map(s => (
                          <span key={s.id} className="text-[9px] font-semibold text-gray-500">
                            {s.partner_name} {s.shares_pct}%
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

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
                  <button onClick={() => { setEditing(isEdit ? null : p.id); setEditData({ franchise_partner_id: p.franchise_partner_id ?? "", has_warehouse: p.has_warehouse, is_hub: p.is_hub, status: p.status, note: p.note ?? "", image_url: p.image_url ?? "", capabilities: p.capabilities ?? [], working_hours: p.working_hours ?? "00:00–24:00", description: p.description ?? "", share_price_eur: p.share_price_eur ?? 400, revenue_split_pct: p.revenue_split_pct ?? 50 }); }}
                    className="text-[11px] text-brand-600 hover:text-brand-700 flex items-center gap-1 ml-auto">
                    <Edit2 size={10} /> Labot
                  </button>
                </div>
              </div>

              {/* Edit form */}
              {isEdit && (
                <div className="border-t border-gray-50 px-4 py-3 space-y-3 bg-gray-50/50">
                  {/* Image */}
                  <div>
                    <label className="text-[10px] font-semibold text-gray-500 flex items-center gap-1"><Image size={10} /> Bilde (URL)</label>
                    <input value={editData.image_url ?? ""} onChange={e => setEditData(d => ({ ...d, image_url: e.target.value }))} placeholder="https://..." className="input text-xs w-full mt-1" />
                    {editData.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={editData.image_url} alt="" className="mt-2 h-20 w-full rounded-lg object-cover border border-gray-200" />
                    )}
                  </div>

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

                  <div>
                    <label className="text-[10px] font-semibold text-gray-500">Darba laiks</label>
                    <input value={editData.working_hours ?? "00:00–24:00"} onChange={e => setEditData(d => ({ ...d, working_hours: e.target.value }))} className="input text-xs w-full mt-1" />
                  </div>

                  {/* Capabilities */}
                  <div>
                    <label className="text-[10px] font-semibold text-gray-500 mb-1 block">Iespējas</label>
                    <div className="flex flex-wrap gap-2">
                      {CAPABILITIES.map(cap => {
                        const active = (editData.capabilities ?? []).includes(cap.key);
                        return (
                          <button key={cap.key} type="button"
                            onClick={() => setEditData(d => {
                              const cur = d.capabilities ?? [];
                              return { ...d, capabilities: active ? cur.filter(c => c !== cap.key) : [...cur, cap.key] };
                            })}
                            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold border transition ${
                              active ? `${cap.cls} border-current` : "bg-white text-gray-400 border-gray-200 hover:border-gray-300"
                            }`}
                          >
                            {cap.icon} {cap.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Franšīzes konfigurācija */}
                  <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3 space-y-2">
                    <p className="text-[10px] font-semibold text-violet-700"><Handshake size={10} className="inline" /> Franšīzes iestatījumi</p>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[9px] text-gray-500">Daļu cena (€/1%)</label>
                        <input type="number" value={editData.share_price_eur ?? 400} onChange={e => setEditData(d => ({ ...d, share_price_eur: parseFloat(e.target.value) || 400 }))} className="input text-xs w-full mt-0.5" />
                      </div>
                      <div>
                        <label className="text-[9px] text-gray-500">Ieņ. dalījums (%)</label>
                        <input type="number" value={editData.revenue_split_pct ?? 50} onChange={e => setEditData(d => ({ ...d, revenue_split_pct: parseFloat(e.target.value) || 50 }))} className="input text-xs w-full mt-0.5" />
                      </div>
                      <div>
                        <label className="text-[9px] text-gray-500">50% cena</label>
                        <p className="text-xs font-bold text-violet-700 mt-1">{((editData.share_price_eur ?? 400) * 50).toLocaleString()} €</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4 text-xs">
                    <label className="flex items-center gap-1"><input type="checkbox" checked={editData.has_warehouse ?? false} onChange={e => setEditData(d => ({ ...d, has_warehouse: e.target.checked }))} /> Noliktava</label>
                    <label className="flex items-center gap-1"><input type="checkbox" checked={editData.is_hub ?? false} onChange={e => setEditData(d => ({ ...d, is_hub: e.target.checked }))} /> Hub</label>
                  </div>

                  <textarea value={editData.description ?? ""} onChange={e => setEditData(d => ({ ...d, description: e.target.value }))} placeholder="Apraksts (publisks)" className="input text-xs w-full" rows={2} />
                  <textarea value={editData.note ?? ""} onChange={e => setEditData(d => ({ ...d, note: e.target.value }))} placeholder="Iekšēja piezīme (tikai admin)" className="input text-xs w-full" rows={2} />

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

                  {/* Franchise shares */}
                  <div>
                    <div className="flex items-center justify-between mt-2 mb-1">
                      <p className="font-bold text-violet-700"><Handshake size={11} className="inline" /> Franšīzes daļas ({p.sold_pct ?? 0}% pārdots)</p>
                      <button onClick={() => setAddingShare(addingShare === p.id ? null : p.id)} className="text-[10px] text-violet-600 font-semibold flex items-center gap-1"><Plus size={10} /> Pievienot partneri</button>
                    </div>
                    {addingShare === p.id && (
                      <div className="flex gap-2 mb-2 items-end flex-wrap">
                        <select value={newShare.partner_id} onChange={e => setNewShare(s => ({ ...s, partner_id: e.target.value }))} className="input text-[11px] flex-1 min-w-[120px]">
                          <option value="">Izvēlies partneri...</option>
                          {partners.map(fp => <option key={fp.id} value={fp.id}>{fp.company_name}</option>)}
                        </select>
                        <input type="number" value={newShare.shares_pct} onChange={e => setNewShare(s => ({ ...s, shares_pct: e.target.value }))} placeholder="%" className="input text-[11px] w-16" />
                        <input type="number" value={newShare.price_paid} onChange={e => setNewShare(s => ({ ...s, price_paid: e.target.value }))} placeholder="€ samaksāts" className="input text-[11px] w-24" />
                        <button onClick={() => addShare(p.id)} disabled={!newShare.partner_id || saving} className="btn-primary text-[10px] px-2 py-1">{saving ? "..." : "+"}</button>
                      </div>
                    )}
                    {(p.shares ?? []).length > 0 ? (
                      <div className="rounded border border-violet-100 overflow-hidden mb-3">
                        <table className="w-full text-[11px]">
                          <thead className="bg-violet-50">
                            <tr>
                              <th className="px-2 py-1 text-left font-semibold text-violet-700">Partneris</th>
                              <th className="px-2 py-1 text-right font-semibold text-violet-700">Daļas</th>
                              <th className="px-2 py-1 text-right font-semibold text-violet-700">Samaksāts</th>
                              <th className="px-2 py-1 w-8"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-violet-50">
                            {(p.shares ?? []).map(s => (
                              <tr key={s.id}>
                                <td className="px-2 py-1 font-semibold">{s.partner_name}</td>
                                <td className="px-2 py-1 text-right font-bold text-violet-700">{s.shares_pct}%</td>
                                <td className="px-2 py-1 text-right">{s.price_paid ? `${s.price_paid.toLocaleString()} €` : "—"}</td>
                                <td className="px-2 py-1"><button onClick={() => deleteShare(s.id)} className="text-red-400 hover:text-red-600"><X size={10} /></button></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-[11px] text-gray-400 mb-3">Nav partneru — 100% IziPizi</p>
                    )}
                  </div>

                  {/* Compartments table + add */}
                  <div>
                    <div className="flex items-center justify-between mt-2 mb-1">
                      <p className="font-bold text-gray-700">Nodalījumi ({comps.length})</p>
                      <button onClick={() => setAddingComp(addingComp === p.id ? null : p.id)} className="text-[10px] text-brand-600 font-semibold flex items-center gap-1"><Plus size={10} /> Pievienot</button>
                    </div>
                    {addingComp === p.id && (
                      <div className="flex gap-2 mb-2 items-end">
                        <input value={newComp.code} onChange={e => setNewComp(c => ({ ...c, code: e.target.value }))} placeholder="Kods (A1)" className="input text-[11px] w-16" />
                        <select value={newComp.size} onChange={e => setNewComp(c => ({ ...c, size: e.target.value }))} className="input text-[11px] w-16">
                          <option value="M">M</option><option value="L">L</option><option value="XL">XL</option>
                        </select>
                        <select value={newComp.temp_mode} onChange={e => setNewComp(c => ({ ...c, temp_mode: e.target.value }))} className="input text-[11px] w-24">
                          <option value="atdzesets">+2…+6°C</option><option value="saldets">−18°C</option><option value="istabas">Istabas</option>
                        </select>
                        <button onClick={() => addCompartment(p.id)} disabled={!newComp.code || saving} className="btn-primary text-[10px] px-2 py-1">{saving ? "..." : "+"}</button>
                      </div>
                    )}
                    {comps.length > 0 && (
                      <div className="rounded border border-gray-100 overflow-hidden">
                        <table className="w-full text-[11px]">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-2 py-1 text-left font-semibold text-gray-600">Kods</th>
                              <th className="px-2 py-1 text-left font-semibold text-gray-600">Izmērs</th>
                              <th className="px-2 py-1 text-left font-semibold text-gray-600">Režīms</th>
                              <th className="px-2 py-1 text-left font-semibold text-gray-600">Statuss</th>
                              <th className="px-2 py-1 w-8"></th>
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
                                  <td className="px-2 py-1"><button onClick={() => deleteCompartment(c.id)} className="text-red-400 hover:text-red-600" title="Dzēst"><X size={10} /></button></td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
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
