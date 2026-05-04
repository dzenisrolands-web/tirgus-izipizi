"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  CheckCircle, XCircle, Clock, AlertCircle, Search, Home, Plus, X, FileText, AlertTriangle,
  Package, ShoppingBag, ExternalLink, MessageSquare, ChevronDown, ChevronUp, Mail, Loader2,
  LinkIcon, Send,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Seller = {
  id: string;
  user_id: string | null;
  email: string | null;
  name: string;
  description: string | null;
  location: string | null;
  status: "draft" | "pending" | "approved" | "rejected";
  created_at: string;
  home_locker_ids: string[] | null;
  legal_name: string | null;
  registration_number: string | null;
  is_vat_registered: boolean | null;
  vat_number: string | null;
  legal_address: string | null;
  bank_name: string | null;
  bank_iban: string | null;
  bank_swift: string | null;
  self_billing_agreed: boolean | null;
  self_billing_agreed_at: string | null;
  self_billing_agreement_version: string | null;
  rejected_reason: string | null;
  rejected_at: string | null;
  approved_at: string | null;
};

type SellerStats = {
  totalProducts: number;
  pendingProducts: number;
  approvedProducts: number;
  totalOrders: number;
  revenueCents: number;
  lastActivityAt: string | null;
};

type ListingRow = { seller_id: string; status: string; updated_at: string };
type OrderRow = { seller_ids: string[] | null; payment_status: string; total_cents: number; created_at: string };

const statusMap = {
  draft:    { label: "Melnraksts",   cls: "bg-gray-100 text-gray-500" },
  pending:  { label: "Gaida",        cls: "bg-amber-100 text-amber-700" },
  approved: { label: "Apstiprināts", cls: "bg-green-100 text-green-700" },
  rejected: { label: "Noraidīts",    cls: "bg-red-100 text-red-600" },
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
  const [listings, setListings] = useState<ListingRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [search, setSearch] = useState("");
  const [expandedLocker, setExpandedLocker] = useState<string | null>(null);
  const [expandedLegal, setExpandedLegal] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<{ id: string; name: string } | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [reminderSending, setReminderSending] = useState<string | null>(null);
  const [reminderResult, setReminderResult] = useState<{ id: string; ok: boolean; msg: string } | null>(null);
  const [linkInputs, setLinkInputs] = useState<Record<string, string>>({});
  const [linking, setLinking] = useState<string | null>(null);
  const [linkResult, setLinkResult] = useState<{ id: string; ok: boolean; msg: string } | null>(null);

  async function load() {
    const [sellersRes, listingsRes, ordersRes] = await Promise.all([
      supabase.from("sellers").select("*").order("created_at", { ascending: false }),
      supabase.from("listings").select("seller_id, status, updated_at"),
      supabase.from("orders").select("seller_ids, payment_status, total_cents, created_at"),
    ]);
    setSellers((sellersRes.data as Seller[] | null) ?? []);
    setListings((listingsRes.data as ListingRow[] | null) ?? []);
    setOrders((ordersRes.data as OrderRow[] | null) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  // Compute stats per seller
  const statsBySellerId = useMemo(() => {
    const m = new Map<string, SellerStats>();
    for (const s of sellers) {
      m.set(s.id, {
        totalProducts: 0, pendingProducts: 0, approvedProducts: 0,
        totalOrders: 0, revenueCents: 0, lastActivityAt: null,
      });
    }
    for (const l of listings) {
      if (!l.seller_id) continue;
      const stat = m.get(l.seller_id);
      if (!stat) continue;
      stat.totalProducts++;
      if (l.status === "pending") stat.pendingProducts++;
      if (l.status === "active" || l.status === "approved") stat.approvedProducts++;
      if (l.updated_at && (!stat.lastActivityAt || l.updated_at > stat.lastActivityAt)) {
        stat.lastActivityAt = l.updated_at;
      }
    }
    for (const o of orders) {
      if (o.payment_status !== "paid") continue;
      const ids = o.seller_ids ?? [];
      const sharePerSeller = ids.length > 0 ? (o.total_cents / ids.length) : 0;
      for (const sellerId of ids) {
        const stat = m.get(sellerId);
        if (!stat) continue;
        stat.totalOrders++;
        stat.revenueCents += sharePerSeller;
        if (o.created_at && (!stat.lastActivityAt || o.created_at > stat.lastActivityAt)) {
          stat.lastActivityAt = o.created_at;
        }
      }
    }
    return m;
  }, [sellers, listings, orders]);

  function onboardingChecklist(s: Seller) {
    return [
      { label: "Profils", done: !!s.name && !!s.description },
      { label: "Juridiskā info", done: !!s.legal_name && !!s.registration_number },
      { label: "IBAN", done: !!s.bank_iban },
      { label: "Self-billing", done: !!s.self_billing_agreed },
      { label: "1. produkts", done: (statsBySellerId.get(s.id)?.totalProducts ?? 0) > 0 },
    ];
  }

  async function approveSeller(id: string) {
    const now = new Date().toISOString();
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("sellers").update({
      status: "approved",
      approved_at: now,
      approved_by: user?.id ?? null,
      rejected_reason: null,
      rejected_at: null,
    }).eq("id", id);
    const seller = sellers.find(s => s.id === id);
    if (seller?.user_id) {
      await supabase.from("profiles").update({ role: "seller" }).eq("id", seller.user_id);
    }
    setSellers(p => p.map(s => s.id === id
      ? { ...s, status: "approved", approved_at: now, rejected_reason: null, rejected_at: null }
      : s
    ));
  }

  async function rejectSellerWithReason() {
    if (!rejectModal) return;
    const id = rejectModal.id;
    const now = new Date().toISOString();
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("sellers").update({
      status: "rejected",
      rejected_reason: rejectReason || null,
      rejected_at: now,
      rejected_by: user?.id ?? null,
    }).eq("id", id);
    const seller = sellers.find(s => s.id === id);
    if (seller?.user_id) {
      await supabase.from("profiles").update({ role: "buyer" }).eq("id", seller.user_id);
    }
    setSellers(p => p.map(s => s.id === id
      ? { ...s, status: "rejected", rejected_reason: rejectReason || null, rejected_at: now }
      : s
    ));
    setRejectModal(null);
    setRejectReason("");
  }

  async function sendReminder(sellerId: string) {
    setReminderSending(sellerId);
    setReminderResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch("/api/notify/seller-reminder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ sellerId }),
      });
      const data = await res.json();
      if (data.ok && data.sent) {
        setReminderResult({ id: sellerId, ok: true, msg: `E-pasts nosūtīts (${data.missing.length} trūkstošie lauki)` });
      } else if (data.ok && !data.sent) {
        setReminderResult({ id: sellerId, ok: true, msg: "Nekas nav trūkst — pārdevējam viss aizpildīts" });
      } else {
        setReminderResult({ id: sellerId, ok: false, msg: data.error ?? "Nezināma kļūda" });
      }
    } catch (e) {
      setReminderResult({ id: sellerId, ok: false, msg: e instanceof Error ? e.message : "Tīkla kļūda" });
    }
    setReminderSending(null);
    setTimeout(() => setReminderResult(null), 5000);
  }

  async function linkSeller(sellerId: string) {
    const email = (linkInputs[sellerId] ?? "").trim();
    if (!email) return;
    setLinking(sellerId);
    setLinkResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch("/api/admin/link-seller", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ sellerId, email }),
      });
      const data = await res.json();
      if (data.ok) {
        const msg = data.mode === "existing-user"
          ? `Saistīts ar esošu kontu (${email})`
          : data.mode === "invited"
            ? `Invite e-pasts nosūtīts uz ${email} — pirmajā ielogošanās brīdī tiks automātiski piesaistīts`
            : `OK (${data.mode})`;
        setLinkResult({ id: sellerId, ok: true, msg });
        // Refresh sellers list to reflect new email/user_id
        await load();
      } else {
        setLinkResult({ id: sellerId, ok: false, msg: data.error ?? "Nezināma kļūda" });
      }
    } catch (e) {
      setLinkResult({ id: sellerId, ok: false, msg: e instanceof Error ? e.message : "Tīkla kļūda" });
    }
    setLinking(null);
    setTimeout(() => setLinkResult(null), 6000);
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
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
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
        <div className="space-y-3">
          {visible.map(seller => {
            const st = statusMap[seller.status];
            const homeLockers = seller.home_locker_ids ?? [];
            const stats = statsBySellerId.get(seller.id);
            const checklist = onboardingChecklist(seller);
            const completed = checklist.filter(c => c.done).length;
            const isLockerOpen = expandedLocker === seller.id;
            const isLegalOpen = expandedLegal === seller.id;
            return (
              <div key={seller.id} className="rounded-2xl border border-gray-100 bg-white shadow-sm">

                {/* Top row */}
                <div className="flex items-center justify-between gap-4 px-5 py-4">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                      seller.status === "pending" ? "bg-amber-100 text-amber-700" :
                      seller.status === "approved" ? "bg-green-100 text-green-700" :
                      seller.status === "rejected" ? "bg-red-100 text-red-600" :
                      "bg-gray-100 text-gray-500"
                    }`}>
                      {seller.status === "pending" ? <AlertCircle size={15} /> :
                       seller.status === "approved" ? <CheckCircle size={15} /> :
                       seller.status === "rejected" ? <XCircle size={15} /> :
                       <Clock size={15} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-900 truncate">{seller.name}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${st.cls}`}>
                          {st.label}
                        </span>
                        <Link href={`/seller/${seller.id}`} target="_blank" rel="noopener"
                          className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2 py-0.5 text-[10px] font-semibold text-gray-500 hover:bg-gray-100 transition"
                          title="Atvērt publisko profilu">
                          <ExternalLink size={9} /> profils
                        </Link>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {seller.location ?? "—"} · reģ. {new Date(seller.created_at).toLocaleDateString("lv-LV")}
                        {stats?.lastActivityAt && (
                          <> · pēd. aktivitāte {new Date(stats.lastActivityAt).toLocaleDateString("lv-LV")}</>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => setExpandedLegal(isLegalOpen ? null : seller.id)}
                      className={`flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition ${
                        seller.self_billing_agreed
                          ? "bg-green-50 text-green-700 hover:bg-green-100"
                          : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                      }`}
                      title={seller.self_billing_agreed ? "Juridiskā info aizpildīta" : "Juridiskā info nav aizpildīta"}
                    >
                      {seller.self_billing_agreed ? <FileText size={11} /> : <AlertTriangle size={11} />}
                    </button>
                    <button
                      onClick={() => setExpandedLocker(isLockerOpen ? null : seller.id)}
                      className={`flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition ${
                        homeLockers.length > 0
                          ? "bg-brand-50 text-brand-700 hover:bg-brand-100"
                          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      }`}
                      title="Mājas pakomāti"
                    >
                      <Home size={11} />
                      {homeLockers.length > 0 ? homeLockers.length : <Plus size={10} />}
                    </button>
                    {seller.status === "pending" && (
                      <>
                        <button onClick={() => approveSeller(seller.id)}
                          className="flex items-center gap-1 rounded-lg bg-green-50 px-2.5 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-100 transition">
                          <CheckCircle size={11} /> Apstiprināt
                        </button>
                        <button onClick={() => setRejectModal({ id: seller.id, name: seller.name })}
                          className="flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 transition">
                          <XCircle size={11} /> Noraidīt
                        </button>
                      </>
                    )}
                    {seller.status === "approved" && (
                      <button onClick={() => setRejectModal({ id: seller.id, name: seller.name })}
                        className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 transition">
                        Noraidīt
                      </button>
                    )}
                    {seller.status === "rejected" && (
                      <button onClick={() => approveSeller(seller.id)}
                        className="rounded-lg bg-green-50 px-2.5 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-100 transition">
                        Apstiprināt
                      </button>
                    )}
                  </div>
                </div>

                {/* Stats row */}
                {stats && (
                  <div className="flex flex-wrap items-center gap-3 border-t border-gray-50 bg-gray-50/40 px-5 py-2.5 text-xs">
                    <div className="flex items-center gap-1.5">
                      <Package size={12} className="text-gray-400" />
                      <span className="text-gray-500">Produkti:</span>
                      <span className="font-bold text-gray-900">{stats.totalProducts}</span>
                      {stats.pendingProducts > 0 && (
                        <Link
                          href={`/admin/produkti?seller=${encodeURIComponent(seller.id)}&status=pending`}
                          className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 hover:bg-amber-200 transition"
                          title="Gaida apstiprinājumu — klikšķini, lai apskatītu"
                        >
                          {stats.pendingProducts} gaida →
                        </Link>
                      )}
                    </div>
                    <span className="text-gray-200">·</span>
                    <div className="flex items-center gap-1.5">
                      <ShoppingBag size={12} className="text-gray-400" />
                      <span className="text-gray-500">Pasūtījumi:</span>
                      <span className="font-bold text-gray-900">{stats.totalOrders}</span>
                    </div>
                    <span className="text-gray-200">·</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-gray-500">Apgrozījums:</span>
                      <span className="font-bold text-gray-900">
                        {(stats.revenueCents / 100).toFixed(2)} €
                      </span>
                    </div>

                    {/* Onboarding checklist */}
                    <div className="ml-auto flex items-center gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                        Onboarding {completed}/{checklist.length}
                      </span>
                      <div className="flex gap-0.5">
                        {checklist.map((c, i) => (
                          <span
                            key={i}
                            title={`${c.label}: ${c.done ? "✓ Izdarīts" : "✗ Trūkst"}`}
                            className={`flex h-4 w-4 items-center justify-center rounded text-[9px] font-bold ${
                              c.done
                                ? "bg-green-500 text-white"
                                : "bg-gray-200 text-gray-400"
                            }`}
                          >
                            {c.done ? "✓" : ""}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Auth link form — sellers without auth user_id need
                    an email so they can log in and the trigger from
                    migration 0022 can attach this row to their account. */}
                {!seller.user_id && (
                  <div className="border-t border-gray-50 bg-blue-50/60 px-5 py-3 text-xs">
                    <div className="flex items-start gap-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-200 text-blue-700">
                        <LinkIcon size={13} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-blue-900">Nav saistīts ar lietotāja kontu</p>
                        <p className="mt-0.5 text-[11px] text-blue-800">
                          Šis ražotājs ir importēts no vecās lapas un vēl nav reģistrējies tirgus.izipizi.lv. Ievadi viņa e-pastu — sistēma sūtīs magic-link, un pirmajā ielogošanās brīdī šis profils tiks automātiski piesaistīts.
                        </p>
                        {seller.email && (
                          <p className="mt-1 text-[11px] text-blue-700">
                            Pašreizējais e-pasts: <span className="font-mono font-bold">{seller.email}</span> — vēl gaida pirmo ielogošanos.
                          </p>
                        )}
                        <div className="mt-2 flex gap-2">
                          <input
                            type="email"
                            placeholder={seller.email ?? "razotajs@example.com"}
                            value={linkInputs[seller.id] ?? ""}
                            onChange={(e) => setLinkInputs((prev) => ({ ...prev, [seller.id]: e.target.value }))}
                            disabled={linking === seller.id}
                            className="flex-1 rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-300"
                          />
                          <button
                            onClick={() => linkSeller(seller.id)}
                            disabled={linking === seller.id || !(linkInputs[seller.id] ?? "").trim()}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-blue-700 transition disabled:opacity-50"
                          >
                            {linking === seller.id
                              ? <Loader2 size={11} className="animate-spin" />
                              : <Send size={11} />}
                            {seller.email ? "Pārsūtīt invite" : "Saistīt + sūtīt invite"}
                          </button>
                        </div>
                        {linkResult && linkResult.id === seller.id && (
                          <div className={`mt-2 rounded-lg px-2.5 py-1.5 text-[11px] ${
                            linkResult.ok ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700"
                          }`}>
                            {linkResult.ok ? "✓ " : "✗ "}{linkResult.msg}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Onboarding checklist details (visible when something missing) */}
                {checklist.some(c => !c.done) && (
                  <div className="border-t border-gray-50 bg-amber-50/40 px-5 py-2 text-xs flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <span className="text-gray-500">Trūkst: </span>
                      {checklist.filter(c => !c.done).map((c, i, arr) => (
                        <span key={c.label} className="font-semibold text-amber-800">
                          {c.label}{i < arr.length - 1 ? ", " : ""}
                        </span>
                      ))}
                    </div>
                    <button
                      onClick={() => sendReminder(seller.id)}
                      disabled={reminderSending === seller.id}
                      className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold text-amber-800 hover:bg-amber-200 transition disabled:opacity-50"
                      title="Sūtīt e-pasta atgādinājumu pārdevējam"
                    >
                      {reminderSending === seller.id ? <Loader2 size={11} className="animate-spin" /> : <Mail size={11} />}
                      {reminderSending === seller.id ? "Sūta..." : "Sūtīt atgādinājumu"}
                    </button>
                  </div>
                )}

                {/* Reminder result toast */}
                {reminderResult && reminderResult.id === seller.id && (
                  <div className={`border-t border-gray-50 px-5 py-2 text-xs ${
                    reminderResult.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"
                  }`}>
                    {reminderResult.ok ? "✓ " : "✗ "}{reminderResult.msg}
                  </div>
                )}

                {/* Rejection reason notice */}
                {seller.status === "rejected" && seller.rejected_reason && (
                  <div className="border-t border-gray-50 bg-red-50/50 px-5 py-2.5 text-xs">
                    <div className="flex items-start gap-2">
                      <MessageSquare size={12} className="mt-0.5 shrink-0 text-red-500" />
                      <div>
                        <p className="font-semibold text-red-800">
                          Noraidīts {seller.rejected_at ? `· ${new Date(seller.rejected_at).toLocaleDateString("lv-LV")}` : ""}
                        </p>
                        <p className="text-red-600 mt-0.5">{seller.rejected_reason}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Legal info expanded */}
                {isLegalOpen && (
                  <div className="border-t border-gray-50 bg-gray-50 px-5 py-3 text-xs">
                    <p className="mb-2 font-semibold text-gray-500 uppercase tracking-wider">Juridiskā informācija</p>
                    <div className="grid gap-1.5 sm:grid-cols-2">
                      <div><span className="text-gray-400">Juridiskais nosaukums:</span> <span className="font-medium text-gray-900">{seller.legal_name ?? "—"}</span></div>
                      <div><span className="text-gray-400">Reģ. Nr.:</span> <span className="font-mono text-gray-900">{seller.registration_number ?? "—"}</span></div>
                      <div><span className="text-gray-400">PVN maksātājs:</span> <span className="font-medium text-gray-900">{seller.is_vat_registered ? "Jā" : "Nē"}</span></div>
                      <div><span className="text-gray-400">PVN reģ. Nr.:</span> <span className="font-mono text-gray-900">{seller.vat_number ?? "—"}</span></div>
                      <div className="sm:col-span-2"><span className="text-gray-400">Adrese:</span> <span className="text-gray-900 whitespace-pre-line">{seller.legal_address ?? "—"}</span></div>
                      <div><span className="text-gray-400">Banka:</span> <span className="text-gray-900">{seller.bank_name ?? "—"}</span></div>
                      <div><span className="text-gray-400">IBAN:</span> <span className="font-mono text-gray-900">{seller.bank_iban ?? "—"}</span></div>
                      {seller.bank_swift && <div><span className="text-gray-400">SWIFT:</span> <span className="font-mono text-gray-900">{seller.bank_swift}</span></div>}
                    </div>
                    <div className={`mt-3 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold ${
                      seller.self_billing_agreed
                        ? "bg-green-100 text-green-700"
                        : "bg-amber-100 text-amber-700"
                    }`}>
                      {seller.self_billing_agreed ? <CheckCircle size={11} /> : <AlertTriangle size={11} />}
                      {seller.self_billing_agreed
                        ? `Self-billing pieņemts (v${seller.self_billing_agreement_version ?? "?"}, ${seller.self_billing_agreed_at ? new Date(seller.self_billing_agreed_at).toLocaleDateString("lv-LV") : "?"})`
                        : "Self-billing vēl nav pieņemts — bez tā nevar izrakstīt rēķinus"}
                    </div>
                  </div>
                )}

                {/* Home locker expanded */}
                {isLockerOpen && (
                  <div className="border-t border-gray-50 bg-white px-5 py-3">
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
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => { setRejectModal(null); setRejectReason(""); }}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
                <XCircle size={20} className="text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900">Noraidīt ražotāju</h3>
                <p className="mt-0.5 text-sm text-gray-500">{rejectModal.name}</p>
              </div>
            </div>
            <label className="mt-5 block text-xs font-semibold text-gray-700">
              Noraidījuma iemesls <span className="text-gray-400">(redzēs pārdevējs)</span>
            </label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Piem., trūkst PVN reģistrācijas numurs, dokumenti neatbilst prasībām..."
              rows={4}
              className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-red-400 focus:outline-none"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => { setRejectModal(null); setRejectReason(""); }}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 transition"
              >
                Atcelt
              </button>
              <button
                onClick={rejectSellerWithReason}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 transition"
              >
                Noraidīt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
