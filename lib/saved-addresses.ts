"use client";

import { useState, useEffect, useCallback } from "react";

export type SavedAddress = {
  id: string;
  label: string;
  fullText: string;
  street: string;
  city: string;
  postalCode: string;
};

const STORAGE_KEY = "saved_delivery_addresses_v1";

export const QUICK_LABELS = ["Mājas", "Birojs", "Mammas vieta", "Vasarnīca"];

function load(): SavedAddress[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save(list: SavedAddress[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {}
}

export function useSavedAddresses() {
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);

  useEffect(() => {
    setAddresses(load());
  }, []);

  const add = useCallback((addr: Omit<SavedAddress, "id">) => {
    const next: SavedAddress = { ...addr, id: crypto.randomUUID() };
    setAddresses((prev) => {
      const updated = [next, ...prev.filter((a) => a.label !== addr.label)];
      save(updated);
      return updated;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setAddresses((prev) => {
      const updated = prev.filter((a) => a.id !== id);
      save(updated);
      return updated;
    });
  }, []);

  return { addresses, add, remove };
}
