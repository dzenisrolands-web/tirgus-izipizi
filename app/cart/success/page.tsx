"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle, MapPin, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useCart } from "@/lib/cart-context";
import { formatPrice } from "@/lib/utils";

type Order = {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  buyer_name: string;
  buyer_email: string;
  delivery_type?: string;
  delivery_info: {
    locker_name?: string;
    locker_city?: string;
    locker_address?: string;
    address?: string;
    city?: string;
    postal_code?: string;
    method?: string;
    zone?: number;
  };
  total_cents: number;
};

export default function CartSuccessPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 size={28} className="animate-spin text-brand-600" />
      </div>
    }>
      <CartSuccessContent />
    </Suspense>
  );
}

function CartSuccessContent() {
  const params = useSearchParams();
  const orderNumber = params.get("order");
  const isMock = params.get("mock") === "1";

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [pollAttempt, setPollAttempt] = useState(0);
  const { clear } = useCart();

  // Clear cart on first render
  useEffect(() => {
    clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch order; poll a few times in case Paysera callback hasn't landed yet
  useEffect(() => {
    if (!orderNumber) { setLoading(false); return; }
    let cancelled = false;

    async function fetch() {
      const { data } = await supabase
        .from("orders")
        .select("id, order_number, status, payment_status, buyer_name, buyer_email, delivery_info, total_cents")
        .eq("order_number", orderNumber)
        .single();
      if (cancelled) return;
      if (data) setOrder(data as Order);
      setLoading(false);
    }

    fetch();

    // Poll every 2s for up to 20s if still awaiting
    const interval = setInterval(() => {
      setPollAttempt((p) => p + 1);
      fetch();
    }, 2000);
    const timeout = setTimeout(() => clearInterval(interval), 20_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [orderNumber]);

  if (!orderNumber) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-center">
        <p className="text-gray-500">Trūkst pasūtījuma numura.</p>
        <Link href="/" className="btn-primary mt-4 inline-block">Atpakaļ uz sākumu</Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 size={28} className="animate-spin text-brand-600" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-center">
        <AlertCircle size={40} className="mx-auto text-gray-300" />
        <h1 className="mt-3 text-xl font-extrabold text-gray-900">Pasūtījums nav atrasts</h1>
        <p className="mt-2 text-sm text-gray-500">Numurs <strong className="font-mono">{orderNumber}</strong> nav DB.</p>
        <Link href="/" className="btn-primary mt-6 inline-block">Atpakaļ uz sākumu</Link>
      </div>
    );
  }

  const isPaid = order.payment_status === "paid";

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <div className="flex flex-col items-center text-center">
        <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
          <CheckCircle size={40} className="text-green-500" />
          {isPaid && <span className="absolute inset-0 animate-ping rounded-full bg-green-100 opacity-50" />}
        </div>
        <h1 className="mt-5 text-2xl font-extrabold text-gray-900">
          {isPaid ? "Apmaksa veiksmīga!" : "Pasūtījums saņemts"}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Paldies, <strong>{order.buyer_name}</strong>! Apstiprinājums nosūtīts uz{" "}
          <strong>{order.buyer_email}</strong>.
        </p>
        <div className="mt-3 rounded-full bg-gray-100 px-4 py-1.5 text-sm font-mono font-semibold text-gray-700">
          {order.order_number}
        </div>
        {isMock && (
          <p className="mt-3 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
            Mock režīms (testēšanai) — reāli neviens nav norēķinājies
          </p>
        )}
        {!isPaid && (
          <p className="mt-3 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
            Apstrādē... ({pollAttempt}/10) Ja neapstrādājas, sazinies ar mums: birojs@izipizi.lv
          </p>
        )}
      </div>

      <div className="mt-8 rounded-2xl border border-gray-100 bg-white shadow-sm divide-y divide-gray-100">
        <div className="flex items-start gap-3 p-4">
          <MapPin size={18} className="mt-0.5 shrink-0 text-brand-600" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              {order.delivery_type === "courier" ? "Piegāde uz adresi" :
               order.delivery_type === "express" ? "Eksprespiegāde uz adresi" :
               "Saņemšanas vieta"}
            </p>
            {order.delivery_type === "locker" || !order.delivery_type ? (
              <>
                <p className="mt-0.5 font-semibold text-gray-900">
                  {order.delivery_info?.locker_city} — {order.delivery_info?.locker_name}
                </p>
                {order.delivery_info?.locker_address && (
                  <p className="text-sm text-gray-500">{order.delivery_info.locker_address}</p>
                )}
              </>
            ) : (
              <>
                <p className="mt-0.5 font-semibold text-gray-900">
                  {order.delivery_info?.address}
                </p>
                <p className="text-sm text-gray-500">
                  {order.delivery_info?.city}{order.delivery_info?.postal_code ? `, LV-${order.delivery_info.postal_code}` : ""}
                </p>
                {order.delivery_info?.zone !== undefined && (
                  <p className="mt-1 text-xs text-gray-400">Zona {order.delivery_info.zone}</p>
                )}
              </>
            )}
          </div>
        </div>
        <div className="flex items-start gap-3 p-4">
          <CheckCircle size={18} className="mt-0.5 shrink-0 text-gray-400" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Apmaksa</p>
            <p className={`mt-0.5 font-semibold ${isPaid ? "text-green-700" : "text-amber-700"}`}>
              {isPaid ? "Apmaksāts" : "Apstrādē"} · {formatPrice(order.total_cents / 100)}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl bg-gray-50 p-5">
        <p className="mb-4 text-xs font-bold uppercase tracking-wider text-gray-400">Kas notiek tālāk?</p>
        <div className="space-y-4">
          {[
            { n: 1, title: "Ražotājs apstiprina", desc: "1–2 darba dienu laikā saņemsi apstiprinājumu." },
            { n: 2, title: "Produkts tiek ievietots pakomātā", desc: `Tavs produkts tiks nogādāts uz ${order.delivery_info?.locker_city ?? ""} pakomātu.` },
            { n: 3, title: "Saņem locker kodu", desc: "Push paziņojumu / e-pastu ar PIN kodu, kad gatavs." },
          ].map(({ n, title, desc }) => (
            <div key={n} className="flex gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                style={{ background: "linear-gradient(135deg, #53F3A4, #AD47FF)", color: "#192635" }}>
                {n}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{title}</p>
                <p className="text-xs text-gray-500">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link href="/catalog" className="btn-primary flex-1 py-3 text-center">Turpināt iepirkties</Link>
        <Link href="/dashboard/pasutijumi" className="flex-1 rounded-2xl border border-gray-200 py-3 text-center text-sm font-semibold text-gray-700 hover:bg-gray-50">
          Skatīt pasūtījumus
        </Link>
      </div>
    </div>
  );
}
