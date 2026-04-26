"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Plus, Pencil, Trash2, Loader2, Package, Eye, EyeOff, AlertTriangle, X } from "lucide-react";
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
  quantity: number;
  status: "active" | "paused" | "sold_out" | "pending_review" | "rejected";
  created_at: string;
};

const statusLabel: Record<string, { label: string; cls: string }> = {
  active:         { label: "Aktīvs",             cls: "bg-green-100 text-green-700" },
  paused:         { label: "Pauzēts",             cls: "bg-gray-100 text-gray-500" },
  sold_out:       { label: "Izpārdots",           cls: "bg-red-100 text-red-600" },
  pending_review: { label: "Gaida apstiprinājumu",cls: "bg-amber-100 text-amber-700" },
  rejected:       { label: "Noraidīts",           cls: "bg-red-100 text-red-700" },
};

export default function ProduktisPage() {
  const [items, setItems] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const LOW_STOCK = 3;

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("listings")
      .select("id,title,price,unit,category,image_url,quantity,status,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function toggleStatus(item: Listing) {
    if (item.status !== "active" && item.status !== "paused") return;
    const next = item.status === "active" ? "paused" : "active";
    await supabase.from("listings").update({ status: next }).eq("id", item.id);
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: next } : i));
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    const item = items.find(i => i.id === id);
    // Delete image from storage if it's a Supabase-hosted URL
    if (item?.image_url?.includes("supabase")) {
      const path = item.image_url.split("/product-images/")[1];
      if (path) await supabase.storage.from("product-images").remove([path]);
    }
    await supabase.from("listings").delete().eq("id", id);
    setItems(prev => prev.filter(i => i.id !== id));
    setDeleting(null);
    setConfirmDelete(null);
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Produkti</h1>
          <p className="mt-0.5 text-sm text-gray-500">{items.length} produkti kopā</p>
        </div>
        <Link href="/dashboard/produkti/jauns" className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Pievienot
        </Link>
      </div>

      {/* Low stock banner */}
      {items.some(i => i.quantity <= LOW_STOCK && i.status === "active") && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
          <div className="flex-1 text-sm text-amber-800">
            <strong>Maz krājumu:</strong>{" "}
            {items.filter(i => i.quantity <= LOW_STOCK && i.status === "active").map(i => i.title).join(", ")}
            {" "}— papildini krājumus, lai nepazaudētu pārdošanas iespējas.
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-16 text-center">
          <Package size={40} className="mx-auto text-gray-300" />
          <p className="mt-3 font-semibold text-gray-900">Vēl nav produktu</p>
          <p className="mt-1 text-sm text-gray-500">Pievieno pirmo produktu savam katalogam</p>
          <Link href="/dashboard/produkti/jauns" className="btn-primary mt-5 inline-flex items-center gap-2">
            <Plus size={15} /> Pievienot produktu
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          {/* Table header */}
          <div className="hidden sm:grid grid-cols-[56px_1fr_100px_80px_90px_96px] gap-3 border-b border-gray-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
            <span></span>
            <span>Nosaukums</span>
            <span>Kategorija</span>
            <span className="text-right">Cena</span>
            <span>Statuss</span>
            <span className="text-right">Darbības</span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-gray-50">
            {items.map(item => {
              const st = statusLabel[item.status];
              return (
                <div key={item.id}
                  className="grid grid-cols-[56px_1fr_auto] sm:grid-cols-[56px_1fr_100px_80px_90px_96px] items-center gap-3 px-4 py-3 hover:bg-gray-50 transition">

                  {/* Thumb */}
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                    {item.image_url ? (
                      <Image src={item.image_url} alt={item.title} fill className="object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Package size={18} className="text-gray-300" />
                      </div>
                    )}
                  </div>

                  {/* Title */}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900">{item.title}</p>
                    <p className="text-xs text-gray-400">{item.quantity} gab. · {item.unit}</p>
                    {/* Mobile only: category + price + status */}
                    <div className="mt-1 flex flex-wrap items-center gap-2 sm:hidden">
                      <span className="text-xs text-gray-500">{item.category}</span>
                      <span className="text-xs font-bold text-gray-900">{formatPrice(item.price)}</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", st.cls)}>{st.label}</span>
                    </div>
                  </div>

                  {/* Desktop: category */}
                  <span className="hidden sm:block text-sm text-gray-500 truncate">{item.category}</span>

                  {/* Desktop: price */}
                  <span className="hidden sm:block text-sm font-bold text-gray-900 text-right">{formatPrice(item.price)}</span>

                  {/* Desktop: status */}
                  <span className={cn("hidden sm:inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold w-fit", st.cls)}>
                    {st.label}
                  </span>

                  {/* Low stock badge */}
                  {item.quantity <= LOW_STOCK && item.status === "active" && (
                    <span className="hidden sm:flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                      <AlertTriangle size={10} /> Maz
                    </span>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-1 shrink-0">
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
                      <>
                        {(item.status === "active" || item.status === "paused") && (
                          <button onClick={() => toggleStatus(item)} title={item.status === "active" ? "Pauzēt" : "Aktivizēt"}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition">
                            {item.status === "active" ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                        )}
                        <Link href={`/dashboard/produkti/${item.id}`} title="Rediģēt"
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition">
                          <Pencil size={15} />
                        </Link>
                        <button onClick={() => setConfirmDelete(item.id)} title="Dzēst"
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition">
                          <Trash2 size={15} />
                        </button>
                      </>
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
