"use client";

import { useEffect, useState, useCallback } from "react";
import { ShoppingBag, Clock, CheckCircle, Search, Package, RefreshCw, CreditCard, AlertTriangle, Loader2, Send } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatPrice } from "@/lib/utils";

type OrderItem = {
  title: string;
  quantity: number;
  price: number;
  seller_id?: string;
  sellerId?: string;
  sellerName?: string;
};

type DeliveryFeeBySeller = { sellerId?: string; sellerName?: string; feeCents: number; method: string };

type Order = {
  id: string;
  order_number: string;
  status: string;
  payment_status: string | null;
  buyer_name: string;
  buyer_email: string;
  buyer_phone: string;
  delivery_type: string | null;
  delivery_info: {
    locker_name?: string; locker_city?: string; address?: string; city?: string; postal_code?: string;
    delivery_fee_cents?: number; delivery_fees_by_seller?: DeliveryFeeBySeller[];
    promo_code?: string; promo_discount_cents?: number;
  };
  items: OrderItem[];
  seller_ids: string[] | null;
  promo_code: string | null;
  promo_discount_cents: number | null;
  seller_confirmations: Record<string, { confirmed_at?: string; viewed_at?: string }> | null;
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

const paymentStatusMap: Record<string, { label: string; cls: string }> = {
  awaiting:  { label: "Gaida",      cls: "bg-amber-50 text-amber-600 border-amber-200" },
  paid:      { label: "Apmaksāts",  cls: "bg-green-50 text-green-700 border-green-200" },
  cancelled: { label: "Atcelts",    cls: "bg-red-50 text-red-600 border-red-200" },
  refunded:  { label: "Atgriezts",  cls: "bg-gray-50 text-gray-600 border-gray-200" },
};

const STATUS_OPTIONS = ["all", "pending", "paid", "processing", "shipped", "delivered", "cancelled"] as const;
const PAID_FLOW_STATUSES = new Set(["paid", "processing", "shipped", "delivered"]);

export default function AdminPasutijumiPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<typeof STATUS_OPTIONS[number]>("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);
  const [resending, setResending] = useState<string | null>(null);
  const [resendResult, setResendResult] = useState<{ id: string; ok: boolean; msg: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const loadOrders = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    const { data } = await supabase
      .from("orders").select("*")
      .order("created_at", { ascending: false });
    setOrders(data ?? []);
    setLoading(false);
    setRefreshing(false);
    setLastRefresh(new Date());
  }, []);

  // Initial load + auto-refresh every 30s
  useEffect(() => {
    loadOrders();
    const interval = setInterval(() => loadOrders(true), 30_000);
    return () => clearInterval(interval);
  }, [loadOrders]);

  async function getToken(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }

  async function updateStatus(id: string, status: string) {
    const current = orders.find((o) => o.id === id);
    if (!current) return;

    try {
      const token = await getToken();
      if (!token) { alert("Nav sesijas — pārlogojies."); return; }

      const res = await fetch("/api/admin/update-order-status", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ orderId: id, status }),
      });
      const json = await res.json();

      if (!res.ok || !json.ok) {
        alert(`Kļūda mainot statusu: ${json.error ?? "Nezināma kļūda"}`);
        return;
      }

      const updates = json.updates as { status: string; payment_status?: string; paid_at?: string | null };
      setOrders((prev) => prev.map((o) =>
        o.id === id
          ? {
              ...o,
              status: updates.status,
              payment_status: updates.payment_status ?? o.payment_status,
              paid_at: updates.paid_at === undefined ? o.paid_at : updates.paid_at,
            }
          : o,
      ));
    } catch (e) {
      alert(`Tīkla kļūda: ${e instanceof Error ? e.message : "Nezināma kļūda"}`);
    }
  }

  /** Mark a pending order as paid + trigger full flow (notifications, emails) */
  async function markAsPaid(order: Order) {
    if (order.payment_status === "paid") return;
    setMarkingPaid(order.id);
    try {
      const token = await getToken();
      if (!token) { alert("Nav sesijas — pārlogojies."); return; }

      const res = await fetch("/api/admin/update-order-status", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ orderId: order.id, status: "paid" }),
      });
      const json = await res.json();

      if (!res.ok || !json.ok) {
        alert(`Kļūda: ${json.error ?? "Nezināma kļūda"}`);
        return;
      }

      const updates = json.updates as { status: string; payment_status?: string; paid_at?: string | null };
      setOrders((prev) => prev.map((o) =>
        o.id === order.id
          ? { ...o, status: "paid", payment_status: "paid", paid_at: updates.paid_at as string ?? new Date().toISOString() }
          : o,
      ));
    } catch (e) {
      alert(`Kļūda: ${e instanceof Error ? e.message : "Nezināma kļūda"}`);
    } finally {
      setMarkingPaid(null);
    }
  }

  /** Resend notifications for an already-paid order (e.g., if webhook missed) */
  async function resendNotifications(order: Order) {
    setResending(order.id);
    setResendResult(null);
    try {
      const token = await getToken();
      if (!token) { alert("Nav sesijas"); return; }
      // Set status to "paid" again — the API detects it's already paid
      // but we force wasPaid=false by temporarily setting to pending then back
      // Actually simpler: just call update-order-status with "paid" — if already paid,
      // we need a special flag. Let's add resendOnly.
      const res = await fetch("/api/admin/update-order-status", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ orderId: order.id, status: "paid", resendNotifications: true }),
      });
      const json = await res.json();
      if (json.ok) {
        setResendResult({ id: order.id, ok: true, msg: `Paziņojumi nosūtīti (${(json.sideEffects ?? []).join(", ")})` });
      } else {
        setResendResult({ id: order.id, ok: false, msg: json.error ?? "Kļūda" });
      }
    } catch (e) {
      setResendResult({ id: order.id, ok: false, msg: e instanceof Error ? e.message : "Tīkla kļūda" });
    }
    setResending(null);
    setTimeout(() => setResendResult(null), 5000);
  }

  const visible = orders.filter(o => {
    const matchStatus = filter === "all" || o.status === filter;
    const matchSearch = o.order_number.toLowerCase().includes(search.toLowerCase()) ||
      o.buyer_name.toLowerCase().includes(search.toLowerCase()) ||
      o.buyer_email.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const pendingCount = orders.filter((o) => o.status === "pending" && o.payment_status !== "paid").length;
  const totalRevenue = orders
    .filter((o) => o.payment_status === "paid" || !!o.paid_at || PAID_FLOW_STATUSES.has(o.status))
    .reduce((s, o) => s + o.total_cents, 0);

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
          <p className="mt-0.5 text-sm text-gray-500">
            {orders.length} kopā · ieņēmumi {formatPrice(totalRevenue / 100)}
            <span className="ml-2 text-gray-300">·</span>
            <button
              onClick={() => loadOrders()}
              disabled={refreshing}
              className="ml-2 inline-flex items-center gap-1 text-xs text-brand-600 hover:underline disabled:opacity-50"
            >
              <RefreshCw size={10} className={refreshing ? "animate-spin" : ""} />
              {refreshing ? "Atjauno..." : `Atjaunots ${lastRefresh.toLocaleTimeString("lv-LV")}`}
            </button>
          </p>
        </div>
      </div>

      {/* Warning banner when orders are stuck */}
      {pendingCount > 0 && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800">
              {pendingCount} {pendingCount === 1 ? "pasūtījums gaida" : "pasūtījumi gaida"} apmaksu
            </p>
            <p className="mt-0.5 text-xs text-amber-700">
              Ja Paysera apmaksa ir veikta, bet statuss nav mainījies — nospied <strong>"Atzīmēt kā apmaksātu"</strong> uz attiecīgā pasūtījuma.
              Tas nosūtīs e-pastu pircējam un push paziņojumu ražotājam.
            </p>
          </div>
        </div>
      )}

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
                      {order.buyer_name} · {new Date(order.created_at).toLocaleDateString("lv-LV")}
                      {(() => {
                        const names = [...new Set((order.items ?? []).map(it => it.sellerName).filter(Boolean))];
                        return names.length > 0 ? ` · 🏪 ${names.join(", ")}` : "";
                      })()}
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
                        <p className="font-medium text-gray-900">
                          {order.delivery_type === "locker" ? "Pakomāts" : order.delivery_type === "courier" ? "Kurjers" : order.delivery_type === "express" ? "Ekspres" : order.delivery_type}
                        </p>
                        <p className="text-gray-500">{order.delivery_info?.locker_name ?? order.delivery_info?.address}</p>
                        <p className="text-gray-500">{order.delivery_info?.locker_city ?? order.delivery_info?.city}{order.delivery_info?.postal_code ? `, LV-${order.delivery_info.postal_code}` : ""}</p>
                        {/* Delivery fee */}
                        {(order.delivery_info?.delivery_fee_cents ?? 0) > 0 && (
                          <p className="mt-1 text-xs font-semibold text-gray-700">
                            Piegādes maksa: {formatPrice((order.delivery_info?.delivery_fee_cents ?? 0) / 100)}
                            {(order.delivery_info?.delivery_fees_by_seller?.length ?? 0) > 1 && (
                              <span className="text-gray-400 font-normal"> ({order.delivery_info!.delivery_fees_by_seller!.length} ražotāji)</span>
                            )}
                          </p>
                        )}
                        {/* Promo code */}
                        {(order.promo_code || order.delivery_info?.promo_code) && (
                          <p className="mt-1 text-xs">
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 font-bold text-green-700">
                              🎟 {order.promo_code ?? order.delivery_info?.promo_code}
                              {(order.promo_discount_cents ?? order.delivery_info?.promo_discount_cents ?? 0) > 0 && (
                                <span> −{formatPrice((order.promo_discount_cents ?? order.delivery_info?.promo_discount_cents ?? 0) / 100)}</span>
                              )}
                            </span>
                          </p>
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-2">Preces</p>
                      {(() => {
                        // Group items by seller
                        const groups = new Map<string, { name: string; items: OrderItem[] }>();
                        for (const item of order.items) {
                          const sid = item.seller_id ?? item.sellerId ?? "unknown";
                          const sname = item.sellerName ?? "Nezināms ražotājs";
                          if (!groups.has(sid)) groups.set(sid, { name: sname, items: [] });
                          groups.get(sid)!.items.push(item);
                        }
                        return [...groups.entries()].map(([sid, group]) => (
                          <div key={sid} className="mb-3 last:mb-0">
                            <p className="text-xs font-bold text-brand-700 mb-1 flex items-center gap-2">
                              🏪 {group.name}
                              {(() => {
                                const conf = order.seller_confirmations?.[sid];
                                if (conf?.confirmed_at) {
                                  return <span className="rounded-full bg-green-100 px-2 py-0.5 text-[9px] font-bold text-green-700">✓ Apstiprināts {new Date(conf.confirmed_at).toLocaleString("lv-LV", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>;
                                }
                                if (order.payment_status === "paid") {
                                  return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold text-amber-700">Gaida apstiprinājumu</span>;
                                }
                                return null;
                              })()}
                            </p>
                            <div className="space-y-1 pl-4 border-l-2 border-brand-100">
                              {group.items.map((item, i) => (
                                <div key={i} className="flex justify-between text-sm">
                                  <span className="text-gray-700">{item.title} × {item.quantity}</span>
                                  <span className="font-medium">{formatPrice(item.price * item.quantity)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ));
                      })()}
                    </div>

                    {/* Payment status + Mark as Paid */}
                    {order.status === "pending" && order.payment_status !== "paid" && (
                      <div className="flex items-center gap-3 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 px-4 py-3">
                        <AlertTriangle size={16} className="shrink-0 text-amber-600" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-amber-800">Paysera webhook nav saņemts</p>
                          <p className="text-[10px] text-amber-600">Ja apmaksa Paysera ir veikta, nospied pogu →</p>
                        </div>
                        <button
                          onClick={() => markAsPaid(order)}
                          disabled={markingPaid === order.id}
                          className="flex shrink-0 items-center gap-1.5 rounded-full bg-green-600 px-4 py-2 text-xs font-bold text-white hover:bg-green-700 transition disabled:opacity-60"
                        >
                          {markingPaid === order.id
                            ? <><Loader2 size={12} className="animate-spin" /> Apstrādā...</>
                            : <><CreditCard size={12} /> Atzīmēt kā apmaksātu</>
                          }
                        </button>
                      </div>
                    )}

                    {/* Resend notifications for already-paid orders */}
                    {order.payment_status === "paid" && (
                      <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5">
                        <Send size={14} className="shrink-0 text-blue-600" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-blue-800">Paziņojumi ražotājiem</p>
                          <p className="text-[10px] text-blue-600">Nosūtīt/atkārtoti nosūtīt e-pastus un push paziņojumus visiem ražotājiem</p>
                        </div>
                        <button
                          onClick={() => resendNotifications(order)}
                          disabled={resending === order.id}
                          className="flex shrink-0 items-center gap-1.5 rounded-full bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition disabled:opacity-60"
                        >
                          {resending === order.id
                            ? <><Loader2 size={11} className="animate-spin" /> Sūta...</>
                            : <><Send size={11} /> Nosūtīt paziņojumus</>
                          }
                        </button>
                      </div>
                    )}
                    {resendResult?.id === order.id && (
                      <div className={`rounded-xl px-4 py-2 text-xs ${resendResult.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>
                        {resendResult.ok ? "✓ " : "✗ "}{resendResult.msg}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 text-xs text-gray-400">
                          {order.paid_at
                            ? <><CheckCircle size={12} className="text-green-500" /> Apmaksāts {new Date(order.paid_at).toLocaleDateString("lv-LV")}</>
                            : <><Clock size={12} /> Gaida apmaksu</>
                          }
                        </div>
                        {order.payment_status && (() => {
                          const ps = paymentStatusMap[order.payment_status] ?? { label: order.payment_status, cls: "bg-gray-50 text-gray-500 border-gray-200" };
                          return (
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${ps.cls}`}>
                              💳 {ps.label}
                            </span>
                          );
                        })()}
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
