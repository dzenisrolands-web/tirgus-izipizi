"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users, Package, ShoppingBag, TrendingUp, Clock, CheckCircle, XCircle,
  AlertCircle, AlertTriangle, ImageOff, EuroIcon, ChevronRight, Pause,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type SellerRow = {
  id: string;
  user_id: string | null;
  email: string | null;
  name: string | null;
  farm_name: string | null;
  status: string;
  description: string | null;
  legal_name: string | null;
  registration_number: string | null;
  is_vat_registered: boolean | null;
  vat_number: string | null;
  legal_address: string | null;
  bank_iban: string | null;
  self_billing_agreed: boolean | null;
  home_locker_ids: string[] | null;
  courier_pickup_address: string | null;
  created_at: string;
};

type IncompleteSeller = {
  id: string;
  name: string;
  status: string;
  missing: string[];
};

type PausedListing = {
  id: string;
  title: string;
  reason: "no_image" | "no_price" | "other";
  seller_name: string;
  seller_id: string;
};

function computeMissing(s: SellerRow): string[] {
  const m: string[] = [];
  if (!s.description || s.description.length < 20) m.push("Apraksts");
  if (!s.legal_name || !s.registration_number) m.push("Juridiskais nosaukums + reģ.nr.");
  if (s.is_vat_registered && !s.vat_number) m.push("PVN nr.");
  if (!s.bank_iban) m.push("IBAN");
  if (!s.legal_address) m.push("Juridiskā adrese");
  if (!s.self_billing_agreed) m.push("Self-billing piekrišana");
  const hasLocker = (s.home_locker_ids?.length ?? 0) > 0;
  const hasPickup = !!s.courier_pickup_address?.trim();
  if (!hasLocker && !hasPickup) m.push("Nodošanas vieta");
  if (!s.user_id) m.push(s.email ? "Gaida ielogošanos (invite nosūtīts)" : "Nav e-pasta + auth konta");
  return m;
}

export default function AdminPage() {
  const [stats, setStats] = useState({ sellers: 0, pendingSellers: 0, listings: 0, activeListings: 0 });
  const [pendingSellers, setPendingSellers] = useState<{ id: string; name: string; created_at: string }[]>([]);
  const [incompleteSellers, setIncompleteSellers] = useState<IncompleteSeller[]>([]);
  const [pausedListings, setPausedListings] = useState<PausedListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [
        { count: sellers },
        { count: pendingSellersCount },
        { count: listings },
        { count: activeListings },
        { data: pending },
        { data: allSellers },
        { data: pausedRows },
      ] = await Promise.all([
        supabase.from("sellers").select("*", { count: "exact", head: true }),
        supabase.from("sellers").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("listings").select("*", { count: "exact", head: true }),
        supabase.from("listings").select("*", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("sellers").select("id,name,created_at").eq("status", "pending").order("created_at", { ascending: false }).limit(5),
        supabase.from("sellers").select("id,user_id,email,name,farm_name,status,description,legal_name,registration_number,is_vat_registered,vat_number,legal_address,bank_iban,self_billing_agreed,home_locker_ids,courier_pickup_address,created_at"),
        supabase.from("listings").select("id, title, image_url, price, seller_id").eq("status", "paused"),
      ]);

      setStats({
        sellers: sellers ?? 0,
        pendingSellers: pendingSellersCount ?? 0,
        listings: listings ?? 0,
        activeListings: activeListings ?? 0,
      });
      setPendingSellers(pending ?? []);

      const sellerNameById = new Map<string, string>(
        ((allSellers ?? []) as SellerRow[]).map((s) => [s.id, s.farm_name ?? s.name ?? "(bez nosaukuma)"]),
      );

      // Incomplete sellers — exclude rejected (manually disabled) and pending
      // (already shown in the Pending block).
      const incomplete: IncompleteSeller[] = ((allSellers ?? []) as SellerRow[])
        .filter((s) => s.status !== "rejected")
        .map((s) => ({
          id: s.id,
          name: s.farm_name ?? s.name ?? "(bez nosaukuma)",
          status: s.status,
          missing: computeMissing(s),
        }))
        .filter((s) => s.missing.length > 0)
        .sort((a, b) => b.missing.length - a.missing.length);
      setIncompleteSellers(incomplete);

      const paused: PausedListing[] = ((pausedRows ?? []) as Array<{
        id: string; title: string; image_url: string | null; price: number | null; seller_id: string;
      }>).map((l) => {
        const reason: PausedListing["reason"] =
          (!l.image_url || l.image_url === "") ? "no_image" :
          (!l.price || l.price === 0) ? "no_price" :
          "other";
        return {
          id: l.id,
          title: l.title,
          reason,
          seller_name: sellerNameById.get(l.seller_id) ?? "(nezināms)",
          seller_id: l.seller_id,
        };
      });
      setPausedListings(paused);
      setLoading(false);
    }
    load();
  }, []);

  async function approveSeller(id: string) {
    await supabase.from("sellers").update({ status: "approved" }).eq("id", id);
    setPendingSellers(p => p.filter(s => s.id !== id));
    setStats(s => ({ ...s, pendingSellers: s.pendingSellers - 1 }));
  }

  async function rejectSeller(id: string) {
    await supabase.from("sellers").update({ status: "rejected" }).eq("id", id);
    setPendingSellers(p => p.filter(s => s.id !== id));
    setStats(s => ({ ...s, pendingSellers: s.pendingSellers - 1 }));
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
      </div>
    );
  }

  const noImage = pausedListings.filter((l) => l.reason === "no_image");
  const noPrice = pausedListings.filter((l) => l.reason === "no_price");
  const totalAlerts = incompleteSellers.length + pausedListings.length + stats.pendingSellers;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-gray-900">Admin kopsavilkums</h1>
        <p className="mt-0.5 text-sm text-gray-500">Platformas pārskats un darbības</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { icon: <AlertTriangle size={20} />, label: "Brīdinājumi", value: totalAlerts, color: "text-red-600 bg-red-50", urgent: totalAlerts > 0 },
          { icon: <Users size={20} />, label: "Ražotāji kopā", value: stats.sellers, color: "text-blue-600 bg-blue-50" },
          { icon: <Clock size={20} />, label: "Gaida apstiprinājumu", value: stats.pendingSellers, color: "text-amber-600 bg-amber-50", urgent: stats.pendingSellers > 0 },
          { icon: <Package size={20} />, label: "Produkti kopā", value: stats.listings, color: "text-purple-600 bg-purple-50" },
          { icon: <TrendingUp size={20} />, label: "Aktīvie produkti", value: stats.activeListings, color: "text-green-600 bg-green-50" },
        ].map((s) => (
          <div key={s.label} className={`rounded-2xl border bg-white p-5 shadow-sm ${s.urgent ? "border-red-200 ring-1 ring-red-200" : "border-gray-100"}`}>
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${s.color}`}>
              {s.icon}
            </div>
            <p className="mt-3 text-2xl font-extrabold text-gray-900">{s.value}</p>
            <p className="mt-0.5 text-sm text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Auto-paused listings */}
      {pausedListings.length > 0 && (
        <section className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">
              Auto-pauzēti produkti
              <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">{pausedListings.length}</span>
            </h2>
            <Link href="/admin/produkti?status=paused" className="text-sm font-medium text-brand-600 hover:underline">
              Visi pauzētie →
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <PausedGroup
              title="Bez bildes"
              icon={<ImageOff size={16} />}
              tone="amber"
              items={noImage}
            />
            <PausedGroup
              title="Bez cenas"
              icon={<EuroIcon size={16} />}
              tone="red"
              items={noPrice}
            />
          </div>
        </section>
      )}

      {/* Incomplete profiles */}
      {incompleteSellers.length > 0 && (
        <section className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">
              Trūkstošā informācija profilos
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">{incompleteSellers.length}</span>
            </h2>
            <Link href="/admin/razotaji" className="text-sm font-medium text-brand-600 hover:underline">
              Visi ražotāji →
            </Link>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50/50 shadow-sm overflow-hidden">
            <div className="divide-y divide-amber-100">
              {incompleteSellers.map((s) => (
                <Link
                  key={s.id}
                  href={`/admin/razotaji?seller=${s.id}`}
                  className="flex items-start gap-3 px-5 py-4 hover:bg-amber-100/40 transition"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-200 text-amber-800">
                    <AlertTriangle size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 truncate">{s.name}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        s.status === "approved" ? "bg-green-100 text-green-700" :
                        s.status === "pending"  ? "bg-amber-100 text-amber-800" :
                        "bg-gray-100 text-gray-600"
                      }`}>
                        {s.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-amber-900">
                      Trūkst ({s.missing.length}): {s.missing.join(" · ")}
                    </p>
                  </div>
                  <ChevronRight size={16} className="mt-2 shrink-0 text-amber-500" />
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Pending approvals */}
      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Gaidošie apstiprināšanas</h2>
          <Link href="/admin/razotaji" className="text-sm font-medium text-brand-600 hover:underline">
            Visi ražotāji →
          </Link>
        </div>

        {pendingSellers.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-10 text-center">
            <CheckCircle size={32} className="mx-auto text-green-400" />
            <p className="mt-3 font-semibold text-gray-900">Visi apstiprināti</p>
            <p className="mt-1 text-sm text-gray-500">Pašlaik nav neviena gaidoša pieteikuma</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
            <div className="divide-y divide-gray-50">
              {pendingSellers.map((seller) => (
                <div key={seller.id} className="flex items-center justify-between gap-4 px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                      <AlertCircle size={16} />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{seller.name}</p>
                      <p className="text-xs text-gray-400">
                        Pieteicās: {new Date(seller.created_at).toLocaleDateString("lv-LV")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => approveSeller(seller.id)}
                      className="flex items-center gap-1.5 rounded-lg bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-100 transition"
                    >
                      <CheckCircle size={13} /> Apstiprināt
                    </button>
                    <button
                      onClick={() => rejectSeller(seller.id)}
                      className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 transition"
                    >
                      <XCircle size={13} /> Noraidīt
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Quick links */}
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          { href: "/admin/razotaji", icon: <Users size={20} />, label: "Pārvaldīt ražotājus", desc: "Apstiprināt, noraidīt, skatīt profilus" },
          { href: "/admin/produkti", icon: <Package size={20} />, label: "Visi produkti", desc: "Moderēt un pārvaldīt sludinājumus" },
          { href: "/admin/pasutijumi", icon: <ShoppingBag size={20} />, label: "Pasūtījumi", desc: "Skatīt visus pasūtījumus" },
        ].map((item) => (
          <Link key={item.href} href={item.href}
            className="group rounded-2xl border border-gray-100 bg-white p-5 shadow-sm hover:border-brand-300 hover:shadow-md transition">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-600 group-hover:bg-brand-100 group-hover:text-brand-700 transition">
              {item.icon}
            </div>
            <p className="mt-3 font-semibold text-gray-900">{item.label}</p>
            <p className="mt-0.5 text-sm text-gray-500">{item.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function PausedGroup({
  title, icon, tone, items,
}: {
  title: string;
  icon: React.ReactNode;
  tone: "amber" | "red";
  items: PausedListing[];
}) {
  const palette = tone === "red"
    ? { border: "border-red-200", bg: "bg-red-50/50", chip: "bg-red-200 text-red-800", divide: "divide-red-100", hover: "hover:bg-red-100/40", header: "text-red-900", body: "text-red-800" }
    : { border: "border-amber-200", bg: "bg-amber-50/50", chip: "bg-amber-200 text-amber-800", divide: "divide-amber-100", hover: "hover:bg-amber-100/40", header: "text-amber-900", body: "text-amber-800" };

  if (items.length === 0) {
    return (
      <div className={`rounded-2xl border ${palette.border} ${palette.bg} p-4`}>
        <div className="flex items-center gap-2">
          <div className={`flex h-7 w-7 items-center justify-center rounded-full ${palette.chip}`}>
            {icon}
          </div>
          <p className={`text-sm font-bold ${palette.header}`}>{title}</p>
          <span className="ml-auto text-xs text-gray-500">0</span>
        </div>
        <p className="mt-3 text-xs text-gray-500">Nav nevienas problēmas šajā kategorijā.</p>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border ${palette.border} ${palette.bg} overflow-hidden`}>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100/40">
        <div className={`flex h-7 w-7 items-center justify-center rounded-full ${palette.chip}`}>
          {icon}
        </div>
        <p className={`text-sm font-bold ${palette.header}`}>{title}</p>
        <span className={`ml-auto rounded-full ${palette.chip} px-2 py-0.5 text-[10px] font-bold`}>{items.length}</span>
      </div>
      <ul className={`divide-y ${palette.divide}`}>
        {items.slice(0, 6).map((it) => (
          <li key={it.id}>
            <Link
              href={`/admin/produkti?seller=${it.seller_id}`}
              className={`flex items-center gap-3 px-4 py-2.5 text-xs ${palette.hover} transition`}
            >
              <Pause size={11} className={palette.body} />
              <span className="truncate text-gray-800 flex-1">{it.title}</span>
              <span className={`shrink-0 ${palette.body} font-medium`}>{it.seller_name}</span>
            </Link>
          </li>
        ))}
        {items.length > 6 && (
          <li className="px-4 py-2 text-[11px] text-gray-500 text-center">
            +{items.length - 6} vairāk · skati pilnu sarakstu
          </li>
        )}
      </ul>
    </div>
  );
}
