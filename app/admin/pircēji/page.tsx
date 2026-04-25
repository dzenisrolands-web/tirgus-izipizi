"use client";

import { useEffect, useState } from "react";
import { Users, Mail, Phone, ShoppingBag, TrendingUp, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatPrice } from "@/lib/utils";

type Buyer = {
  email: string;
  name: string;
  phone: string;
  orderCount: number;
  totalSpent: number;
  lastOrder: string;
};

export default function AdminPircējiPage() {
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    supabase
      .from("orders")
      .select("buyer_name, buyer_email, buyer_phone, total_cents, created_at")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        const map = new Map<string, Buyer>();
        for (const o of data ?? []) {
          const key = o.buyer_email?.toLowerCase() ?? o.buyer_name;
          const existing = map.get(key);
          if (existing) {
            existing.orderCount += 1;
            existing.totalSpent += o.total_cents ?? 0;
          } else {
            map.set(key, {
              email: o.buyer_email ?? "—",
              name: o.buyer_name ?? "—",
              phone: o.buyer_phone ?? "—",
              orderCount: 1,
              totalSpent: o.total_cents ?? 0,
              lastOrder: o.created_at,
            });
          }
        }
        setBuyers([...map.values()].sort((a, b) => b.totalSpent - a.totalSpent));
        setLoading(false);
      });
  }, []);

  const visible = buyers.filter(b =>
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    b.email.toLowerCase().includes(search.toLowerCase())
  );

  const totalRevenue = buyers.reduce((s, b) => s + b.totalSpent, 0);
  const totalOrders = buyers.reduce((s, b) => s + b.orderCount, 0);

  if (loading) return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900">Pircēji</h1>
        <p className="mt-0.5 text-sm text-gray-500">{buyers.length} unikāli pircēji · {totalOrders} pasūtījumi kopā</p>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Users size={18} /></div>
          <p className="mt-3 text-2xl font-extrabold text-gray-900">{buyers.length}</p>
          <p className="text-xs text-gray-500">Unikāli pircēji</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-600"><ShoppingBag size={18} /></div>
          <p className="mt-3 text-2xl font-extrabold text-gray-900">{totalOrders}</p>
          <p className="text-xs text-gray-500">Pasūtījumi kopā</p>
        </div>
        <div className="col-span-2 sm:col-span-1 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-50 text-green-600"><TrendingUp size={18} /></div>
          <p className="mt-3 text-2xl font-extrabold text-gray-900">{formatPrice(totalRevenue / 100)}</p>
          <p className="text-xs text-gray-500">Apgrozījums kopā</p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-5 relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Meklēt pēc vārda vai e-pasta..."
          className="input pl-9 w-full max-w-sm" />
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-12 text-center">
          <Users size={36} className="mx-auto text-gray-300" />
          <p className="mt-3 text-gray-400">Nav pircēju datu — pasūtījumi vēl nav veikti</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          <div className="hidden sm:grid grid-cols-[1fr_1fr_80px_100px_100px] gap-3 border-b border-gray-100 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
            <span>Pircējs</span>
            <span>Kontakti</span>
            <span className="text-center">Pasūtījumi</span>
            <span className="text-right">Kopā iztērēts</span>
            <span className="text-right">Pēdējais</span>
          </div>
          <div className="divide-y divide-gray-50">
            {visible.map(b => (
              <div key={b.email} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_80px_100px_100px] items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{b.name}</p>
                  <p className="text-xs text-gray-400 sm:hidden">{b.email}</p>
                </div>
                <div className="hidden sm:block space-y-0.5">
                  <p className="flex items-center gap-1.5 text-xs text-gray-600">
                    <Mail size={11} className="text-gray-400" />{b.email}
                  </p>
                  {b.phone !== "—" && (
                    <p className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Phone size={11} className="text-gray-400" />{b.phone}
                    </p>
                  )}
                </div>
                <div className="text-center">
                  <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-700">{b.orderCount}</span>
                </div>
                <p className="text-right text-sm font-bold text-gray-900">{formatPrice(b.totalSpent / 100)}</p>
                <p className="text-right text-xs text-gray-400">
                  {new Intl.DateTimeFormat("lv-LV", { day: "numeric", month: "short" }).format(new Date(b.lastOrder))}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
