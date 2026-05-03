"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  Star, Calendar, Plus, X, Search, CheckCircle, Clock, AlertCircle, Trash2, ArrowRight, ArrowLeft,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatPrice } from "@/lib/utils";

type WeeklyEntry = {
  id: string;
  listing_id: string;
  seller_id: string | null;
  position: number;
  starts_at: string;
  ends_at: string;
  status: "pending" | "active" | "rejected" | "expired";
  applied_at: string;
  approved_at: string | null;
  notes: string | null;
};

type ListingLite = {
  id: string;
  title: string;
  price: number;
  unit: string;
  image_url: string;
  seller_id: string;
  seller_name: string;
  status: string;
};

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  pending:  { label: "Gaida",        cls: "bg-amber-100 text-amber-700" },
  active:   { label: "Aktīvs",       cls: "bg-green-100 text-green-700" },
  rejected: { label: "Noraidīts",    cls: "bg-red-100 text-red-600" },
  expired:  { label: "Beidzies",     cls: "bg-gray-100 text-gray-500" },
};

// Get this week's Monday and Sunday in YYYY-MM-DD
function weekRange(offsetWeeks = 0): { starts_at: string; ends_at: string } {
  const now = new Date();
  const day = now.getDay() || 7; // Sunday → 7
  const monday = new Date(now);
  monday.setDate(now.getDate() - day + 1 + offsetWeeks * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    starts_at: monday.toISOString().split("T")[0],
    ends_at: sunday.toISOString().split("T")[0],
  };
}

function formatWeek(starts: string, ends: string): string {
  const s = new Date(starts);
  const e = new Date(ends);
  const m = ["jan", "feb", "mar", "apr", "mai", "jūn", "jūl", "aug", "sep", "okt", "nov", "dec"];
  return `${s.getDate()}. ${m[s.getMonth()]} – ${e.getDate()}. ${m[e.getMonth()]}`;
}

export default function AdminNedelasPiedavajumsPage() {
  const [entries, setEntries] = useState<WeeklyEntry[]>([]);
  const [listings, setListings] = useState<ListingLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0); // 0 = this week, 1 = next, -1 = last
  const [pickerSlot, setPickerSlot] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const week = weekRange(weekOffset);

  async function load() {
    const [entriesRes, listingsRes] = await Promise.all([
      supabase.from("weekly_featured").select("*").order("starts_at", { ascending: false }),
      supabase
        .from("listings")
        .select("id, title, price, unit, image_url, seller_id, status")
        .eq("status", "active")
        .order("created_at", { ascending: false }),
    ]);
    const entriesData = (entriesRes.data as WeeklyEntry[] | null) ?? [];
    setEntries(entriesData);

    const rows = (listingsRes.data ?? []) as Array<{ id: string; title: string; price: number; unit: string; image_url: string; seller_id: string; status: string }>;
    const sellerIds = [...new Set(rows.map((r) => r.seller_id).filter(Boolean))];
    let sellerNames: Record<string, string> = {};
    if (sellerIds.length > 0) {
      const { data } = await supabase.from("sellers").select("id, name").in("id", sellerIds);
      sellerNames = Object.fromEntries((data ?? []).map((s) => [s.id, s.name]));
    }
    setListings(rows.map((r) => ({ ...r, seller_name: sellerNames[r.seller_id] ?? "—" })));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  // Get entries for current week
  const weekEntries = entries.filter(
    (e) => e.starts_at === week.starts_at && (e.status === "active" || e.status === "pending")
  );

  // Pending applications waiting for approval
  const pendingApps = entries.filter((e) => e.status === "pending");

  // Slots 1-7 — null if empty
  const slots: (WeeklyEntry | null)[] = Array.from({ length: 7 }, (_, i) => {
    return weekEntries.find((e) => e.position === i + 1) ?? null;
  });

  function getListing(id: string): ListingLite | undefined {
    return listings.find((l) => l.id === id);
  }

  async function pickListing(listing: ListingLite) {
    if (pickerSlot === null) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("weekly_featured").insert({
      listing_id: listing.id,
      seller_id: listing.seller_id,
      position: pickerSlot,
      starts_at: week.starts_at,
      ends_at: week.ends_at,
      status: "active",
      approved_at: new Date().toISOString(),
      approved_by: user?.id ?? null,
    });
    if (error) {
      alert(`Kļūda: ${error.message}`);
      return;
    }
    setPickerSlot(null);
    setSearch("");
    load();
  }

  async function removeSlot(entryId: string) {
    if (!confirm("Noņemt no nedēļas piedāvājuma?")) return;
    await supabase.from("weekly_featured").delete().eq("id", entryId);
    load();
  }

  async function approve(entryId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("weekly_featured").update({
      status: "active",
      approved_at: new Date().toISOString(),
      approved_by: user?.id ?? null,
    }).eq("id", entryId);
    load();
  }

  async function reject(entryId: string) {
    await supabase.from("weekly_featured").update({ status: "rejected" }).eq("id", entryId);
    load();
  }

  // Filter listings for picker (exclude already-featured this week + match search)
  const featuredIds = new Set(weekEntries.map((e) => e.listing_id));
  const filteredListings = listings.filter((l) => {
    if (featuredIds.has(l.id)) return false;
    const q = search.toLowerCase();
    return !q || l.title.toLowerCase().includes(q) || l.seller_name.toLowerCase().includes(q);
  });

  if (loading) return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold text-gray-900">
            <Star size={22} className="text-amber-600" fill="currentColor" />
            Nedēļas piedāvājums
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            7 sloti uz nedēļu · parādās sākumlapā
          </p>
        </div>
        {pendingApps.length > 0 && (
          <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5">
            <AlertCircle size={16} className="text-amber-600" />
            <span className="text-sm font-semibold text-amber-800">
              {pendingApps.length} pieteikum{pendingApps.length === 1 ? "s" : "i"} gaida
            </span>
          </div>
        )}
      </div>

      {/* Week navigation */}
      <div className="mb-6 flex items-center justify-between rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
        <button
          onClick={() => setWeekOffset((o) => o - 1)}
          className="flex items-center gap-1 rounded-full px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
        >
          <ArrowLeft size={14} /> Iepriekšējā
        </button>
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
            {weekOffset === 0 ? "Šonedēļ" : weekOffset > 0 ? `+${weekOffset} nedēļas` : `${weekOffset} nedēļas atpakaļ`}
          </p>
          <p className="font-bold text-gray-900">
            {formatWeek(week.starts_at, week.ends_at)}
          </p>
        </div>
        <button
          onClick={() => setWeekOffset((o) => o + 1)}
          className="flex items-center gap-1 rounded-full px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
        >
          Nākamā <ArrowRight size={14} />
        </button>
      </div>

      {/* Slots grid */}
      <div className="mb-8">
        <p className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-500">7 sloti</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {slots.map((slot, i) => {
            const position = i + 1;
            if (!slot) {
              return (
                <button
                  key={position}
                  onClick={() => setPickerSlot(position)}
                  className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 p-6 text-gray-400 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 transition min-h-[200px]"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm font-bold text-gray-400">
                    {position}
                  </div>
                  <Plus size={18} />
                  <span className="text-xs font-semibold">Pievienot produktu</span>
                </button>
              );
            }
            const listing = getListing(slot.listing_id);
            const status = STATUS_LABELS[slot.status];
            return (
              <div key={slot.id} className="relative flex flex-col gap-2 rounded-2xl border-2 border-amber-200 bg-white p-3 shadow-sm">
                <div className="absolute -top-2 -left-2 flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 text-xs font-extrabold text-amber-900 shadow ring-2 ring-white">
                  {position}
                </div>
                <span className={`absolute -top-2 right-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${status.cls}`}>
                  {status.label}
                </span>
                {listing ? (
                  <>
                    <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-gray-100">
                      {listing.image_url && (
                        <Image src={listing.image_url} alt={listing.title} fill className="object-cover" />
                      )}
                    </div>
                    <p className="font-semibold text-sm text-gray-900 line-clamp-2">{listing.title}</p>
                    <p className="text-xs text-gray-500 truncate">{listing.seller_name}</p>
                    <p className="text-sm font-bold text-brand-700">{formatPrice(listing.price)}</p>
                  </>
                ) : (
                  <p className="text-xs text-gray-400">Produkts nav atrasts</p>
                )}
                <div className="flex gap-1">
                  {slot.status === "pending" && (
                    <button
                      onClick={() => approve(slot.id)}
                      className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-green-50 px-2 py-1.5 text-xs font-bold text-green-700 hover:bg-green-100"
                    >
                      <CheckCircle size={11} /> Apstiprināt
                    </button>
                  )}
                  <button
                    onClick={() => removeSlot(slot.id)}
                    className="flex items-center justify-center gap-1 rounded-lg bg-red-50 px-2 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pending applications across all weeks */}
      {pendingApps.length > 0 && (
        <div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-amber-800">
            <Clock size={14} /> Gaidošie pieteikumi visās nedēļās
          </h2>
          <div className="space-y-2">
            {pendingApps.map((app) => {
              const listing = getListing(app.listing_id);
              return (
                <div key={app.id} className="flex items-center gap-3 rounded-xl bg-white p-3">
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                    {listing?.image_url && (
                      <Image src={listing.image_url} alt={listing.title} fill className="object-cover" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900">
                      {listing?.title ?? "—"}
                    </p>
                    <p className="text-xs text-gray-500">
                      {listing?.seller_name ?? "—"} · pos. {app.position} · {formatWeek(app.starts_at, app.ends_at)}
                    </p>
                  </div>
                  <button
                    onClick={() => approve(app.id)}
                    className="rounded-lg bg-green-50 px-2.5 py-1.5 text-xs font-bold text-green-700 hover:bg-green-100"
                  >
                    Apstiprināt
                  </button>
                  <button
                    onClick={() => reject(app.id)}
                    className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100"
                  >
                    Noraidīt
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Listing picker modal */}
      {pickerSlot !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setPickerSlot(null)}>
          <div className="w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-2xl bg-white shadow-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-100 p-4">
              <div>
                <h3 className="font-bold text-gray-900">Izvēlies produktu pozīcijai {pickerSlot}</h3>
                <p className="text-xs text-gray-500">{formatWeek(week.starts_at, week.ends_at)}</p>
              </div>
              <button onClick={() => setPickerSlot(null)} className="rounded-lg p-1.5 hover:bg-gray-100">
                <X size={16} />
              </button>
            </div>
            <div className="border-b border-gray-100 p-4">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Meklēt produktu..."
                  className="input w-full pl-9"
                  autoFocus
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {filteredListings.length === 0 ? (
                <p className="p-8 text-center text-sm text-gray-400">Nav atrasts neviens produkts</p>
              ) : (
                filteredListings.slice(0, 50).map((l) => (
                  <button
                    key={l.id}
                    onClick={() => pickListing(l)}
                    className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-gray-50"
                  >
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                      {l.image_url && <Image src={l.image_url} alt={l.title} fill className="object-cover" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">{l.title}</p>
                      <p className="text-xs text-gray-500">{l.seller_name}</p>
                    </div>
                    <span className="font-mono text-sm font-bold text-gray-700">{formatPrice(l.price)}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
