"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { lookupPostalCode, type DeliveryZone, type ZonePricing } from "@/lib/postal-zones";

export type BuyerAddress = {
  postalCode: string;
  city: string;
  fullText: string;
  zone: DeliveryZone | null;
  pricing: ZonePricing | null;
  outsideZones: boolean;
};

type Ctx = {
  address: BuyerAddress | null;
  setAddress: (a: { postalCode: string; city?: string; fullText?: string } | null) => void;
  clear: () => void;
  /** Whether user has dismissed the address prompt (don't show banner again) */
  promptDismissed: boolean;
  dismissPrompt: () => void;
};

const BuyerAddressContext = createContext<Ctx | null>(null);

const STORAGE_KEY = "buyer_address_v1";
const DISMISS_KEY = "buyer_address_prompt_dismissed_v1";

export function BuyerAddressProvider({ children }: { children: ReactNode }) {
  const [address, setAddressState] = useState<BuyerAddress | null>(null);
  const [promptDismissed, setPromptDismissed] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setAddressState(JSON.parse(saved));
      const dismissed = localStorage.getItem(DISMISS_KEY);
      if (dismissed === "1") setPromptDismissed(true);
    } catch {}
  }, []);

  function setAddress(input: { postalCode: string; city?: string; fullText?: string } | null) {
    if (!input) {
      setAddressState(null);
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
      return;
    }
    const result = lookupPostalCode(input.postalCode);
    let next: BuyerAddress;
    if (result.found) {
      next = {
        postalCode: input.postalCode,
        city: input.city ?? result.place ?? "",
        fullText: input.fullText ?? "",
        zone: result.zone,
        pricing: result.pricing,
        outsideZones: false,
      };
    } else if (result.reason === "outside_zones") {
      next = {
        postalCode: input.postalCode,
        city: input.city ?? "",
        fullText: input.fullText ?? "",
        zone: null,
        pricing: null,
        outsideZones: true,
      };
    } else {
      // invalid format or unknown — store anyway, no zone info
      next = {
        postalCode: input.postalCode,
        city: input.city ?? "",
        fullText: input.fullText ?? "",
        zone: null,
        pricing: null,
        outsideZones: false,
      };
    }
    setAddressState(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
  }

  function clear() {
    setAddress(null);
  }

  function dismissPrompt() {
    setPromptDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch {}
  }

  return (
    <BuyerAddressContext.Provider value={{ address, setAddress, clear, promptDismissed, dismissPrompt }}>
      {children}
    </BuyerAddressContext.Provider>
  );
}

export function useBuyerAddress() {
  const ctx = useContext(BuyerAddressContext);
  if (!ctx) throw new Error("useBuyerAddress must be inside BuyerAddressProvider");
  return ctx;
}
