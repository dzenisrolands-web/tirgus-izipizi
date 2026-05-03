"use client";

import { useState } from "react";
import Link from "next/link";
import { Package, Truck, MapPin, Clock, Thermometer, ChevronRight, Home, ArrowRight, Zap, CheckCircle, Edit3, X } from "lucide-react";
import { type Locker } from "@/lib/mock-data";
import { cn, LOCKER_FEE, COURIER_BASE_FEE } from "@/lib/utils";
import { useBuyerAddress } from "@/lib/buyer-address-context";
import { effectiveCourierZone, pricingForZone, LOCKER_ZONES, nearestLockersForCode } from "@/lib/postal-zones";
import { LvAddressAutocomplete, type ParsedAddress } from "@/components/lv-address-autocomplete";

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
  const { address: buyerAddress, setAddress: setBuyerAddress } = useBuyerAddress();
  const [editAddressOpen, setEditAddressOpen] = useState(false);
  const [addressDraft, setAddressDraft] = useState("");

  function handleAddressSelect(parsed: ParsedAddress) {
    if (parsed.postalCode && parsed.postalCode.length === 4) {
      setBuyerAddress({
        postalCode: parsed.postalCode,
        city: parsed.city,
        fullText: parsed.fullText,
      });
      setEditAddressOpen(false);
      setAddressDraft("");
    }
  }

  const lockerFee = LOCKER_FEE;

  // Compute effective courier zone = MAX(seller pakomāts zona, pircēja zona)
  const effectiveZone = effectiveCourierZone(locker.id, buyerAddress?.zone);
  const effectivePricing = pricingForZone(effectiveZone);
  const sellerZone = LOCKER_ZONES[locker.id];

  // 3 nearest lockers to buyer (when address is set)
  const nearestLockers = (() => {
    if (!buyerAddress?.postalCode) return [];
    const code = parseInt(buyerAddress.postalCode, 10);
    if (isNaN(code)) return [];
    const fallbackZone = buyerAddress.zone ?? 3;
    return nearestLockersForCode(code, fallbackZone, 3);
  })();

  // Display fees: prefer effective if both known, else fall back to "from X"
  const courierFeeDisplay = effectivePricing ? effectivePricing.singleTemp : null;
  const courierFeeDual = effectivePricing ? effectivePricing.dualTemp : null;
  const expressFeeDisplay = effectivePricing && effectivePricing.expressSingle !== null
    ? effectivePricing.expressSingle
    : null;
  const isExpressAvailableNow = expressAvailable && effectiveZone !== null && effectiveZone <= 2;
  const courierAvailableNow = effectiveZone !== null;

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
            <span className="text-xs font-bold text-gray-900">no {lockerFee.toFixed(2)} €</span>
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
          <p className="mt-2 text-xs font-bold text-gray-900">
            {courierFeeDisplay !== null
              ? `${courierFeeDisplay.toFixed(2)} €`
              : `no ${COURIER_BASE_FEE.toFixed(2)} €`}
          </p>
          {effectiveZone !== null && (
            <p className="mt-0.5 text-[9px] text-gray-400">
              Z{effectiveZone}{sellerZone !== undefined && buyerAddress?.zone !== null && buyerAddress?.zone !== undefined && sellerZone !== buyerAddress.zone
                ? ` · MAX(Z${sellerZone}, Z${buyerAddress.zone})`
                : ""}
            </p>
          )}
        </button>

        {/* Express option */}
        {expressAvailable && (
          <button
            onClick={() => setSelected("express")}
            disabled={effectiveZone !== null && !isExpressAvailableNow}
            className={cn(
              "flex flex-col items-start rounded-xl border-2 p-3 text-left transition",
              selected === "express"
                ? "border-yellow-400 bg-yellow-50"
                : "border-gray-200 hover:border-yellow-200",
              effectiveZone !== null && !isExpressAvailableNow && "opacity-40 cursor-not-allowed"
            )}
          >
            <Zap size={16} className={selected === "express" ? "text-yellow-600" : "text-gray-400"} />
            <p className={cn("mt-1.5 text-xs font-bold", selected === "express" ? "text-yellow-700" : "text-gray-700")}>
              Ekspres
            </p>
            <p className="text-xs text-gray-500">2–5h Rīgā</p>
            <p className="mt-2 text-xs font-bold text-gray-900">
              {expressFeeDisplay !== null
                ? `${expressFeeDisplay.toFixed(2)} €`
                : effectiveZone !== null && !isExpressAvailableNow
                  ? "Nav pieejams"
                  : `no ${EXPRESS_FEE.toFixed(2)} €`}
            </p>
          </button>
        )}
      </div>

      {/* Buyer address hint */}
      {!buyerAddress && (
        <div className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-[11px] text-blue-800">
          💡 Ievadi savu adresi augšā, lai redzētu īsto piegādes cenu.
        </div>
      )}
      {buyerAddress && effectiveZone !== null && (
        <div className="mt-2 rounded-lg bg-green-50 px-3 py-1.5 text-[11px] text-green-800">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <CheckCircle size={11} className="shrink-0" />
              <span className="truncate">
                Cenas tavai adresei <strong>{buyerAddress.city || `LV-${buyerAddress.postalCode}`}</strong>
                {effectiveZone !== buyerAddress.zone && (
                  <span className="text-green-700"> · zona pielāgota pēc ražotāja vietas</span>
                )}
              </span>
            </div>
            <button
              onClick={() => setEditAddressOpen((v) => !v)}
              className="flex shrink-0 items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-green-700 hover:bg-green-100 transition"
            >
              {editAddressOpen ? <X size={10} /> : <Edit3 size={10} />}
              {editAddressOpen ? "Aizvērt" : "Mainīt adresi"}
            </button>
          </div>
          {editAddressOpen && (
            <div className="mt-2 rounded-lg bg-white p-2">
              <LvAddressAutocomplete
                value={addressDraft}
                onChange={setAddressDraft}
                onSelect={handleAddressSelect}
                placeholder="Sāc rakstīt jaunu adresi"
              />
            </div>
          )}
        </div>
      )}
      {buyerAddress && !courierAvailableNow && (
        <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
          ⚠️ Tavā adresē kurjers nav pieejams — vari saņemt pakomātā par {LOCKER_FEE.toFixed(2)} €.
        </div>
      )}

      {/* Locker detail */}
      {selected === "locker" && (
        <div className="mt-3 space-y-3 rounded-xl border border-gray-100 bg-gray-50 p-3">
          {/* Buyer's nearest lockers */}
          {nearestLockers.length > 0 ? (
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-brand-700">
                Saņem savā tuvākajā pakomātā · no {LOCKER_FEE.toFixed(2)} €
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {nearestLockers.map((l, idx) => (
                  <div
                    key={l.id}
                    className={cn(
                      "relative flex flex-col rounded-lg p-2 text-left ring-1",
                      idx === 0
                        ? "bg-brand-50 ring-brand-300"
                        : "bg-white ring-gray-200"
                    )}
                  >
                    <div className="flex items-center gap-1">
                      <span className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-extrabold",
                        idx === 0
                          ? "bg-gradient-to-br from-[#53F3A4] to-[#AD47FF] text-white"
                          : "bg-gray-100 text-gray-400"
                      )}>
                        {idx + 1}
                      </span>
                      <p className="text-[11px] font-bold text-gray-900 truncate">{l.name}</p>
                    </div>
                    <p className="mt-1 text-center font-mono text-sm font-extrabold text-gray-700">
                      ~{l.distanceKm.toFixed(1)} <span className="text-[9px] text-gray-400">km</span>
                    </p>
                    <div className="mt-0.5 flex items-center gap-0.5 text-[9px] text-gray-400">
                      <Clock size={8} /> {l.hours}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
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
            </>
          )}
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
            <p className="text-[10px] text-gray-400 pt-0.5">PVN iekļauts · Zonā 3 nav pieejama</p>
          </div>
          <p className="text-[10px] text-yellow-700">
            Zona 0: pieteikties iepriekšējā dienā līdz 20:00.
            Laika logi: 09:00–12:00, 12:00–18:00, 18:00–22:00.
          </p>
          <Link href="/piegade" className="flex items-center gap-1 text-xs text-yellow-700 hover:underline">
            Detalizēta informācija <ChevronRight size={12} />
          </Link>
        </div>
      )}

      {/* Courier detail */}
      {selected === "courier" && (
        <div className="mt-3 space-y-3 rounded-xl border border-gray-100 bg-gray-50 p-3">
          {courierFeeDisplay !== null ? (
            <div className="rounded-lg border border-green-200 bg-green-50 p-2.5 text-xs text-green-800 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold">Tava cena (Zona {effectiveZone}):</span>
                <strong className="font-mono text-base">{courierFeeDisplay.toFixed(2)} €</strong>
              </div>
              {sellerZone !== undefined && buyerAddress?.zone !== null && buyerAddress?.zone !== undefined && sellerZone !== buyerAddress.zone && (
                <p className="text-[10px] text-green-700">
                  Zona aprēķināta pēc dārgākā galapunkta: ražotājs Z{sellerZone} ↔ tu Z{buyerAddress.zone}
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-gray-100 bg-white p-2.5 text-xs text-gray-600 space-y-1">
              <p>Zona 0 (Rīgas centrs) — no <strong>5.45€</strong></p>
              <p>Zona 1 (Rīgas mikrorajoni + Pierīga) — no <strong>6.66€</strong></p>
              <p>Zona 2 (Tālākā Pierīga) — no <strong>9.08€</strong></p>
              <p>Zona 3 (Reģionālā Latvija) — no <strong>10.77€</strong></p>
              <p className="text-[10px] text-gray-400 pt-0.5">PVN iekļauts · ievadi adresi, lai redzētu savu cenu</p>
            </div>
          )}
          <Link href="/piegade" className="flex items-center gap-1 text-xs text-brand-600 hover:underline">
            Detalizēta cenu tabula <ChevronRight size={12} />
          </Link>
        </div>
      )}
    </div>
  );
}
