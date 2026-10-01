"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Package, ShoppingBag, CheckCircle, Clock, ChevronRight,
  Loader2, KeyRound, X, Send, AlertTriangle, User, Mail, Phone, MapPin,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatPrice } from "@/lib/utils";

type Seller = {
  id: string;
  name: string;
  email: string | null;
  location: string | null;
  status: string;
  legal_name: string | null;
  bank_iban: string | null;
};

type Order = {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  buyer_name: string;
  buyer_email: string;
  buyer_phone: string;
  delivery_info: { locker_name?: string; locker_city?: string };
  items: { title: string; quantity: number; price: number; unit?: string; seller_id?: string }[];
  total_cents: number;
  paid_at: string | null;
  created_at: string;
  locker_code: string | null;
};

const statusMap: Record<string, { label: string; cls: string }> = {
  pending:    { label: "Gaida apmaksu", cls: "bg-amber-100 text-amber-700" },
  awaiting:   { label: "Gaida apmaksu", cls: "bg-amber-100 text-amber-700" },
  paid:       { label: "Apmaksāts",     cls: "bg-green-100 text-green-700" },
  processing: { label: "Apstrādē",      cls: "bg-blue-100 text-blue-700" },
  shipped:    { label: "Nosūtīts",      cls: "bg-purple-100 text-purple-700" },
  delivered:  { label: "Piegādāts",     cls: "bg-gray-100 text-gray-600" },
  cancelled:  { label: "Atcelts",       cls: "bg-red-100 text-red-600" },
};

const NEXT_STATUS: Record<string, { label: string; next: string }> = {
  paid:       { label: "Apstiprināt pasūtījumu", next: "processing" },
  processing: { label: "Atzīmēt kā nosūtītu",   next: "shipped" },
  shipped:    { label: "Atzīmēt kā saņemtu",     next: "delivered" },
};

export default function AdminSellerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sellerId = params.id as string;

  const [seller, setSeller] = useState<Seller | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [shipDialog, setShipDialog] = useState<Order | null>(null);
  const [lockerCodeDraft, setLockerCodeDraft] = useState("");

  useEffect(() => {
    async function load() {
      const [sellerRes, ordersRes] = await Promise.all([
        supabase.from("sellers").select("id, name, email, location, status, legal_name, bank_iban").eq("id", sellerId).single(),
        supabase.from("orders").select("*").contains("seller_ids", [sellerId]).or("payment_status.eq.paid,status.in.(paid,processing,shipped,delivered,cancelled)").order("created_at", { ascending: false }),
      ]);
      setSeller(sellerRes.data);
      setOrders(ordersRes.data ?? []);
      setLoading(false);
    }
    load();
  }, [sellerId]);

  async function advanceStatus(orderId: string, nextStatus: string) {
    if (nextStatus === "shipped") {
      const order = orders.find((o) => o.id === orderId);
      if (order) { setShipDialog(order); setLockerCodeDraft(order.locker_code ?? ""); return; }
    }
    setUpdating(orderId);
    await supabase.from("orders").update({ status: nextStatus }).eq("id", orderId);
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: nextStatus } : o));
    setUpdating(null);
  }

  async function confirmShip() {
    if (!shipDialog) return;
    const code = lockerCodeDraft.trim();
    if (!code) return;
    setUpdating(shipDialog.id);
    await supabase.from("orders").update({ status: "shipped", locker_code: code }).eq("id", shipDialog.id);
    setOrders(prev => prev.map(o => o.id === shipDialog.id ? { ...o, status: "shipped", locker_code: code } : o));
    setShipDialog(null);
    setLockerCodeDraft("");
    setUpdating(null);
  }

  if (loading) return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 size={24} className="animate-spin text-gray-400" />
    </div>
  );

  if (!seller) return (
    <div className="mx-auto max-w-4xl px-4 py-12 text-center">
      <p className="text-gray-500">Ražotājs nav atrasts</p>
      <Link href="/admin/razotaji" className="btn-primary mt-4 inline-block">← Atpakaļ</Link>
    </div>
  );

  const totalRevenue = orders.reduce((s, o) => s + o.total_cents, 0);
  const pendingConfirm = orders.filter(o => o.status === "paid");

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
      {/* Header */}
      <div className="mb-6">
        <Link href="/admin/razotaji" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3">
          <ArrowLeft size={14} /> Ražotāji
        </Link>
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100">
            <User size={20} className="text-brand-600" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900">{seller.name}</h1>
            <p className="text-sm text-gray-500">
              {seller.location ?? "—"}
              {seller.email && <> · <Mail size={11} className="inline" /> {seller.email}</>}
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-gray-100 bg-white p-4">
          <p className="text-xs text-gray-500">Pasūtījumi</p>
          <p className="text-2xl font-extrabold text-gray-900">{orders.length}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4">
          <p className="text-xs text-gray-500">Apgrozījums</p>
          <p className="text-2xl font-extrabold text-gray-900">{formatPrice(totalRevenue / 100)}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4">
          <p className="text-xs text-gray-500">Gaida apstiprinājumu</p>
          <p className="text-2xl font-extrabold text-gray-900">{pendingConfirm.length}</p>
        </div>
      </div>

      {/* Pending warning */}
      {pendingConfirm.length > 0 && (
        <div className="mb-5 rounded-2xl border-2 border-red-300 bg-red-50 p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-600" />
            <p className="font-bold text-red-900">{pendingConfirm.length} pasūtījumi gaida apstiprinājumu</p>
          </div>
        </div>
      )}

      {/* Orders */}
      {orders.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-12 text-center">
          <ShoppingBag size={36} className="mx-auto text-gray-300" />
          <p className="mt-3 text-gray-400">Nav pasūtījumu</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map(order => {
            const st = statusMap[order.status] ?? statusMap.pending;
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
                        <p className="text-gray-500 flex items-center gap-1"><Mail size={11} /> {order.buyer_email}</p>
                        <p className="text-gray-500 flex items-center gap-1"><Phone size={11} /> {order.buyer_phone}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1">Piegāde</p>
                        <p className="font-medium text-gray-900 flex items-center gap-1"><MapPin size={11} /> {order.delivery_info?.locker_name}</p>
                        <p className="text-gray-500">{order.delivery_info?.locker_city}</p>
                        {order.locker_code && (
                          <p className="mt-1 font-mono font-bold text-brand-600">PIN: {order.locker_code}</p>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-2">Preces</p>
                      {order.items.map((item, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="text-gray-700">{item.title} × {item.quantity}</span>
                          <span className="font-medium text-gray-900">{formatPrice(item.price * item.quantity)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                      <div className="flex items-center gap-1.5 text-xs text-gray-400">
                        {order.paid_at
                          ? <><CheckCircle size={12} className="text-green-500" /> Apmaksāts {new Date(order.paid_at).toLocaleDateString("lv-LV")}</>
                          : <><Clock size={12} /> Gaida apmaksu</>}
                      </div>
                      <p className="font-extrabold text-gray-900">{formatPrice(order.total_cents / 100)}</p>
                    </div>
                    {NEXT_STATUS[order.status] && (
                      <button
                        onClick={() => advanceStatus(order.id, NEXT_STATUS[order.status].next)}
                        disabled={updating === order.id}
                        className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#192635] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#243647] transition disabled:opacity-60"
                      >
                        {updating === order.id ? <Loader2 size={14} className="animate-spin" /> : <ChevronRight size={14} />}
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

      {/* Ship dialog */}
      {shipDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <KeyRound size={16} className="text-brand-600" />
                <h3 className="font-bold text-gray-900">PIN kods — {shipDialog.order_number}</h3>
              </div>
              <button onClick={() => setShipDialog(null)} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
            </div>
            <input
              value={lockerCodeDraft}
              onChange={e => setLockerCodeDraft(e.target.value.replace(/\s/g, ""))}
              placeholder="123456"
              inputMode="numeric"
              className="input mt-4 w-full font-mono text-lg tracking-widest text-center"
              autoFocus
            />
            <div className="mt-4 flex gap-2">
              <button onClick={() => setShipDialog(null)} className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-700">Atcelt</button>
              <button onClick={confirmShip} disabled={!lockerCodeDraft.trim()}
                className="btn-primary flex flex-1 items-center justify-center gap-2 px-4 py-2.5 text-sm disabled:opacity-50">
                <Send size={14} /> Saglabāt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
