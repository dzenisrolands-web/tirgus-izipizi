"use client";

import { useEffect, useState } from "react";
import { ShoppingBag, Clock, CheckCircle, Search, Package } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatPrice } from "@/lib/utils";

type Order = {
  id: string;
  order_number: string;
  status: string;
  buyer_name: string;
  buyer_email: string;
  buyer_phone: string;
  delivery_info: { locker_name: string; locker_city: string };
  items: { title: string; quantity: number; price: number }[];
  total_cents: number;
  paid_at: string | null;
  created_at: string;
};

const statusMap: Record<string, { label: string; cls: string }> = {
  pending:    { label: "Gaida apmaksu", cls: "bg-amber-100 text-amber-700" },
  paid:       { label: "Apmaksāts",     cls: "bg-green-100 text-green-700" },
  processing: { label: "Apstrādē",      cls: "bg-blue-100 text-blue-700" },
  shipped:    { label: "Nosūtīts",      cls: "bg-purple-100 text-purple-700" },
  delivered:  { label: "Piegādāts",     cls: "bg-gray-100 text-gray-600" },
  cancelled:  { label: "Atcelts",       cls: "bg-red-100 text-red-600" },
};

const STATUS_OPTIONS = ["all", "pending", "paid", "processing", "shipped", "delivered", "cancelled"] as const;

export default function AdminPasutijumiPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<typeof STATUS_OPTIONS[number]>("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("orders").select("*")
        .order("created_at", { ascending: false });
      setOrders(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  async function updateStatus(id: string, status: string) {
    await supabase.from("orders").update({
      status,
      paid_at: status === "paid" ? new Date().toISOString() : undefined,
    }).eq("id", id);
    setOrders(p => p.map(o => o.id === id ? { ...o, status, paid_at: status === "paid" ? new Date().toISOString() : o.paid_at } : o));
  }

  const visible = orders.filter(o => {
    const matchStatus = filter === "all" || o.status === filter;
    const matchSearch = o.order_number.toLowerCase().includes(search.toLowerCase()) ||
      o.buyer_name.toLowerCase().includes(search.toLowerCase()) ||
      o.buyer_email.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const totalRevenue = orders.filter(o => o.status === "paid" || o.paid_at).reduce((s, o) => s + o.total_cents, 0);

  if (loading) return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Pasūtījumi</h1>
          <p className="mt-0.5 text-sm text-gray-500">{orders.length} kopā · ieņēmumi {formatPrice(totalRevenue / 100)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Meklēt pasūtījumu, pircēju..."
            className="input pl-9 w-full" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_OPTIONS.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                filter === f ? "bg-[#192635] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}>
              {f === "all" ? "Visi" : (statusMap[f]?.label ?? f)}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-16 text-center">
          <ShoppingBag size={40} className="mx-auto text-gray-300" />
          <p className="mt-3 font-semibold text-gray-900">Nav pasūtījumu</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((order) => {
            const st = statusMap[order.status] ?? { label: order.status, cls: "bg-gray-100 text-gray-600" };
            const isOpen = expanded === order.id;
            return (
              <div key={order.id} className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
                <button
                  onClick={() => setExpanded(isOpen ? null : order.id)}
                  className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 transition"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100">
                    <Package size={16} className="text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900">{order.order_number}</p>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${st.cls}`}>{st.label}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {order.buyer_name} · {order.buyer_email} · {new Date(order.created_at).toLocaleDateString("lv-LV")}
                    </p>
                  </div>
                  <p className="shrink-0 font-bold text-gray-900">{formatPrice(order.total_cents / 100)}</p>
                </button>

                {isOpen && (
                  <div className="border-t border-gray-100 px-5 py-4 space-y-4 bg-gray-50">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1">Pircējs</p>
                        <p className="font-medium text-gray-900">{order.buyer_name}</p>
                        <p className="text-gray-500">{order.buyer_email}</p>
                        <p className="text-gray-500">{order.buyer_phone}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1">Piegāde</p>
                        <p className="font-medium text-gray-900">{order.delivery_info?.locker_name}</p>
                        <p className="text-gray-500">{order.delivery_info?.locker_city}</p>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-2">Preces</p>
                      <div className="space-y-1">
                        {order.items.map((item, i) => (
                          <div key={i} className="flex justify-between text-sm">
                            <span className="text-gray-700">{item.title} × {item.quantity}</span>
                            <span className="font-medium">{formatPrice(item.price * item.quantity)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                      <div className="flex items-center gap-1.5 text-xs text-gray-400">
                        {order.paid_at
                          ? <><CheckCircle size={12} className="text-green-500" /> Apmaksāts {new Date(order.paid_at).toLocaleDateString("lv-LV")}</>
                          : <><Clock size={12} /> Gaida apmaksu</>
                        }
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={order.status}
                          onChange={e => updateStatus(order.id, e.target.value)}
                          className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-700 focus:outline-none"
                        >
                          {Object.entries(statusMap).map(([val, { label }]) => (
                            <option key={val} value={val}>{label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
