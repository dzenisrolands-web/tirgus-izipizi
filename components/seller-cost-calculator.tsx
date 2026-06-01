"use client";

import { useState } from "react";
import { Calculator, Info } from "lucide-react";
import {
  COMMISSION_RATE,
  COURIER_FEE,
  commissionBreakdown,
} from "@/lib/commission";

type Props = {
  /** Whether the seller uses courier pickup (delivery_mode === "courier"). */
  isCourier: boolean;
};

const EXAMPLE_PRICES = [10, 25, 50];

/**
 * Inline cost calculator that shows the seller what they'll receive
 * per sale, accounting for commission + courier fee.
 *
 * Appears in seller profile and onboarding flow.
 */
export function SellerCostCalculator({ isCourier }: Props) {
  const [customPrice, setCustomPrice] = useState("");
  const parsed = parseFloat(customPrice.replace(",", "."));
  const prices = [...EXAMPLE_PRICES, ...(parsed > 0 && !EXAMPLE_PRICES.includes(parsed) ? [parsed] : [])];

  return (
    <div className="rounded-xl border border-brand-200 bg-gradient-to-br from-brand-50/60 to-white p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100">
          <Calculator size={15} className="text-brand-700" />
        </div>
        <div>
          <p className="text-sm font-bold text-gray-900">Izmaksu kalkulators</p>
          <p className="text-[11px] text-gray-500">Cik tu saņemsi par katru pārdošanu</p>
        </div>
      </div>

      {/* Rules summary */}
      <div className="flex items-start gap-2 rounded-lg bg-white border border-gray-100 px-3 py-2 text-xs text-gray-600">
        <Info size={13} className="mt-0.5 shrink-0 text-gray-400" />
        <div className="space-y-0.5">
          <p>Komisija: <strong>{COMMISSION_RATE}%</strong> no cenas bez PVN + 21% pakalpojuma PVN</p>
          {isCourier
            ? <p>Kurjera savakšana: <strong>{COURIER_FEE.toFixed(2)} €</strong> par pasūtījumu (1× neatkarīgi no produktu skaita)</p>
            : <p>Pakomāts: <strong>bez papildus maksas</strong> no tavas puses</p>
          }
        </div>
      </div>

      {/* Price examples */}
      <div className="space-y-1.5">
        {prices.map((price) => {
          const cb = commissionBreakdown(price, 21);
          const courier = isCourier ? COURIER_FEE : 0;
          const net = Math.round((cb.netToSeller - courier) * 100) / 100;
          return (
            <div key={price} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm border border-gray-50">
              <div className="flex items-baseline gap-2">
                <span className="font-mono font-bold text-gray-900">{price.toFixed(2)} €</span>
                <span className="text-[10px] text-gray-400">pārdošanas cena</span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-amber-600">−{cb.commissionTotal.toFixed(2)} €</span>
                {isCourier && <span className="text-gray-500">−{COURIER_FEE.toFixed(2)} €</span>}
                <span className="text-[10px] text-gray-300">→</span>
                <span className={`font-bold ${net > 0 ? "text-green-700" : "text-red-600"}`}>
                  {net.toFixed(2)} €
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Custom price input */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          inputMode="decimal"
          value={customPrice}
          onChange={(e) => setCustomPrice(e.target.value.replace(/[^0-9.,]/g, ""))}
          placeholder="Ievadi savu cenu..."
          className="input flex-1 text-sm font-mono"
        />
        <span className="text-xs text-gray-400 shrink-0">€</span>
      </div>

      {/* Mode note */}
      {isCourier && (
        <p className="text-[10px] text-amber-700 italic">
          Ja viens pircējs pasūta vairākus tavus produktus, kurjera maksa tiek iekasēta tikai 1× par pasūtījumu, nevis par katru produktu.
        </p>
      )}
    </div>
  );
}
