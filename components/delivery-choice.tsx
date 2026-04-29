"use client";

import { useState } from "react";
import Link from "next/link";
import { Package, Truck, MapPin, Clock, Thermometer, ChevronRight, Home, ArrowRight, Zap } from "lucide-react";
import { type Locker } from "@/lib/mock-data";
import { cn, LOCKER_FEE, COURIER_BASE_FEE } from "@/lib/utils";

const EXPRESS_FEE = 9.08;

type Props = {
  locker: Locker;
  price: number;
  isHomeLocker: boolean;
  expressAvailable?: boolean;
};

export function DeliveryChoice({ locker, isHomeLocker, expressAvailable = false }: Props) {
  const [selected, setSelected] = useState<"locker" | "courier" | "express">("locker");
  const [address, setAddress] = useState("");

  const lockerFee = LOCKER_FEE;

  return (
    <div>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
        Piegādes veids
      </p>

      <div className={cn("grid gap-2", expressAvailable ? "grid-cols-3" : "grid-cols-2")}>
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
          <div className="flex items-center gap-1.5">
            <Package size={16} className={selected === "locker" ? "text-brand-700" : "text-gray-400"} />
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold text-[#192635]"
              style={{ background: "linear-gradient(90deg, #53F3A4, #AD47FF)" }}
            >
              Lētākā
            </span>
          </div>
          <p className={cn("mt-1.5 text-xs font-bold", selected === "locker" ? "text-brand-700" : "text-gray-700")}>
            Pārtikas pakomāts
          </p>
          <p className="text-xs text-gray-500">24/7 piekļuve</p>
          <div className="mt-2">
            <span className="text-xs font-bold text-gray-900">{lockerFee.toFixed(2)} €</span>
            <span className="ml-1 text-[10px] text-gray-400">par skapīti</span>
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
          <Truck size={16} className={selected === "courier" ? "text-gray-800" : "text-gray-400"} />
          <p className={cn("mt-1.5 text-xs font-bold", selected === "courier" ? "text-gray-800" : "text-gray-700")}>
            Kurjers
          </p>
          <p className="text-xs text-gray-500">Uz mājas adresi</p>
          <p className="mt-2 text-xs font-bold text-gray-900">no {COURIER_BASE_FEE.toFixed(2)} €</p>
        </button>

        {/* Express option */}
        {expressAvailable && (
          <button
            onClick={() => setSelected("express")}
            className={cn(
              "flex flex-col items-start rounded-xl border-2 p-3 text-left transition",
              selected === "express"
                ? "border-yellow-400 bg-yellow-50"
                : "border-gray-200 hover:border-yellow-200"
            )}
          >
            <Zap size={16} className={selected === "express" ? "text-yellow-600" : "text-gray-400"} />
            <p className={cn("mt-1.5 text-xs font-bold", selected === "express" ? "text-yellow-700" : "text-gray-700")}>
              Ekspres
            </p>
            <p className="text-xs text-gray-500">2–5h Rīgā</p>
            <p className="mt-2 text-xs font-bold text-gray-900">no {EXPRESS_FEE.toFixed(2)} €</p>
          </button>
        )}
      </div>

      {/* Locker detail */}
      {selected === "locker" && (
        <div className="mt-3 space-y-2 rounded-xl border border-gray-100 bg-gray-50 p-3">
          <div className="flex items-start gap-2">
            <div className={cn(
              "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
              isHomeLocker ? "bg-brand-100" : "bg-gray-200"
            )}>
              {isHomeLocker
                ? <Home size={12} className="text-brand-700" />
                : <MapPin size={12} className="text-gray-500" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-semibold text-gray-900">{locker.name}</p>
                {isHomeLocker && (
                  <span className="rounded-full bg-brand-50 px-1.5 py-0.5 text-[9px] font-bold text-brand-700">
                    Mājas pakomāts
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500">{locker.address} · {locker.city}</p>
            </div>
            <span className="flex items-center gap-0.5 shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">
              <Clock size={9} /> {locker.hours}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Thermometer size={11} />
            +2°C līdz +6°C · saldēts −18°C
          </div>

          <div className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">
            <strong>Pakomāta piegādes maksa: {LOCKER_FEE.toFixed(2)} €</strong> par skapīti.
            {" "}Ja pasūtījumā ir gan dzesēti, gan saldēti produkti, tiks rezervēti
            <strong> 2 skapīši</strong> ({(LOCKER_FEE * 2).toFixed(2)} €).
            <Link href="/piegade" className="ml-1.5 inline-flex items-center gap-0.5 underline">
              Uzzināt vairāk <ArrowRight size={10} />
            </Link>
          </div>
        </div>
      )}

      {/* Express detail */}
      {selected === "express" && (
        <div className="mt-3 space-y-2 rounded-xl border border-yellow-200 bg-yellow-50 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-yellow-800">
            <Zap size={13} className="text-yellow-600" />
            Tajā pašā dienā · Rīga un apkārtne
          </div>
          <div className="rounded-lg border border-yellow-100 bg-white p-2.5 text-xs text-gray-600 space-y-1">
            <p>Zona 0 (Rīgas centrs) — <strong>no 9.08€</strong></p>
            <p>Zona 1 (Rīgas mikrorajoni + Pierīga) — <strong>no 10.89€</strong></p>
            <p>Zona 2 (Tālākā Pierīga) — <strong>no 15.13€</strong></p>
            <p className="text-[10px] text-gray-400 pt-0.5">PVN iekļauts</p>
          </div>
          <p className="text-[10px] text-yellow-700">
            Zona 0: pieteikties iepriekšējā dienā līdz 20:00.
            Laika logi: 09:00–12:00, 12:00–18:00, 18:00–22:00.
          </p>
          <Link href="/piegade#ekspres" className="flex items-center gap-1 text-xs text-yellow-700 hover:underline">
            Detalizēta informācija <ChevronRight size={12} />
          </Link>
        </div>
      )}

      {/* Courier detail */}
      {selected === "courier" && (
        <div className="mt-3 space-y-3 rounded-xl border border-gray-100 bg-gray-50 p-3">
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
          <div className="rounded-lg border border-gray-100 bg-white p-2.5 text-xs text-gray-600 space-y-1">
            <p>Zona 0 (Rīgas centrs) — no <strong>7.74€</strong></p>
            <p>Zona 1 (Rīgas mikrorajoni + Pierīga) — no <strong>7.74€</strong></p>
            <p>Zona 2 (Tālākā Pierīga) — no <strong>10.16€</strong></p>
            <p>Zona 3 (Reģionālā Latvija) — no <strong>11.98€</strong></p>
            <p className="text-[10px] text-gray-400 pt-0.5">PVN iekļauts</p>
          </div>
          <Link href="/piegade" className="flex items-center gap-1 text-xs text-brand-600 hover:underline">
            Detalizēta cenu tabula <ChevronRight size={12} />
          </Link>
        </div>
      )}
    </div>
  );
}
