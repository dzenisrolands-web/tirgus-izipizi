"use client";

import { useState } from "react";
import Link from "next/link";
import { Package, Truck, MapPin, Clock, Thermometer, Tag, ChevronRight } from "lucide-react";
import { type Locker } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

type Props = {
  locker: Locker;
  price: number;
};

const COURIER_FEE = 4.50;
const LOCKER_FEE = 3.00;

export function DeliveryChoice({ locker }: Props) {
  const [selected, setSelected] = useState<"locker" | "courier">("locker");
  const [address, setAddress] = useState("");

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
        Piegādes veids
      </p>

      <div className="grid grid-cols-2 gap-2">
        {/* Locker option */}
        <button
          onClick={() => setSelected("locker")}
          className={cn(
            "flex flex-col items-start rounded-xl border-2 p-3 text-left transition",
            selected === "locker"
              ? "border-brand-400 bg-brand-400/5"
              : "border-gray-200 hover:border-gray-300"
          )}
        >
          <Package size={18} className={selected === "locker" ? "text-brand-700" : "text-gray-400"} />
          <p className={cn("mt-1.5 text-xs font-bold", selected === "locker" ? "text-brand-700" : "text-gray-700")}>
            Pakomāts
          </p>
          <p className="text-xs text-gray-500">24/7 piekļuve</p>
          <div className="mt-2 flex items-center gap-1">
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold text-[#192635]"
              style={{ background: "linear-gradient(90deg, #53F3A4, #AD47FF)" }}
            >
              Akcija
            </span>
            <span className="text-xs font-bold text-gray-900">{LOCKER_FEE.toFixed(2)} €</span>
          </div>
        </button>

        {/* Courier option */}
        <button
          onClick={() => setSelected("courier")}
          className={cn(
            "flex flex-col items-start rounded-xl border-2 p-3 text-left transition",
            selected === "courier"
              ? "border-gray-800 bg-gray-50"
              : "border-gray-200 hover:border-gray-300"
          )}
        >
          <Truck size={18} className={selected === "courier" ? "text-gray-800" : "text-gray-400"} />
          <p className={cn("mt-1.5 text-xs font-bold", selected === "courier" ? "text-gray-800" : "text-gray-700")}>
            Kurjers
          </p>
          <p className="text-xs text-gray-500">Uz mājas adresi</p>
          <p className="mt-2 text-xs font-bold text-gray-900">no {COURIER_FEE.toFixed(2)} €</p>
        </button>
      </div>

      {/* Locker detail */}
      {selected === "locker" && (
        <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50 p-3">
          <div className="flex items-start gap-2">
            <MapPin size={15} className="mt-0.5 shrink-0 text-brand-600" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">{locker.name}</p>
              <p className="text-xs text-gray-500">{locker.address}</p>
            </div>
            <span className="flex items-center gap-0.5 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">
              <Clock size={9} />
              {locker.hours}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-400">
            <Thermometer size={11} />
            +2°C līdz +6°C · saldēts −18°C
          </div>
          <div className="mt-2 flex items-center gap-1 text-xs text-brand-600">
            <Tag size={10} />
            <span>Piegāde uz pakomātu — <strong>3.00 €</strong> (akcijas cena)</span>
          </div>
        </div>
      )}

      {/* Courier detail */}
      {selected === "courier" && (
        <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50 p-3 space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-700">Piegādes adrese</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Iela, māja, pilsēta, pasta indekss"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
            />
          </div>
          <div className="rounded-lg bg-white border border-gray-100 p-2.5 text-xs text-gray-600 space-y-1">
            <p className="font-semibold text-gray-700">Orientējošās cenas (+PVN):</p>
            <p>Rīga (Zona 0) — no <strong>4.50 €</strong></p>
            <p>Pierīga / Jūrmala (Zona 1) — no <strong>5.50 €</strong></p>
            <p>Pārējā Latvija (Zona 2) — no <strong>7.50 €</strong></p>
          </div>
          <Link
            href="/piegade"
            className="flex items-center gap-1 text-xs text-brand-600 hover:underline"
          >
            Detalizēta cenu tabula
            <ChevronRight size={12} />
          </Link>
        </div>
      )}
    </div>
  );
}
