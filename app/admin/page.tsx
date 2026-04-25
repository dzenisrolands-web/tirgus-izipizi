"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, Package, ShoppingBag, TrendingUp, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Stats = {
  sellers: number;
  pendingSellers: number;
  listings: number;
  activeListings: number;
};

export default function AdminPage() {
  const [stats, setStats] = useState<Stats>({ sellers: 0, pendingSellers: 0, listings: 0, activeListings: 0 });
  const [pendingSellers, setPendingSellers] = useState<{ id: string; name: string; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [
        { count: sellers },
        { count: pendingSellersCount },
        { count: listings },
        { count: activeListings },
        { data: pending },
      ] = await Promise.all([
        supabase.from("sellers").select("*", { count: "exact", head: true }),
        supabase.from("sellers").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("listings").select("*", { count: "exact", head: true }),
        supabase.from("listings").select("*", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("sellers").select("id,name,created_at").eq("status", "pending").order("created_at", { ascending: false }).limit(5),
      ]);

      setStats({
        sellers: sellers ?? 0,
        pendingSellers: pendingSellersCount ?? 0,
        listings: listings ?? 0,
        activeListings: activeListings ?? 0,
      });
      setPendingSellers(pending ?? []);
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

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-gray-900">Admin kopsavilkums</h1>
        <p className="mt-0.5 text-sm text-gray-500">Platformas pārskats un darbības</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: <Users size={20} />, label: "Ražotāji kopā", value: stats.sellers, color: "text-blue-600 bg-blue-50" },
          { icon: <Clock size={20} />, label: "Gaida apstiprinājumu", value: stats.pendingSellers, color: "text-amber-600 bg-amber-50", urgent: stats.pendingSellers > 0 },
          { icon: <Package size={20} />, label: "Produkti kopā", value: stats.listings, color: "text-purple-600 bg-purple-50" },
          { icon: <TrendingUp size={20} />, label: "Aktīvie produkti", value: stats.activeListings, color: "text-green-600 bg-green-50" },
        ].map((s) => (
          <div key={s.label} className={`rounded-2xl border bg-white p-5 shadow-sm ${s.urgent ? "border-amber-200 ring-1 ring-amber-200" : "border-gray-100"}`}>
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${s.color}`}>
              {s.icon}
            </div>
            <p className="mt-3 text-2xl font-extrabold text-gray-900">{s.value}</p>
            <p className="mt-0.5 text-sm text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Pending approvals */}
      <div className="mt-8">
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
      </div>

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
