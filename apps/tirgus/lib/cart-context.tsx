"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { cartIdentity } from "./cart-identity";
import { hydrateCart, MAX_CART_QUANTITY, parseCart, validQuantity, type CartItem } from "./cart-state";
import type { CanonicalCartItem } from "./checkout-contract";
export type { CartItem } from "./cart-state";

type CartCtx = {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  removeItem: (id: string) => void;
  updateQty: (id: string, qty: number) => void;
  hydrateItems: (items: CanonicalCartItem[]) => void;
  ready: boolean;
  storageError: string;
  count: number;
  total: number;
  clear: () => void;
};
const CartContext = createContext<CartCtx | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [storageValid, setStorageValid] = useState(false);
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      try {
        setItems(parseCart(localStorage.getItem("cart")));
        setStorageValid(true);
      } catch {
        setStorageError("Saglabāto grozu nevar nolasīt. Dati nav dzēsti. Atjauno piekļuvi vai atiestati grozu un izvēlies preces atkārtoti.");
      }
      setReady(true);
    });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!ready || !storageValid) return;
    void Promise.resolve().then(() => {
      try {
        localStorage.setItem("cart", JSON.stringify(items));
        setStorageError("");
      } catch {
        setStorageError("Groza izmaiņas nevar saglabāt šajā pārlūkā. Neaizver lapu, kamēr grozs nav saglabāts.");
      }
    });
  }, [items, ready, storageValid]);
  const hydrateItems = useCallback((canonical: CanonicalCartItem[]) => {
    setItems(previous => {
      const next = hydrateCart(previous, canonical);
      return JSON.stringify(next) === JSON.stringify(previous) ? previous : next;
    });
  }, []);
  function addItem(item: Omit<CartItem, "quantity">, quantity = 1) {
    if (!ready || !storageValid || !item.listingId || !validQuantity(quantity)) return;
    const canonical = { ...item, ...cartIdentity(item.listingId, item.variantId) };
    try { parseCart(JSON.stringify([{ ...canonical, quantity }])); } catch { return; }
    setItems(previous => {
      const existing = previous.find(i => i.id === canonical.id);
      if (existing && existing.quantity + quantity > MAX_CART_QUANTITY) {
        setStorageError("Maksimālais preces daudzums ir 999.");
        return previous;
      }
      const next = existing
        ? previous.map(i => i.id === canonical.id ? { ...i, quantity: i.quantity + quantity } : i)
        : [...previous, { ...canonical, quantity }];
      try { parseCart(JSON.stringify(next)); return next; } catch {
        setStorageError("Groza summa vai preču skaits pārsniedz atļauto robežu.");
        return previous;
      }
    });
  }
  function removeItem(id: string) { setItems(previous => previous.filter(i => i.id !== id)); }
  function updateQty(id: string, quantity: number) {
    if (quantity === 0) return removeItem(id);
    if (!validQuantity(quantity)) return;
    setItems(previous => {
      const next = previous.map(i => i.id === id ? { ...i, quantity } : i);
      try { parseCart(JSON.stringify(next)); return next; } catch {
        setStorageError("Groza summa pārsniedz atļauto robežu.");
        return previous;
      }
    });
  }
  function clear() {
    setItems([]);
    setStorageValid(true);
  }
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  const cents = items.reduce((sum, item) => sum + Math.round(item.price * 100) * item.quantity, 0);
  const total = Number.isSafeInteger(cents) ? cents / 100 : 0;
  return <CartContext.Provider value={{ items, addItem, removeItem, updateQty, hydrateItems, ready, storageError, count, total, clear }}>{children}</CartContext.Provider>;
}
export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be inside CartProvider");
  return ctx;
}
