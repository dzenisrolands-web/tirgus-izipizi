"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import { Package, Search, Trash2, Loader2, Eye, EyeOff, X, Check, CheckCircle, XCircle, Percent, Edit3, Filter } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatPrice } from "@/lib/utils";
import { cn } from "@/lib/utils";

type Listing = {
  id: string;
  user_id: string;
  title: string;
  price: number;
  unit: string;
  category: string;
  image_url: string;
  status: "active" | "paused" | "sold_out" | "pending_review" | "rejected";
  storage_type: "frozen" | "chilled" | null;
  created_at: string;
  seller_id: string;
  seller_name: string;
  commission_rate: number | null;
  commission_status: "proposed" | "approved" | "rejected" | null;
};

const statusLabel: Record<string, { label: string; cls: string }> = {
  active:         { label: "Aktīvs",              cls: "bg-green-100 text-green-700" },
  paused:         { label: "Pauzēts",              cls: "bg-gray-100 text-gray-500" },
  sold_out:       { label: "Izpārdots",            cls: "bg-red-100 text-red-600" },
  pending_review: { label: "Gaida apstiprinājumu", cls: "bg-amber-100 text-amber-700" },
  rejected:       { label: "Noraidīts",            cls: "bg-red-100 text-red-700" },
};

type Tab = "pending" | "all";

export default function AdminProduktisPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
      </div>
    }>
      <AdminProduktisInner />
    </Suspense>
  );
}

function AdminProduktisInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sellerFilter = searchParams.get("seller");
  const statusFilter = searchParams.get("status");
  const [items, setItems] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>(statusFilter === "pending" ? "pending" : "pending");
  const [acting, setActing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [editingCommission, setEditingCommission] = useState<string | null>(null);
  const [commissionDraft, setCommissionDraft] = useState<string>("");

  useEffect(() => { load(); }, []);

  function clearSellerFilter() {
    router.push("/admin/produkti");
  }

  const filteredSellerName = sellerFilter
    ? items.find((i) => i.seller_id === sellerFilter)?.seller_name ?? "—"
    : null;

  async function load() {
    const { data, error } = await supabase
      .from("listings")
      .select("id,user_id,title,price,unit,category,image_url,status,storage_type,created_at,seller_id,commission_rate,commission_status")
      .order("created_at", { ascending: false });
    if (error) { setLoading(false); return; }

    const rows = data ?? [];
    const sellerIds = [...new Set(rows.map((l) => l.seller_id).filter(Boolean))];
    let sellerMap: Record<string, string> = {};
    if (sellerIds.length > 0) {
      const { data: sData } = await supabase.from("sellers").select("id,name").in("id", sellerIds);
      for (const s of sData ?? []) sellerMap[s.id] = s.name;
    }
    setItems(rows.map((l) => ({ ...l, seller_name: sellerMap[l.seller_id] ?? "—" })));
    setLoading(false);
  }

  async function approve(item: Listing) {
    setActing(item.id);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("listings").update({
      status: "active",
      commission_status: "approved",
      commission_approved_at: new Date().toISOString(),
      commission_approved_by: user?.id ?? null,
    }).eq("id", item.id);
    await supabase.from("notifications").insert({
      user_id: item.user_id,
      title: "Produkts apstiprināts! ✅",
      message: `Jūsu produkts "${item.title}" ir apstiprināts (komisija ${item.commission_rate}%) un tagad ir redzams katalogā.`,
      listing_id: item.id,
    });
    setItems((p) => p.map((i) => i.id === item.id ? { ...i, status: "active", commission_status: "approved" } : i));
    setActing(null);
  }

  async function saveCommissionOverride(item: Listing) {
    const newRate = Number(commissionDraft);
    if (isNaN(newRate) || newRate < 5 || newRate > 20) {
      alert("Likmei jābūt no 5 līdz 20");
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("listings").update({
      commission_rate: newRate,
      commission_status: "approved",
      commission_approved_at: new Date().toISOString(),
      commission_approved_by: user?.id ?? null,
    }).eq("id", item.id);
    setItems((p) => p.map((i) => i.id === item.id ? { ...i, commission_rate: newRate, commission_status: "approved" } : i));
    setEditingCommission(null);
    setCommissionDraft("");
  }

  async function reject(item: Listing) {
    setActing(item.id);
    await supabase.from("listings").update({ status: "rejected" }).eq("id", item.id);
    await supabase.from("notifications").insert({
      user_id: item.user_id,
      title: "Produkts noraidīts",
      message: `Jūsu produkts "${item.title}" diemžēl netika apstiprināts. Labojiet aprakstu un iesniedziet atkārtoti.`,
      listing_id: item.id,
    });
    setItems((p) => p.map((i) => i.id === item.id ? { ...i, status: "rejected" } : i));
    setActing(null);
  }

  async function toggleStatus(item: Listing) {
    if (item.status !== "active" && item.status !== "paused") return;
    const next = item.status === "active" ? "paused" : "active";
    await supabase.from("listings").update({ status: next }).eq("id", item.id);
    setItems((p) => p.map((i) => i.id === item.id ? { ...i, status: next } : i));
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    await supabase.from("listings").delete().eq("id", id);
    setItems((p) => p.filter((i) => i.id !== id));
    setDeleting(null);
    setConfirmDelete(null);
  }

  const sellerScoped = sellerFilter ? items.filter((i) => i.seller_id === sellerFilter) : items;
  const pending = sellerScoped.filter((i) => i.status === "pending_review");
  const visible = (tab === "pending" ? pending : sellerScoped).filter((i) => {
    const q = search.toLowerCase();
    return !q || i.title.toLowerCase().includes(q) || i.seller_name.toLowerCase().includes(q);
  });

  if (loading) return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900">Produkti</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          {sellerFilter
            ? `${sellerScoped.length} no ${items.length} (filtrēts pa ražotāju)`
            : `${items.length} kopā`}
        </p>
      </div>

      {/* Active seller filter banner */}
      {sellerFilter && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-brand-200 bg-brand-50 px-4 py-2.5">
          <div className="flex items-center gap-2 text-sm">
            <Filter size={14} className="text-brand-700" />
            <span className="text-brand-800">Filtrēts pa ražotāju:</span>
            <span className="font-bold text-brand-900">{filteredSellerName}</span>
          </div>
          <button
            onClick={clearSellerFilter}
            className="flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100 transition"
          >
            <X size={11} /> Notīrīt
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-5 flex gap-2">
        <button onClick={() => setTab("pending")}
          className={cn("flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold transition",
            tab === "pending" ? "bg-amber-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>
          Gaida apstiprinājumu
          {pending.length > 0 && (
            <span className={cn("flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold",
              tab === "pending" ? "bg-white text-amber-600" : "bg-amber-500 text-white")}>
              {pending.length}
            </span>
          )}
        </button>
        <button onClick={() => setTab("all")}
          className={cn("rounded-full px-4 py-1.5 text-sm font-semibold transition",
            tab === "all" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>
          Visi ({items.length})
        </button>
      </div>

      {/* Search */}
      <div className="mb-5 relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Meklēt produktu vai ražotāju..."
          className="input pl-9 w-full max-w-sm" />
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-12 text-center">
          <Package size={36} className="mx-auto text-gray-300" />
          <p className="mt-3 text-gray-400">
            {tab === "pending" ? "Nav produktu, kas gaida apstiprinājumu" : "Nav atrasts neviens produkts"}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          <div className="divide-y divide-gray-50">
            {visible.map((item) => {
              const st = statusLabel[item.status] ?? statusLabel.paused;
              const isPending = item.status === "pending_review";
              return (
                <div key={item.id} className={cn("flex items-center gap-3 px-4 py-3 transition",
                  isPending ? "bg-amber-50/50 hover:bg-amber-50" : "hover:bg-gray-50")}>

                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gray-100">
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
                    <p className="text-xs text-gray-400">{item.seller_name} · {item.category} · {formatPrice(item.price)}</p>

                    {/* Commission row */}
                    <div className="mt-1 flex items-center gap-2 text-xs">
                      <Percent size={10} className="text-gray-400" />
                      {editingCommission === item.id ? (
                        <span className="flex items-center gap-1">
                          <input
                            type="number"
                            min="5"
                            max="20"
                            step="0.5"
                            value={commissionDraft}
                            onChange={(e) => setCommissionDraft(e.target.value)}
                            className="w-14 rounded border border-gray-200 px-1.5 py-0.5 text-xs"
                          />
                          <button onClick={() => saveCommissionOverride(item)}
                            className="rounded bg-green-600 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-green-700">
                            OK
                          </button>
                          <button onClick={() => { setEditingCommission(null); setCommissionDraft(""); }}
                            className="text-gray-400 hover:text-gray-600">
                            <X size={11} />
                          </button>
                        </span>
                      ) : (
                        <>
                          <span className="font-mono font-semibold text-gray-700">
                            {item.commission_rate ? `${item.commission_rate}%` : "—"}
                          </span>
                          {item.commission_status === "proposed" && (
                            <span className="rounded-full bg-amber-100 px-1.5 py-0 text-[9px] font-bold text-amber-700">PIEDĀVĀTA</span>
                          )}
                          {item.commission_status === "approved" && (
                            <span className="rounded-full bg-green-100 px-1.5 py-0 text-[9px] font-bold text-green-700">APSTIPR.</span>
                          )}
                          {item.commission_status === "rejected" && (
                            <span className="rounded-full bg-red-100 px-1.5 py-0 text-[9px] font-bold text-red-700">NORAID.</span>
                          )}
                          {item.commission_rate && (
                            <button onClick={() => { setEditingCommission(item.id); setCommissionDraft(String(item.commission_rate)); }}
                              className="text-gray-400 hover:text-gray-700">
                              <Edit3 size={10} />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <span className={cn("hidden sm:inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold shrink-0", st.cls)}>
                    {st.label}
                  </span>

                  <div className="flex items-center gap-1 shrink-0">
                    {isPending ? (
                      <>
                        <button onClick={() => approve(item)} disabled={acting === item.id}
                          className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 transition disabled:opacity-50">
                          {acting === item.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                          Apstiprināt
                        </button>
                        <button onClick={() => reject(item)} disabled={acting === item.id}
                          className="flex items-center gap-1 rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 transition disabled:opacity-50">
                          <X size={12} />
                          Noraidīt
                        </button>
                      </>
                    ) : (
                      <>
                        {(item.status === "active" || item.status === "paused") && (
                          <button onClick={() => toggleStatus(item)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition">
                            {item.status === "active" ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        )}
                        {confirmDelete === item.id ? (
                          <div className="flex items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-2 py-1">
                            <span className="text-xs font-medium text-red-700 mr-1">Dzēst?</span>
                            <button onClick={() => handleDelete(item.id)} disabled={deleting === item.id}
                              className="flex h-6 w-6 items-center justify-center rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-40">
                              {deleting === item.id ? <Loader2 size={11} className="animate-spin" /> : <span className="text-xs font-bold">Jā</span>}
                            </button>
                            <button onClick={() => setConfirmDelete(null)}
                              className="flex h-6 w-6 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-200">
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmDelete(item.id)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition">
                            <Trash2 size={14} />
                          </button>
                        )}
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
