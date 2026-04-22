"use client";

import Link from "next/link";
import { useState } from "react";
import { Search, Menu, X, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";

export function Nav() {
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center gap-4">
          {/* Logo */}
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <span className="text-brand-600">
              <ShoppingBag size={22} strokeWidth={2.5} />
            </span>
            <span className="hidden text-sm font-bold text-gray-900 sm:block">
              tirgus<span className="text-brand-600">.izipizi.lv</span>
            </span>
          </Link>

          {/* Search bar */}
          <form
            className="flex flex-1 items-center"
            onSubmit={(e) => {
              e.preventDefault();
              if (searchQuery.trim()) {
                window.location.href = `/catalog?q=${encodeURIComponent(searchQuery)}`;
              }
            }}
          >
            <div className="relative w-full max-w-xl">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Meklēt produktus..."
                className={cn(
                  "input pl-10",
                  "rounded-full border-gray-200 bg-gray-50 py-2 text-sm"
                )}
              />
            </div>
          </form>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-2 md:flex">
            <Link href="/catalog" className="text-sm text-gray-600 hover:text-gray-900 px-3 py-2">
              Produkti
            </Link>
            <Link href="/razotaji" className="text-sm text-gray-600 hover:text-gray-900 px-3 py-2">
              Ražotāji
            </Link>
            <Link href="/lockers" className="text-sm text-gray-600 hover:text-gray-900 px-3 py-2">
              Pakomāti
            </Link>
            <Link href="/kalendars" className="text-sm text-gray-600 hover:text-gray-900 px-3 py-2">
              Kalendārs
            </Link>
            <Link href="/sell" className="btn-primary text-sm">
              Pārdot
            </Link>
            <Link href="/login" className="btn-outline text-sm">
              Pieslēgties
            </Link>
          </nav>

          {/* Mobile toggle */}
          <button
            className="ml-2 rounded-lg p-2 text-gray-600 hover:bg-gray-100 md:hidden"
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
              href="/lockers"
              className="rounded-lg px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
              onClick={() => setMobileOpen(false)}
            >
              Pakomātu vietas
            </Link>
            <Link
              href="/kalendars"
              className="rounded-lg px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
              onClick={() => setMobileOpen(false)}
            >
              Tirgu Kalendārs
            </Link>
            <Link
              href="/sell"
              className="mt-2 btn-primary text-center text-sm"
              onClick={() => setMobileOpen(false)}
            >
              Pārdot
            </Link>
            <Link
              href="/login"
              className="mt-2 btn-outline text-center text-sm"
              onClick={() => setMobileOpen(false)}
            >
              Pieslēgties
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
