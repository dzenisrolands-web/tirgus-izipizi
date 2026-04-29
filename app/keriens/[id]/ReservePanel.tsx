"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, Loader2, ShoppingBag, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { availableQuantity } from "@/lib/hot-drops/types";
import type { HotDropWithSeller } from "@/lib/hot-drops/types";

export function ReservePanel({ drop }: { drop: HotDropWithSeller }) {
  const router = useRouter();
  const avail = availableQuantity(drop);
  const expired = new Date(drop.expires_at).getTime() < Date.now();

  const [qty, setQty] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  async function handleReserve() {
    setErrMsg("");
    setSubmitting(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push(`/login?next=/keriens/${drop.id}`);
      return;
    }

    try {
      const res = await fetch("/api/checkout/drop", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ dropId: drop.id, quantity: qty }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Rezervēšanas kļūda");
      }

      const { paymentUrl } = await res.json();
      // Redirect to Paysera (or mock success)
      window.location.href = paymentUrl;
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : "Kļūda — mēģini vēlreiz");
      setSubmitting(false);
    }
  }

  const unavailable = expired || avail <= 0;
  const total = (drop.price_cents * qty / 100).toFixed(2);

  return (
    <div className="flex flex-col gap-4">
      {/* Price */}
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-extrabold text-gray-900">
          €{(drop.price_cents / 100).toFixed(2)}
        </span>
        <span className="text-sm text-gray-500">/ {drop.unit}</span>
      </div>

      {/* Quantity picker */}
      {!unavailable && (
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-600">Daudzums:</span>
          <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-1">
            <button onClick={() => setQty((q) => Math.max(1, q - 1))}
              disabled={qty <= 1}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-30 transition">
              <Minus size={14} />
            </button>
            <span className="w-8 text-center text-sm font-bold">{qty}</span>
            <button onClick={() => setQty((q) => Math.min(avail, q + 1))}
              disabled={qty >= avail}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-30 transition">
              <Plus size={14} />
            </button>
          </div>
          <span className="text-xs text-gray-400">{avail} pieejami</span>
        </div>
      )}

      {/* Total */}
      {!unavailable && qty > 1 && (
        <p className="text-sm text-gray-500">
          Kopā: <span className="font-bold text-gray-900">€{total}</span>
        </p>
      )}

      {/* Error */}
      {errMsg && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          {errMsg}
        </div>
      )}

      {/* CTA */}
      {unavailable ? (
        <button disabled
          className="flex items-center justify-center rounded-xl bg-gray-100 py-3 text-sm font-bold text-gray-400 cursor-not-allowed">
          {expired ? "Sludinājums beidzies" : "Izpārdots"}
        </button>
      ) : (
        <button
          onClick={handleReserve}
          disabled={submitting}
          className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 py-3 text-sm font-bold text-white shadow-md hover:opacity-90 active:scale-95 disabled:opacity-60 transition-all">
          {submitting
            ? <><Loader2 size={16} className="animate-spin" /> Pārvirza uz Paysera...</>
            : <><ShoppingBag size={16} /> Rezervēt un maksāt — €{total}</>}
        </button>
      )}

      <p className="text-center text-[11px] text-gray-400">
        🔒 Droša apmaksa caur Paysera · Saņemšana pakomātā
      </p>
    </div>
  );
}
