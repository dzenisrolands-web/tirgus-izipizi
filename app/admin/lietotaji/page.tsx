"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users, Search, ShoppingBag, Store, Clock, CheckCircle, AlertCircle,
  Loader2, ExternalLink, Mail,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type User = {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  provider: string;
  created_at: string;
  last_sign_in_at: string | null;
  role: "seller" | "buyer";
  seller: { id: string; name: string; status: string } | null;
  orders: { total: number; paid: number };
};

type Filter = "all" | "buyer" | "seller" | "today";

const providerLabels: Record<string, string> = {
  google: "Google",
  email: "E-pasts",
  phone: "Telefons",
};

export default function AdminLietotajiPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { setError("Nav sesijas"); setLoading(false); return; }

      const res = await fetch("/api/admin/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        setUsers(data.users);
      } else {
        setError(data.error ?? "Kļūda");
      }
      setLoading(false);
    }
    load();
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const todayCount = users.filter(u => u.created_at.startsWith(today)).length;

  const visible = users.filter(u => {
    if (filter === "buyer" && u.role !== "buyer") return false;
    if (filter === "seller" && u.role !== "seller") return false;
    if (filter === "today" && !u.created_at.startsWith(today)) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        u.email.toLowerCase().includes(q) ||
        (u.name?.toLowerCase().includes(q) ?? false) ||
        (u.seller?.name?.toLowerCase().includes(q) ?? false)
      );
    }
    return true;
  });

  if (loading) return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 size={24} className="animate-spin text-gray-400" />
    </div>
  );

  if (error) return (
    <div className="mx-auto max-w-4xl px-4 py-10 text-center">
      <AlertCircle size={40} className="mx-auto text-red-400" />
      <p className="mt-3 text-red-700">{error}</p>
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Lietotāji</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {users.length} kopā · {todayCount} šodien · {users.filter(u => u.role === "seller").length} ražotāji · {users.filter(u => u.role === "buyer").length} pircēji
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Meklēt pēc vārda, e-pasta..."
            className="input pl-9 w-full" />
        </div>
        <div className="flex gap-1.5">
          {([
            { key: "all", label: "Visi" },
            { key: "today", label: `Šodien (${todayCount})` },
            { key: "seller", label: "Ražotāji" },
            { key: "buyer", label: "Pircēji" },
          ] as const).map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                filter === f.key ? "bg-[#192635] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-12 text-center">
          <Users size={40} className="mx-auto text-gray-300" />
          <p className="mt-3 text-gray-500">Nav atrasts neviens lietotājs</p>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map(user => {
            const isToday = user.created_at.startsWith(today);
            return (
              <div key={user.id} className={`rounded-2xl border bg-white shadow-sm overflow-hidden ${isToday ? "border-green-200 ring-1 ring-green-100" : "border-gray-100"}`}>
                <div className="flex items-center gap-3 px-4 py-3">
                  {/* Avatar */}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 overflow-hidden">
                    {user.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={user.avatar} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-sm font-bold text-gray-400">
                        {(user.name?.charAt(0) ?? user.email.charAt(0) ?? "?").toUpperCase()}
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900 truncate text-sm">
                        {user.name ?? user.email}
                      </p>
                      {/* Role badge */}
                      {user.seller ? (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          user.seller.status === "approved" ? "bg-green-100 text-green-700" :
                          user.seller.status === "pending" ? "bg-amber-100 text-amber-700" :
                          "bg-gray-100 text-gray-500"
                        }`}>
                          <Store size={9} className="inline mr-0.5" />
                          {user.seller.status === "approved" ? "Ražotājs" :
                           user.seller.status === "pending" ? "Gaida apst." :
                           user.seller.status}
                        </span>
                      ) : (
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-600">
                          Pircējs
                        </span>
                      )}
                      {/* Provider */}
                      <span className="rounded-full bg-gray-50 px-2 py-0.5 text-[10px] font-semibold text-gray-400">
                        {providerLabels[user.provider] ?? user.provider}
                      </span>
                      {isToday && (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">
                          ✨ Jauns!
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {user.email}
                      <span className="mx-1.5 text-gray-200">·</span>
                      reģ. {new Date(user.created_at).toLocaleDateString("lv-LV", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      {user.last_sign_in_at && (
                        <>
                          <span className="mx-1.5 text-gray-200">·</span>
                          pēd. {new Date(user.last_sign_in_at).toLocaleDateString("lv-LV", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </>
                      )}
                    </p>
                  </div>

                  {/* Stats + actions */}
                  <div className="flex items-center gap-3 shrink-0">
                    {user.orders.paid > 0 && (
                      <span className="flex items-center gap-1 text-xs font-semibold text-gray-500">
                        <ShoppingBag size={11} /> {user.orders.paid} pasūt.
                      </span>
                    )}
                    {user.seller && (
                      <Link href={`/seller/${user.seller.id}`} target="_blank"
                        className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2 py-1 text-[10px] font-semibold text-gray-500 hover:bg-gray-100 transition">
                        <ExternalLink size={9} /> profils
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
