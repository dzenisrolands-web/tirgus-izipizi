"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Package, Search, Trash2, Loader2, Eye, EyeOff, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatPrice } from "@/lib/utils";
import { cn } from "@/lib/utils";

type Listing = {
  id: string;
  title: string;
  price: number;
  unit: string;
  category: string;
  image_url: string;
  status: "active" | "paused" | "sold_out";
  storage_type: "frozen" | "chilled" | "ambient" | null;
  created_at: string;
  sellers: { name: string } | null;
};

const statusLabel = {
  active:   { label: "Aktīvs",    cls: "bg-green-100 text-green-700" },
  paused:   { label: "Pauzēts",   cls: "bg-gray-100 text-gray-500" },
  sold_out: { label: "Izpārdots", cls: "bg-red-100 text-red-600" },
};

const storageLabel = {
  frozen:  { label: "-18°C",        cls: "bg-blue-50 text-blue-700 border border-blue-200" },
  chilled: { label: "+2°C – +6°C",  cls: "bg-cyan-50 text-cyan-700 border border-cyan-200" },
  ambient: { label: "Istabas t°",   cls: "bg-gray-100 text-gray-600 border border-gray-200" },
};

type TempFilter = "all" | "frozen" | "chilled" | "ambient";

export default function AdminProduktisPage() {
  const [items, setItems] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tempFilter, setTempFilter] = useState<TempFilter>("all");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("listings")
      .select("id,title,price,unit,category,image_url,status,storage_type,created_at,seller_id")
      .order("storage_type", { ascending: true })
      .then(async ({ data, error }) => {
        if (error) { console.error(error); setLoading(false); return; }
        const listings = data ?? [];
        const sellerIds = [...new Set(listings.map((l: any) => l.seller_id).filter(Boolean))];
        let sellerMap: Record<string, string> = {};
        if (sellerIds.length > 0) {
          const { data: sData } = await supabase.from("sellers").select("id,name").in("id", sellerIds);
          for (const s of sData ?? []) sellerMap[s.id] = s.name;
        }
        setItems(listings.map((l: any) => ({
          ...l,
          sellers: sellerMap[l.seller_id] ? { name: sellerMap[l.seller_id] } : null,
        })));
        setLoading(false);
      });
  }, []);

  const counts = {
    all:     items.length,
    frozen:  items.filter(i => i.storage_type === "frozen").length,
    chilled: items.filter(i => i.storage_type === "chilled").length,
    ambient: items.filter(i => i.storage_type === "ambient").length,
  };

  async function toggleStatus(item: Listing) {
    const next = item.status === "active" ? "paused" : "active";
    await supabase.from("listings").update({ status: next }).eq("id", item.id);
    setItems(p => p.map(i => i.id === item.id ? { ...i, status: next } : i));
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    await supabase.from("listings").delete().eq("id", id);
    setItems(p => p.filter(i => i.id !== id));
    setDeleting(null);
    setConfirmDelete(null);
  }

  const visible = items.filter(i => {
    const matchTemp = tempFilter === "all" || i.storage_type === tempFilter;
    const matchSearch = i.title.toLowerCase().includes(search.toLowerCase()) ||
      (i.sellers?.name ?? "").toLowerCase().includes(search.toLowerCase());
    return matchTemp && matchSearch;
  });

  if (loading) return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900">Visi produkti</h1>
        <p className="mt-0.5 text-sm text-gray-500">{items.length} kopā</p>
      </div>

      {/* Temperatūras filtri */}
      <div className="mb-5 flex flex-wrap gap-2">
        {([
          { key: "all",     label: `Visi (${counts.all})`,              cls: "bg-gray-900 text-white",                               inactiveCls: "bg-gray-100 text-gray-600 hover:bg-gray-200" },
          { key: "frozen",  label: `❄ Saldēti -18°C (${counts.frozen})`, cls: "bg-blue-600 text-white",                              inactiveCls: "bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100" },
          { key: "chilled", label: `Dzesēti +2°C–+6°C (${counts.chilled})`, cls: "bg-cyan-600 text-white",                          inactiveCls: "bg-cyan-50 text-cyan-700 border border-cyan-200 hover:bg-cyan-100" },
          { key: "ambient", label: `Istabas t° (${counts.ambient})`,    cls: "bg-gray-500 text-white",                               inactiveCls: "bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200" },
        ] as const).map(f => (
          <button key={f.key} onClick={() => setTempFilter(f.key)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${tempFilter === f.key ? f.cls : f.inactiveCls}`}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="mb-5 relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Meklēt produktu vai ražotāju..."
          className="input pl-9 w-full max-w-sm"
        />
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-12 text-center">
          <Package size={36} className="mx-auto text-gray-300" />
          <p className="mt-3 text-gray-400">Nav atrasts neviens produkts</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          <div className="divide-y divide-gray-50">
            {visible.map(item => {
              const st = statusLabel[item.status];
              return (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition">
                  <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                    {item.image_url ? (
                      <Image src={item.image_url} alt={item.title} fill className="object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Package size={16} className="text-gray-300" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900">{item.title}</p>
                    <p className="text-xs text-gray-400">{item.sellers?.name ?? "—"} · {item.category}</p>
                  </div>
                  <select
                    value={item.storage_type ?? "chilled"}
                    onChange={async (e) => {
                      const val = e.target.value as "frozen" | "chilled" | "ambient";
                      await supabase.from("listings").update({ storage_type: val }).eq("id", item.id);
                      setItems(p => p.map(i => i.id === item.id ? { ...i, storage_type: val } : i));
                    }}
                    className={cn(
                      "cursor-pointer rounded-lg px-2 py-1 text-xs font-semibold shrink-0 border outline-none",
                      item.storage_type === "frozen"  ? "bg-blue-50 text-blue-700 border-blue-300" :
                      item.storage_type === "ambient" ? "bg-gray-100 text-gray-600 border-gray-300" :
                                                        "bg-cyan-50 text-cyan-700 border-cyan-300"
                    )}
                  >
                    <option value="frozen">❄ -18°C</option>
                    <option value="chilled">🌡 +2°C – +6°C</option>
                    <option value="ambient">📦 Istabas t°</option>
                  </select>
                  <span className="hidden md:block text-sm font-bold text-gray-900 shrink-0">
                    {formatPrice(item.price)}
                  </span>
                  <span className={cn("hidden md:inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold shrink-0", st.cls)}>
                    {st.label}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => toggleStatus(item)} title={item.status === "active" ? "Pauzēt" : "Aktivizēt"}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition">
                      {item.status === "active" ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                    {confirmDelete === item.id ? (
                      <div className="flex items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-2 py-1">
                        <span className="text-xs font-medium text-red-700 mr-1">Dzēst?</span>
                        <button onClick={() => handleDelete(item.id)} disabled={deleting === item.id}
                          className="flex h-6 w-6 items-center justify-center rounded-lg bg-red-500 text-white hover:bg-red-600 transition disabled:opacity-40">
                          {deleting === item.id ? <Loader2 size={11} className="animate-spin" /> : <span className="text-xs font-bold">Jā</span>}
                        </button>
                        <button onClick={() => setConfirmDelete(null)}
                          className="flex h-6 w-6 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-200 transition">
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmDelete(item.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
