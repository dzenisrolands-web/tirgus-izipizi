"use client";

import Link from "next/link";
import { Package, Truck, Zap, CheckCircle, X, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  locker: { id: string; name: string; address: string; city: string; hours: string };
  price: number;
  isHomeLocker: boolean;
  expressAvailable?: boolean;
  courierAvailable?: boolean;
};

/**
 * Simplified delivery method indicator for product detail pages.
 * Shows which delivery methods are available for this product — no pricing.
 * Full pricing and locker selection happens during checkout.
 */
export function DeliveryChoice({ expressAvailable = false, courierAvailable = true }: Props) {
  return (
    <div>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
        Pieejamie piegādes veidi
      </p>

      <div className="grid grid-cols-3 gap-2">
        {/* Pakomāts — always available */}
        <div className="flex flex-col items-center gap-1.5 rounded-xl border-2 border-brand-200 bg-brand-50 p-3 text-center">
          <Package size={20} className="text-brand-700" />
          <p className="text-xs font-bold text-brand-700">Pakomāts</p>
          <p className="text-[10px] text-gray-500">24/7 piekļuve</p>
          <CheckCircle size={12} className="text-green-500" />
        </div>

        {/* Kurjers */}
        <div className={cn(
          "flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 text-center",
          courierAvailable ? "border-gray-200" : "border-gray-100 opacity-40"
        )}>
          <Truck size={20} className={courierAvailable ? "text-gray-600" : "text-gray-300"} />
          <p className={cn("text-xs font-bold", courierAvailable ? "text-gray-700" : "text-gray-400")}>
            Kurjers
          </p>
          {courierAvailable
            ? <p className="text-[10px] text-gray-500">Uz mājām</p>
            : <p className="text-[9px] text-gray-400">Ražotājs nenodrošina</p>
          }
          {courierAvailable ? <CheckCircle size={12} className="text-green-500" /> : <X size={12} className="text-gray-300" />}
        </div>

        {/* Ekspres */}
        <div className={cn(
          "flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 text-center",
          expressAvailable ? "border-gray-200" : "border-gray-100 opacity-40"
        )}>
          <Zap size={20} className={expressAvailable ? "text-yellow-600" : "text-gray-300"} />
          <p className={cn("text-xs font-bold", expressAvailable ? "text-yellow-700" : "text-gray-400")}>
            Ekspres
          </p>
          {expressAvailable
            ? <p className="text-[10px] text-gray-500">2–5h Rīgā</p>
            : <p className="text-[9px] text-gray-400">Ražotājs nenodrošina</p>
          }
          {expressAvailable ? <CheckCircle size={12} className="text-green-500" /> : <X size={12} className="text-gray-300" />}
        </div>
      </div>

      <Link href="/piegade" className="mt-2 flex items-center gap-1 text-xs text-brand-600 hover:underline">
        Detalizēta cenu informācija <ChevronRight size={12} />
      </Link>
    </div>
  );
}
