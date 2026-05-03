"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Menu, X, ShoppingBag, ShoppingCart } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { supabase } from "@/lib/supabase";
import { AISearch } from "./ai-search";

export function Nav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authed, setAuthed] = useState(false);
  const { count } = useCart();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setAuthed(!!s));
    return () => subscription.unsubscribe();
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center gap-4">
          {/* Logo */}
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <span style={{ color: "#53F3A4" }}>
              <ShoppingBag size={22} strokeWidth={2.5} />
            </span>
            <span className="hidden text-sm font-bold text-gray-900 sm:block">
              tirgus
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: "linear-gradient(90deg, #53F3A4, #AD47FF)" }}
              >
                .izipizi.lv
              </span>
            </span>
          </Link>

          {/* AI search — replaces the old keyword search.
              Click opens a chat overlay with product search + Q&A. */}
          <div className="flex flex-1 items-center">
            <AISearch />
          </div>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-2 md:flex">
            {/* Sludinājumu dēlis paslēpts līdz launch — saglabāts, lai ātri atjaunotu
            <Link href="/keriens" className="flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:brightness-110"
              style={{ background: "linear-gradient(90deg, #f97316, #ef4444)" }}>
              <Flame size={13} className="animate-pulse" /> Sludinājumu dēlis
            </Link>
            */}
            <Link href="/catalog" className="text-sm text-gray-600 hover:text-gray-900 px-3 py-2">
              Produkti
            </Link>
            <Link href="/razotaji" className="text-sm text-gray-600 hover:text-gray-900 px-3 py-2">
              Ražotāji
            </Link>
            <Link href="/piegade" className="text-sm text-gray-600 hover:text-gray-900 px-3 py-2">
              Piegāde
            </Link>
            <Link href="/cart" className="relative rounded-lg p-2 text-gray-600 hover:bg-gray-100">
              <ShoppingCart size={20} />
              {count > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand-500 text-[10px] font-bold text-white" style={{ backgroundColor: "#53F3A4", color: "#192635" }}>
                  {count > 9 ? "9+" : count}
                </span>
              )}
            </Link>
            {authed ? (
              <Link href="/dashboard" className="btn-outline text-sm">
                Konts
              </Link>
            ) : (
              <Link href="/login" className="btn-outline text-sm">
                Pieslēgties
              </Link>
            )}
          </nav>

          {/* Mobile cart */}
          <Link href="/cart" className="relative rounded-lg p-2 text-gray-600 hover:bg-gray-100 md:hidden">
            <ShoppingCart size={20} />
            {count > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold" style={{ backgroundColor: "#53F3A4", color: "#192635" }}>
                {count > 9 ? "9+" : count}
              </span>
            )}
          </Link>

          {/* Mobile toggle */}
          <button
            className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Navigācija"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-gray-100 bg-white px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-1">
            {/* Sludinājumu dēlis paslēpts līdz launch
            <Link
              href="/keriens"
              className="flex items-center gap-2 rounded-lg px-3 py-3 text-sm font-bold text-white shadow-sm"
              style={{ background: "linear-gradient(90deg, #f97316, #ef4444)" }}
              onClick={() => setMobileOpen(false)}
            >
              <Flame size={16} className="animate-pulse" /> Sludinājumu dēlis
            </Link>
            */}
            <Link
              href="/catalog"
              className="rounded-lg px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
              onClick={() => setMobileOpen(false)}
            >
              Produkti
            </Link>
            <Link
              href="/razotaji"
              className="rounded-lg px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
              onClick={() => setMobileOpen(false)}
            >
              Ražotāji
            </Link>
            <Link
              href="/piegade"
              className="rounded-lg px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
              onClick={() => setMobileOpen(false)}
            >
              Piegāde
            </Link>
            {authed ? (
              <Link href="/dashboard" className="mt-2 btn-outline text-center text-sm"
                onClick={() => setMobileOpen(false)}>
                Konts
              </Link>
            ) : (
              <Link href="/login" className="mt-2 btn-outline text-center text-sm"
                onClick={() => setMobileOpen(false)}>
                Pieslēgties
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
