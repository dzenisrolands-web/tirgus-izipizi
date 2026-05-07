"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Package, ChevronDown, ChevronUp, MapPin } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatPrice } from "@/lib/utils";

type Order = {
  id: string;
  order_number: string;
  status: string;
  buyer_email: string;
  delivery_info: { locker_name?: string; locker_city?: string; address?: string } | null;
  items: { title: string; quantity: number; price: number }[];
  total_cents: number;
  paid_at: string | null;
  created_at: string;
};

const statusMap: Record<string, { label: string; cls: string }> = {
  pending:    { label: "Gaida apmaksu", cls: "bg-amber-100 text-amber-700" },
  paid:       { label: "Apmaksāts",     cls: "bg-blue-100 text-blue-700" },
  processing: { label: "Apstrādē",      cls: "bg-indigo-100 text-indigo-700" },
  shipped:    { label: "Pakomātā",      cls: "bg-purple-100 text-purple-700" },
  delivered:  { label: "Saņemts",       cls: "bg-green-100 text-green-700" },
  cancelled:  { label: "Atcelts",       cls: "bg-red-100 text-red-600" },
};

export function BuyerOrders() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login?next=/profils/pasutijumi");
        return;
      }
      const { data } = await supabase
        .from("orders").select("*")
        .eq("buyer_email", user.email ?? "")
        .order("created_at", { ascending: false });
      setOrders((data ?? []) as Order[]);
      setLoading(false);
    }
    load();
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 size={20} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <Link
          href="/profils"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft size={14} /> Atpakaļ uz kontu
        </Link>

        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-gray-900">Mani pasūtījumi</h1>
          <p className="mt-0.5 text-sm text-gray-500">{orders.length} {orders.length === 1 ? "pasūtījums" : "pasūtījumi"}</p>
        </div>

        {orders.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed border-gray-200 bg-white p-12 text-center">
            <Package size={36} className="mx-auto text-gray-300" />
            <p className="mt-4 font-semibold text-gray-900">Vēl nav neviena pasūtījuma</p>
            <p className="mt-1 text-sm text-gray-500">Sāc iepirkties no Latvijas ražotājiem</p>
            <Link href="/catalog" className="btn-primary mt-6 inline-block">
              Skatīt produktus
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => {
              const isOpen = expanded === order.id;
              const status = statusMap[order.status] ?? { label: order.status, cls: "bg-gray-100 text-gray-700" };
              return (
                <div
                  key={order.id}
                  className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100"
                >
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : order.id)}
                    className="flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-gray-50"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                      <Package size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-bold text-gray-900">#{order.order_number}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${status.cls}`}>
                          {status.label}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {new Date(order.created_at).toLocaleDateString("lv-LV", { day: "numeric", month: "long", year: "numeric" })}
                        {" · "}
                        {order.items.length} {order.items.length === 1 ? "produkts" : "produkti"}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-extrabold text-gray-900">{formatPrice(order.total_cents / 100)}</p>
                    </div>
                    {isOpen ? <ChevronUp size={16} className="shrink-0 text-gray-400" /> : <ChevronDown size={16} className="shrink-0 text-gray-400" />}
                  </button>

                  {isOpen && (
                    <div className="border-t border-gray-100 bg-gray-50 px-5 py-4">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Produkti</p>
                        <ul className="mt-2 space-y-1">
                          {order.items.map((it, i) => (
                            <li key={i} className="flex items-center justify-between gap-3 text-sm">
                              <span className="truncate text-gray-700">{it.title} <span className="text-gray-400">× {it.quantity}</span></span>
                              <span className="shrink-0 font-medium text-gray-900">{formatPrice(it.price * it.quantity)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {order.delivery_info && (
                        <div className="mt-4 border-t border-gray-200 pt-3">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Piegāde</p>
                          <div className="mt-1.5 flex items-start gap-2 text-sm text-gray-700">
                            <MapPin size={13} className="mt-0.5 shrink-0 text-gray-400" />
                            <div>
                              {order.delivery_info.locker_name && (
                                <p>{order.delivery_info.locker_name}</p>
                              )}
                              {order.delivery_info.locker_city && (
                                <p className="text-xs text-gray-500">{order.delivery_info.locker_city}</p>
                              )}
                              {order.delivery_info.address && (
                                <p className="text-xs text-gray-500">{order.delivery_info.address}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
