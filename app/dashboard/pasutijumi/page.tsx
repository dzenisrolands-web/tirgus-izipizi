"use client";

import { useEffect, useState } from "react";
import { ShoppingBag, Clock, CheckCircle, Package, ChevronRight, Loader2, KeyRound, X, Send } from "lucide-react";
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
  items: { title: string; quantity: number; price: number; unit: string }[];
  total_cents: number;
  paid_at: string | null;
  created_at: string;
  locker_code: string | null;
};

const statusMap: Record<string, { label: string; cls: string }> = {
  pending:    { label: "Gaida apmaksu", cls: "bg-amber-100 text-amber-700" },
  paid:       { label: "Apmaksāts",     cls: "bg-green-100 text-green-700" },
  processing: { label: "Apstrādē",      cls: "bg-blue-100 text-blue-700" },
  shipped:    { label: "Nosūtīts",      cls: "bg-purple-100 text-purple-700" },
  delivered:  { label: "Piegādāts",     cls: "bg-gray-100 text-gray-600" },
  cancelled:  { label: "Atcelts",       cls: "bg-red-100 text-red-600" },
};

export default function DashboardPasutijumiPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [shipDialog, setShipDialog] = useState<Order | null>(null);
  const [lockerCodeDraft, setLockerCodeDraft] = useState("");

  const NEXT_STATUS: Record<string, { label: string; next: string }> = {
    paid:       { label: "Apstiprināt pasūtījumu", next: "processing" },
    processing: { label: "Atzīmēt kā nosūtītu",   next: "shipped" },
    shipped:    { label: "Atzīmēt kā saņemtu",     next: "delivered" },
  };

  async function notifyBuyer(orderId: string, status: string) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;
      await fetch("/api/notify/order-status", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ orderId, status }),
      });
    } catch (e) {
      console.error("notify failed", e);
    }
  }

  async function advanceStatus(orderId: string, nextStatus: string) {
    // If marking as shipped, require locker code first
    if (nextStatus === "shipped") {
      const order = orders.find((o) => o.id === orderId);
      if (order) {
        setShipDialog(order);
        setLockerCodeDraft(order.locker_code ?? "");
        return;
      }
    }
    setUpdating(orderId);
    await supabase.from("orders").update({ status: nextStatus }).eq("id", orderId);
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: nextStatus } : o));
    notifyBuyer(orderId, nextStatus); // fire and forget
    setUpdating(null);
  }

  async function confirmShip() {
    if (!shipDialog) return;
    const code = lockerCodeDraft.trim();
    if (!code) return;
    setUpdating(shipDialog.id);
    await supabase
      .from("orders")
      .update({ status: "shipped", locker_code: code })
      .eq("id", shipDialog.id);
    setOrders((prev) =>
      prev.map((o) => (o.id === shipDialog.id ? { ...o, status: "shipped", locker_code: code } : o)),
    );
    notifyBuyer(shipDialog.id, "shipped"); // fire and forget
    setShipDialog(null);
    setLockerCodeDraft("");
    setUpdating(null);
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data: seller } = await supabase
        .from("sellers").select("id").eq("user_id", user.id).single();
      if (!seller) { setLoading(false); return; }
      const { data } = await supabase
        .from("orders").select("*")
        .contains("seller_ids", [seller.id])
        .order("created_at", { ascending: false });
      setOrders(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
    </div>
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900">Pasūtījumi</h1>
        <p className="mt-0.5 text-sm text-gray-500">{orders.length} kopā</p>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-16 text-center">
          <ShoppingBag size={40} className="mx-auto text-gray-300" />
          <p className="mt-3 font-semibold text-gray-900">Vēl nav pasūtījumu</p>
          <p className="mt-1 text-sm text-gray-400">Kad pircēji pasūtīs tavus produktus, tie parādīsies šeit</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
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
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900">{order.order_number}</p>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${st.cls}`}>{st.label}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {order.buyer_name} · {new Date(order.created_at).toLocaleDateString("lv-LV")}
                      {order.delivery_info?.locker_city && ` · ${order.delivery_info.locker_city}`}
                    </p>
                  </div>
                  <p className="shrink-0 font-bold text-gray-900">{formatPrice(order.total_cents / 100)}</p>
                </button>

                {isOpen && (
                  <div className="border-t border-gray-100 px-5 py-4 space-y-3 bg-gray-50">
                    <div className="grid grid-cols-2 gap-3 text-sm">
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
                            <span className="font-medium text-gray-900">{formatPrice(item.price * item.quantity)}</span>
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
                      <p className="font-extrabold text-gray-900">{formatPrice(order.total_cents / 100)}</p>
                    </div>
                    {NEXT_STATUS[order.status] && (
                      <button
                        onClick={() => advanceStatus(order.id, NEXT_STATUS[order.status].next)}
                        disabled={updating === order.id}
                        className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#192635] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#243647] transition disabled:opacity-60"
                      >
                        {updating === order.id
                          ? <Loader2 size={14} className="animate-spin" />
                          : <ChevronRight size={14} />}
                        {NEXT_STATUS[order.status].label}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Locker code dialog */}
      {shipDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100">
                  <KeyRound size={16} className="text-brand-600" />
                </div>
                <div>
                  <h3 className="font-extrabold text-gray-900">Atzīmēt kā ievietotu pakomātā</h3>
                  <p className="text-xs text-gray-500">{shipDialog.order_number}</p>
                </div>
              </div>
              <button onClick={() => setShipDialog(null)}
                className="text-gray-400 hover:text-gray-700">
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
              <p className="font-semibold">Saņemšanas vieta:</p>
              <p className="text-xs">{shipDialog.delivery_info?.locker_city} — {shipDialog.delivery_info?.locker_name}</p>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700">PIN kods pakomātam *</label>
              <p className="mt-1 text-xs text-gray-500">
                Pircējs saņems push paziņojumu ar šo kodu, lai izņemtu pasūtījumu.
              </p>
              <input
                value={lockerCodeDraft}
                onChange={(e) => setLockerCodeDraft(e.target.value.replace(/\s/g, ""))}
                placeholder="123456"
                inputMode="numeric"
                className="input mt-2 w-full font-mono text-lg tracking-widest text-center"
                autoFocus
              />
            </div>

            <div className="mt-5 flex gap-2">
              <button onClick={() => setShipDialog(null)}
                className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Atcelt
              </button>
              <button onClick={confirmShip}
                disabled={!lockerCodeDraft.trim() || updating === shipDialog.id}
                className="btn-primary flex flex-1 items-center justify-center gap-2 px-4 py-2.5 text-sm disabled:opacity-50">
                {updating === shipDialog.id
                  ? <Loader2 size={14} className="animate-spin" />
                  : <Send size={14} />}
                Saglabāt un paziņot
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
