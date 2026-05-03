"use client";

import { useState } from "react";
import { MapPin, X, Edit3, CheckCircle, ChevronDown } from "lucide-react";
import { useBuyerAddress } from "@/lib/buyer-address-context";
import { LvAddressAutocomplete, type ParsedAddress } from "@/components/lv-address-autocomplete";

/**
 * Floating buyer address prompt — shows on top of pages until user enters or dismisses.
 * Once an address is set, becomes a small persistent indicator chip.
 */
export function BuyerAddressPrompt() {
  const { address, setAddress, clear, promptDismissed, dismissPrompt } = useBuyerAddress();
  const [open, setOpen] = useState(false);
  const [addressText, setAddressText] = useState("");

  function handleSelect(parsed: ParsedAddress) {
    if (parsed.postalCode && parsed.postalCode.length === 4) {
      setAddress({
        postalCode: parsed.postalCode,
        city: parsed.city,
        fullText: parsed.fullText,
      });
      setOpen(false);
      setAddressText("");
    }
  }

  // ─── Persistent chip when address is set ──────────────────────
  if (address) {
    const zoneLabel = address.outsideZones
      ? "Pārējā Latvija — tikai pakomāts"
      : address.zone !== null
        ? `Zona ${address.zone} · ${address.pricing?.area ?? ""}`
        : `LV-${address.postalCode}`;
    return (
      <div className="border-b border-gray-100 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 text-xs">
            <MapPin size={12} className="text-brand-600" />
            <span className="text-gray-500">Tava adrese:</span>
            <span className="font-semibold text-gray-900 truncate max-w-[200px] sm:max-w-none">
              {address.city || `LV-${address.postalCode}`}
            </span>
            <span className="text-gray-300">·</span>
            <span className={`text-[11px] font-semibold ${address.outsideZones ? "text-gray-500" : "text-brand-700"}`}>
              {zoneLabel}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setOpen(true)}
              className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] text-gray-500 hover:bg-gray-100"
              title="Mainīt adresi"
            >
              <Edit3 size={10} /> Mainīt
            </button>
            <button
              onClick={() => clear()}
              className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              title="Noņemt adresi"
            >
              <X size={11} />
            </button>
          </div>
        </div>

        {/* Edit popover */}
        {open && (
          <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl">
              <p className="mb-2 text-xs font-semibold text-gray-700">
                Mainīt adresi
              </p>
              <LvAddressAutocomplete
                value={addressText}
                onChange={setAddressText}
                onSelect={handleSelect}
                placeholder="Sāc rakstīt jaunu adresi"
              />
              <button
                onClick={() => setOpen(false)}
                className="mt-2 text-[11px] text-gray-500 hover:text-gray-900"
              >
                Aizvērt
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Initial prompt — collapsed by default if dismissed ───────
  if (promptDismissed && !open) {
    return (
      <div className="border-b border-gray-100 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8">
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-900"
          >
            <MapPin size={12} className="text-gray-400" />
            <span>Ievadi savu adresi, lai redzētu piegādes cenas</span>
            <ChevronDown size={11} />
          </button>
        </div>
        {open && (
          <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl">
              <LvAddressAutocomplete
                value={addressText}
                onChange={setAddressText}
                onSelect={handleSelect}
                placeholder="Piem., Brīvības iela 100, Rīga"
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Default — full banner ────────────────────────────────────
  return (
    <div className="border-b border-amber-100 bg-gradient-to-r from-amber-50 via-white to-brand-50">
      <div className="mx-auto flex flex-col items-start gap-3 px-4 py-3 sm:flex-row sm:items-center sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 flex-1">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-100">
            <MapPin size={16} className="text-brand-700" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900">
              Ievadi savu adresi, lai redzētu īstās cenas
            </p>
            <p className="text-xs text-gray-600">
              Katram produktam rādīsim, cik maksās piegāde tieši pie tevis.
            </p>
          </div>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <div className="flex-1 sm:w-80">
            <LvAddressAutocomplete
              value={addressText}
              onChange={setAddressText}
              onSelect={handleSelect}
              placeholder="Piem., Brīvības iela 100, Rīga"
            />
          </div>
          <button
            onClick={dismissPrompt}
            className="rounded-full p-2 text-gray-400 hover:bg-white hover:text-gray-700"
            title="Vēlāk"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
