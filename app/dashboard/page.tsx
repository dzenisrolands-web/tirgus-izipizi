"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Package, Plus, ArrowRight, Clock, CheckCircle, AlertCircle, User, X, PartyPopper, FileText, Truck, CreditCard, FileSignature } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatPrice } from "@/lib/utils";

type SellerStatus = "draft" | "pending" | "approved" | "rejected";

type SellerData = {
  name: string | null;
  description: string | null;
  legal_name: string | null;
  registration_number: string | null;
  bank_iban: string | null;
  is_vat_registered: boolean | null;
  vat_number: string | null;
  legal_address: string | null;
  self_billing_agreed: boolean | null;
  home_locker_ids: string[] | null;
  courier_pickup_address: string | null;
};

type MissingItem = {
  key: string;
  label: string;
  desc: string;
  icon: React.ReactNode;
  href: string;
};

function computeMissing(s: SellerData): MissingItem[] {
  const missing: MissingItem[] = [];

  if (!s.description || s.description.length < 20) {
    missing.push({
      key: "description",
      label: "Profila apraksts",
      desc: "Pastāsti par sevi un savu saimniecību (vismaz 20 rakstzīmes)",
      icon: <User size={14} />,
      href: "/dashboard/profils",
    });
  }
  if (!s.legal_name || !s.registration_number) {
    missing.push({
      key: "legal",
      label: "Juridiskā informācija",
      desc: "Juridiskais nosaukums un reģistrācijas numurs",
      icon: <FileText size={14} />,
      href: "/dashboard/profils",
    });
  }
  if (s.is_vat_registered && !s.vat_number) {
    missing.push({
      key: "vat",
      label: "PVN reģistrācijas numurs",
      desc: "Atzīmēts kā PVN maksātājs, bet numurs nav norādīts",
      icon: <FileText size={14} />,
      href: "/dashboard/profils",
    });
  }
  if (!s.bank_iban) {
    missing.push({
      key: "iban",
      label: "Bankas konts (IBAN)",
      desc: "Bez tā nevarēsi saņemt samaksu par pasūtījumiem",
      icon: <CreditCard size={14} />,
      href: "/dashboard/profils",
    });
  }
  if (!s.legal_address) {
    missing.push({
      key: "legal_address",
      label: "Juridiskā adrese",
      desc: "Nepieciešama rēķinu izrakstīšanai",
      icon: <FileText size={14} />,
      href: "/dashboard/profils",
    });
  }
  if (!s.self_billing_agreed) {
    missing.push({
      key: "self_billing",
      label: "Self-billing piekrišana",
      desc: "Bez tās nevaram tavā vārdā izrakstīt rēķinus",
      icon: <FileSignature size={14} />,
      href: "/dashboard/profils",
    });
  }
  const hasLocker = s.home_locker_ids && s.home_locker_ids.length > 0;
  const hasPickup = !!s.courier_pickup_address?.trim();
  if (!hasLocker && !hasPickup) {
    missing.push({
      key: "dropoff",
      label: "Nodošanas vietas",
      desc: "Vismaz viens pakomāts vai kurjera saņemšanas adrese",
      icon: <Truck size={14} />,
      href: "/dashboard/profils",
    });
  }

  return missing;
}

const statusConfig: Record<SellerStatus, { label: string; color: string; icon: React.ReactNode; desc: string }> = {
  draft:    { label: "Nepabeigts",       color: "bg-gray-100 text-gray-600",   icon: <Clock size={14} />,        desc: "Aizpildi profilu un iesniedz apstiprināšanai." },
  pending:  { label: "Gaida apstiprinājumu", color: "bg-amber-100 text-amber-700", icon: <Clock size={14} />,   desc: "Mēs izskatīsim tavu pieteikumu 1–2 darba dienu laikā." },
  approved: { label: "Aktīvs",           color: "bg-green-100 text-green-700", icon: <CheckCircle size={14} />, desc: "Profils ir apstiprināts. Vari pievienot produktus." },
  rejected: { label: "Noraidīts",        color: "bg-red-100 text-red-600",     icon: <AlertCircle size={14} />, desc: "Sazinies ar mums, lai noskaidrotu iemeslu." },
};

type TopProduct = { id: string; title: string; units: number; revenueCents: number };
type ExpiringProduct = { id: string; title: string; freshness_date: string };

export default function DashboardPage() {
  const [status, setStatus] = useState<SellerStatus>("draft");
  const [sellerName, setSellerName] = useState("");
  const [productCount, setProductCount] = useState(0);
  const [missingFields, setMissingFields] = useState<MissingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showApprovedBanner, setShowApprovedBanner] = useState(false);
  // Tier 1 stats — Sa1, Sa2, Sb1, Sb3
  const [monthRevenueCents, setMonthRevenueCents] = useState(0);
  const [monthOrderCount, setMonthOrderCount] = useState(0);
  const [todayOrderCount, setTodayOrderCount] = useState(0);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [expiringSoon, setExpiringSoon] = useState<ExpiringProduct[]>([]);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: seller } = await supabase
        .from("sellers")
        .select("name, farm_name, description, status, legal_name, registration_number, is_vat_registered, vat_number, legal_address, bank_iban, self_billing_agreed, home_locker_ids, courier_pickup_address")
        .eq("user_id", user.id)
        .single();

      if (seller) {
        const newStatus = (seller.status as SellerStatus) ?? "draft";
        setStatus(newStatus);
        setSellerName(seller.farm_name || seller.name || "");
        setMissingFields(computeMissing(seller as SellerData));
        const seenKey = `approved_banner_${user.id}`;
        if (newStatus === "approved" && !sessionStorage.getItem(seenKey)) {
          setShowApprovedBanner(true);
        }

        // Listings owned by this seller (for product count + Sb3 expiring)
        const { data: myListings } = await supabase
          .from("listings")
          .select("id, title, freshness_date, status")
          .eq("seller_id", user.id);
        const listingsArr = myListings ?? [];
        setProductCount(listingsArr.length);

        // Sb3 — expiring within 3 days (active only)
        const threeDaysAhead = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const todayISO = new Date().toISOString().slice(0, 10);
        setExpiringSoon(
          listingsArr
            .filter((l) => l.status === "active" && l.freshness_date && l.freshness_date <= threeDaysAhead && l.freshness_date >= todayISO)
            .sort((a, b) => (a.freshness_date! < b.freshness_date! ? -1 : 1))
            .slice(0, 10)
            .map((l) => ({ id: l.id, title: l.title, freshness_date: l.freshness_date! }))
        );

        // Sa1, Sa2, Sb1 — paid orders in last 30 days, filtered to this seller's items
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const { data: orders } = await supabase
          .from("orders")
          .select("id, items, paid_at, total_cents, created_at")
          .or(`paid_at.gte.${thirtyDaysAgo},and(status.eq.paid,paid_at.is.null)`)
          .order("paid_at", { ascending: false });
        const myListingIds = new Set(listingsArr.map((l) => l.id));
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        let monthRev = 0;
        const monthOrderIds = new Set<string>();
        const todayOrderIds = new Set<string>();
        const productAgg = new Map<string, TopProduct>();

        for (const o of orders ?? []) {
          const orderDate = new Date(o.paid_at ?? o.created_at);
          const items = (o.items as Array<{ id?: string; title?: string; quantity?: number; price?: number }> | null) ?? [];
          let orderHasMyItem = false;
          for (const it of items) {
            if (!it.id || !myListingIds.has(it.id)) continue;
            orderHasMyItem = true;
            const cents = Math.round((it.price ?? 0) * 100) * (it.quantity ?? 1);
            monthRev += cents;
            const cur = productAgg.get(it.id) ?? {
              id: it.id,
              title: it.title ?? listingsArr.find((l) => l.id === it.id)?.title ?? "(nezināms)",
              units: 0,
              revenueCents: 0,
            };
            cur.units += it.quantity ?? 1;
            cur.revenueCents += cents;
            productAgg.set(it.id, cur);
          }
          if (orderHasMyItem) {
            monthOrderIds.add(o.id);
            if (orderDate.getTime() >= todayStart.getTime()) todayOrderIds.add(o.id);
          }
        }

        setMonthRevenueCents(monthRev);
        setMonthOrderCount(monthOrderIds.size);
        setTodayOrderCount(todayOrderIds.size);
        setTopProducts(
          [...productAgg.values()].sort((a, b) => b.units - a.units).slice(0, 5)
        );
      }
      setLoading(false);
    }
    load();
  }, []);

  const st = statusConfig[status];

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      {/* Missing data banner — top priority */}
      {missingFields.length > 0 && status !== "rejected" && (
        <div className="mb-6 rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-200 text-amber-700">
              <AlertCircle size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-amber-900">
                Aizpildi trūkstošo informāciju ({missingFields.length})
              </p>
              <p className="mt-0.5 text-sm text-amber-800">
                Lai mēs varētu apstiprināt tavu profilu un sākt sūtīt pasūtījumus, lūdzu papildini sekojošo:
              </p>
            </div>
          </div>

          <ul className="mt-4 space-y-2">
            {missingFields.map((m) => (
              <li key={m.key}>
                <Link
                  href={m.href}
                  className="flex items-start gap-3 rounded-xl bg-white px-3 py-2.5 ring-1 ring-amber-200 hover:ring-amber-400 transition group"
                >
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                    {m.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 group-hover:text-amber-800">{m.label}</p>
                    <p className="text-xs text-gray-500">{m.desc}</p>
                  </div>
                  <ArrowRight size={14} className="mt-2 shrink-0 text-amber-500" />
                </Link>
              </li>
            ))}
          </ul>

          <p className="mt-3 text-[11px] text-amber-700">
            💡 Saglabā vērtības profilā, kad esi gatavs — informāciju var aizpildīt arī pa daļām.
          </p>
        </div>
      )}

      {/* Approval banner */}
      {showApprovedBanner && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-green-200 bg-green-50 p-4">
          <PartyPopper size={20} className="mt-0.5 shrink-0 text-green-600" />
          <div className="flex-1">
            <p className="font-semibold text-green-900">Apsveicam! Tavs profils ir apstiprināts 🎉</p>
            <p className="mt-0.5 text-sm text-green-700">Tagad vari pievienot produktus un sākt pārdot platformā.</p>
            <Link href="/dashboard/produkti/jauns" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-green-800 hover:underline">
              Pievienot pirmo produktu <ArrowRight size={13} />
            </Link>
          </div>
          <button onClick={() => setShowApprovedBanner(false)}
            className="rounded-lg p-1 text-green-500 hover:bg-green-100">
            <X size={16} />
          </button>
        </div>
      )}
      {/* Greeting */}
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-gray-900">
          Sveiks{sellerName ? `, ${sellerName}` : ""}! 👋
        </h1>
        <p className="mt-1 text-sm text-gray-500">Šeit pārvaldi savu tirgotāja profilu un produktus.</p>
      </div>

      {/* Status card */}
      <div className={`mb-6 flex items-start gap-4 rounded-2xl border p-5 ${
        status === "approved" ? "border-green-200 bg-green-50" :
        status === "pending"  ? "border-amber-200 bg-amber-50" :
        status === "rejected" ? "border-red-200 bg-red-50" :
        "border-gray-200 bg-gray-50"
      }`}>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
          status === "approved" ? "bg-green-100 text-green-600" :
          status === "pending"  ? "bg-amber-100 text-amber-600" :
          status === "rejected" ? "bg-red-100 text-red-500" :
          "bg-gray-200 text-gray-500"
        }`}>
          {st.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900">Profila statuss: <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${st.color}`}>{st.label}</span></p>
          <p className="mt-0.5 text-sm text-gray-600">{st.desc}</p>
          {status === "draft" && (
            <Link href="/dashboard/profils" className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-[#192635] hover:underline">
              Aizpildīt profilu <ArrowRight size={13} />
            </Link>
          )}
        </div>
      </div>

      {/* Quick stats — Sa1, Sa2 + product count */}
      <div className="grid grid-cols-2 gap-4 mb-6 sm:grid-cols-4">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Produkti</p>
          <p className="mt-2 text-3xl font-extrabold text-gray-900">{productCount}</p>
          <Link href="/dashboard/produkti" className="mt-1 flex items-center gap-1 text-xs text-brand-600 hover:underline">
            Skatīt <ArrowRight size={11} />
          </Link>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Šodien</p>
          <p className="mt-2 text-3xl font-extrabold text-gray-900">{todayOrderCount}</p>
          <p className="mt-1 text-xs text-gray-400">jauni pasūtījumi</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">30 dienas</p>
          <p className="mt-2 text-3xl font-extrabold text-gray-900">{monthOrderCount}</p>
          <p className="mt-1 text-xs text-gray-400">pasūtījumi</p>
        </div>
        <div className="rounded-2xl border border-brand-200 bg-brand-50 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">Apgrozījums 30d</p>
          <p className="mt-2 text-3xl font-extrabold text-gray-900">{formatPrice(monthRevenueCents / 100)}</p>
          <p className="mt-1 text-xs text-brand-700/70">pirms komisijas</p>
        </div>
      </div>

      {/* Sb3 — expiring soon (priority alert) */}
      {expiringSoon.length > 0 && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <p className="font-bold text-amber-900">⚠ Beidzas tuvākajās 3 dienās ({expiringSoon.length})</p>
          <ul className="mt-3 space-y-1.5">
            {expiringSoon.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
                <Link href={`/dashboard/produkti`} className="line-clamp-1 text-amber-900 hover:underline">
                  {p.title}
                </Link>
                <span className="shrink-0 text-xs text-amber-700">līdz {p.freshness_date}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Sb1 — top 5 sold last 30 days */}
      {topProducts.length > 0 && (
        <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-bold text-gray-900">Top 5 pārdotākie · 30d</p>
          <table className="mt-3 w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-gray-400">
              <tr>
                <th className="text-left font-medium pb-2">Produkts</th>
                <th className="text-right font-medium pb-2">Gab.</th>
                <th className="text-right font-medium pb-2">€</th>
              </tr>
            </thead>
            <tbody>
              {topProducts.map((p) => (
                <tr key={p.id} className="border-t border-gray-50">
                  <td className="py-1.5 pr-3 text-gray-700"><span className="line-clamp-1">{p.title}</span></td>
                  <td className="py-1.5 text-right tabular-nums text-gray-900">{p.units}</td>
                  <td className="py-1.5 text-right tabular-nums font-semibold text-gray-900">{formatPrice(p.revenueCents / 100)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Quick actions */}
      <h2 className="mb-3 text-sm font-extrabold text-gray-700">Ātrās darbības</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {status === "approved" ? (
          <Link href="/dashboard/produkti/jauns"
            className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm hover:shadow-md transition group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#192635] text-white">
              <Plus size={18} />
            </div>
            <div>
              <p className="font-semibold text-gray-900 group-hover:text-brand-600">Pievienot produktu</p>
              <p className="text-xs text-gray-400">Jauns produkts katalogā</p>
            </div>
            <ArrowRight size={16} className="ml-auto text-gray-300 group-hover:text-brand-400" />
          </Link>
        ) : (
          <div className="flex items-center gap-4 rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4 opacity-60 cursor-not-allowed">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-200">
              <Plus size={18} className="text-gray-400" />
            </div>
            <div>
              <p className="font-semibold text-gray-500">Pievienot produktu</p>
              <p className="text-xs text-gray-400">
                {status === "pending" ? "Gaida profila apstiprinājumu" : "Profils nav apstiprināts"}
              </p>
            </div>
          </div>
        )}
        <Link href="/dashboard/profils"
          className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm hover:shadow-md transition group">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100">
            <User size={18} className="text-gray-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 group-hover:text-brand-600">Rediģēt profilu</p>
            <p className="text-xs text-gray-400">Apraksts, bildes, video</p>
          </div>
          <ArrowRight size={16} className="ml-auto text-gray-300 group-hover:text-brand-400" />
        </Link>
      </div>
    </div>
  );
}
