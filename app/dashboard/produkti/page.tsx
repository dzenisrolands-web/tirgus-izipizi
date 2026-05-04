"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Plus, Pencil, Trash2, Loader2, Package, Eye, EyeOff, AlertTriangle, X, Star, Clock, CheckCircle } from "lucide-react";
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

type FeaturedEntry = {
  id: string;
  listing_id: string;
  status: "pending" | "active" | "rejected" | "expired";
  starts_at: string;
  ends_at: string;
};

function nextWeeks(count: number): { starts_at: string; ends_at: string; label: string }[] {
  const now = new Date();
  const day = now.getDay() || 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - day + 1 + 7); // next Monday
  const out = [];
  const m = ["jan", "feb", "mar", "apr", "mai", "jūn", "jūl", "aug", "sep", "okt", "nov", "dec"];
  for (let i = 0; i < count; i++) {
    const start = new Date(monday); start.setDate(monday.getDate() + i * 7);
    const end = new Date(start); end.setDate(start.getDate() + 6);
    out.push({
      starts_at: start.toISOString().split("T")[0],
      ends_at: end.toISOString().split("T")[0],
      label: `${start.getDate()}. ${m[start.getMonth()]} – ${end.getDate()}. ${m[end.getMonth()]}`,
    });
  }
  return out;
}

const statusLabel: Record<string, { label: string; cls: string }> = {
  active:         { label: "Aktīvs",             cls: "bg-green-100 text-green-700" },
  paused:         { label: "Pauzēts",             cls: "bg-gray-100 text-gray-500" },
  sold_out:       { label: "Izpārdots",           cls: "bg-red-100 text-red-600" },
  pending_review: { label: "Gaida apstiprinājumu",cls: "bg-amber-100 text-amber-700" },
  rejected:       { label: "Noraidīts",           cls: "bg-red-100 text-red-700" },
};

export default function ProduktisPage() {
  const [items, setItems] = useState<Listing[]>([]);
  const [featured, setFeatured] = useState<FeaturedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [featuredModal, setFeaturedModal] = useState<Listing | null>(null);
  const [submittingFeatured, setSubmittingFeatured] = useState(false);

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

    const listingIds = (data ?? []).map((d) => d.id);
    if (listingIds.length > 0) {
      const today = new Date().toISOString().split("T")[0];
      const { data: f } = await supabase
        .from("weekly_featured")
        .select("id, listing_id, status, starts_at, ends_at")
        .in("listing_id", listingIds)
        .gte("ends_at", today);
      setFeatured((f as FeaturedEntry[] | null) ?? []);
    }

    setLoading(false);
  }

  function getFeaturedFor(listingId: string): FeaturedEntry | undefined {
    return featured.find((f) => f.listing_id === listingId && (f.status === "active" || f.status === "pending"));
  }

  async function applyForFeatured(listing: Listing, week: { starts_at: string; ends_at: string }) {
    setSubmittingFeatured(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: seller } = await supabase
      .from("sellers")
      .select("id")
      .eq("user_id", user?.id ?? "")
      .single();
    const { error } = await supabase.from("weekly_featured").insert({
      listing_id: listing.id,
      seller_id: seller?.id ?? null,
      position: 1, // admin assigns final position
      starts_at: week.starts_at,
      ends_at: week.ends_at,
      status: "pending",
    });
    setSubmittingFeatured(false);
    if (error) {
      alert(`Kļūda: ${error.message}`);
      return;
    }
    setFeaturedModal(null);
    await load();
  }

  useEffect(() => { load(); }, []);

  async function toggleStatus(item: Listing) {
    if (item.status !== "active" && item.status !== "paused") return;
    const next = item.status === "active" ? "paused" : "active";
    // Block activation when price is missing — the public catalog would
    // show €0.00 which is broken UX. Send the seller to the edit page.
    if (next === "active" && (!item.price || item.price === 0)) {
      alert("Lai aktivizētu produktu, vispirms norādi cenu (lielāku par 0 €).");
      return;
    }
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

      {/* Missing-price banner — blocking. These products are auto-paused; the
          seller must set a price before they can be activated again. */}
      {items.some(i => !i.price || i.price === 0) && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-600" />
          <div className="flex-1 text-sm text-red-800">
            <strong>Cena nav norādīta:</strong>{" "}
            {items.filter(i => !i.price || i.price === 0).map(i => i.title).join(", ")}
            {" "}— šie produkti ir pauzēti un netiek rādīti pircējiem. Atver
            produktu, ievadi cenu un saglabā, lai aktivizētu.
          </div>
        </div>
      )}

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
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-gray-900">{item.title}</p>
                      {(!item.price || item.price === 0) && (
                        <Link
                          href={`/dashboard/produkti/${item.id}`}
                          className="inline-flex items-center gap-1 rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-700 hover:bg-red-200"
                          title="Cena nav norādīta — klikšķini lai labotu"
                        >
                          <AlertTriangle size={9} /> Cena!
                        </Link>
                      )}
                      {(() => {
                        const f = getFeaturedFor(item.id);
                        if (!f) return null;
                        if (f.status === "active") return (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700" title="Šobrīd Nedēļas piedāvājumā">
                            <Star size={9} fill="currentColor" /> Nedēļa
                          </span>
                        );
                        return (
                          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-1.5 py-0.5 text-[9px] font-bold text-gray-600" title="Pieteikts, gaida apstiprinājumu">
                            <Clock size={9} /> Gaida
                          </span>
                        );
                      })()}
                    </div>
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
                        {item.status === "active" && !getFeaturedFor(item.id) && (
                          <button onClick={() => setFeaturedModal(item)} title="Pieteikt nedēļas piedāvājumam"
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-amber-50 hover:text-amber-600 transition">
                            <Star size={15} />
                          </button>
                        )}
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

      {/* Featured weekly modal */}
      {featuredModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setFeaturedModal(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
                <Star size={20} className="text-amber-600" fill="currentColor" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900">Pieteikt Nedēļas piedāvājumam</h3>
                <p className="mt-0.5 text-sm text-gray-500 truncate">{featuredModal.title}</p>
              </div>
            </div>
            <p className="mt-4 text-xs text-gray-600 leading-relaxed">
              Tavs produkts parādīsies sākumlapā <strong>"Nedēļas piedāvājums"</strong> sekcijā.
              Admins apstiprina pieteikumus pēc kārtības — tev paziņos, kad apstiprināts.
              <br /><br />
              Izvēlies, kuru nedēļu vēlies pieteikt:
            </p>
            <div className="mt-4 space-y-2">
              {nextWeeks(4).map((w) => (
                <button
                  key={w.starts_at}
                  onClick={() => applyForFeatured(featuredModal, w)}
                  disabled={submittingFeatured}
                  className="flex w-full items-center justify-between rounded-xl border border-gray-200 px-3 py-2.5 text-left text-sm hover:border-amber-400 hover:bg-amber-50 transition disabled:opacity-50"
                >
                  <span className="font-semibold text-gray-900">{w.label}</span>
                  <span className="text-xs text-amber-600 font-bold">Pieteikt →</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setFeaturedModal(null)}
              className="mt-4 w-full rounded-lg py-2 text-sm text-gray-500 hover:bg-gray-50"
            >
              Atcelt
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
