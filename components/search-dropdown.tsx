"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Search, X, Loader2, ShoppingCart } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatPrice } from "@/lib/utils";

type SearchResult = {
  id: string;
  title: string;
  slug: string | null;
  price: number;
  unit: string;
  image_url: string;
  category: string;
  seller_farm_name: string;
  seller_avatar: string;
  relevance: number;
};

const MIN_CHARS = 2;
const DEBOUNCE_MS = 250;
const MAX_RESULTS = 8;

/**
 * Live search dropdown with pg_trgm fuzzy matching.
 * Replaces the old form-based search in Nav.
 */
export function SearchDropdown() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [searched, setSearched] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < MIN_CHARS) {
      setResults([]);
      setOpen(false);
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const { data, error } = await supabase.rpc("search_products", {
        query: q,
        lim: MAX_RESULTS,
      });
      if (error) {
        console.error("[search]", error.message);
        setResults([]);
      } else {
        setResults((data as SearchResult[]) ?? []);
      }
      setOpen(true);
      setActiveIdx(-1);
    } catch (err) {
      console.error("[search]", err);
      setResults([]);
    }
    setLoading(false);
  }, []);

  function handleChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < MIN_CHARS) {
      setResults([]);
      setOpen(false);
      setSearched(false);
      return;
    }
    debounceRef.current = setTimeout(() => doSearch(value.trim()), DEBOUNCE_MS);
  }

  function clear() {
    setQuery("");
    setResults([]);
    setOpen(false);
    setSearched(false);
    setActiveIdx(-1);
    inputRef.current?.focus();
  }

  function navigateTo(path: string) {
    setOpen(false);
    setQuery("");
    router.push(path);
  }

  function productUrl(r: SearchResult): string {
    return `/listing/${r.slug || r.id}`;
  }

  function viewAll() {
    navigateTo(`/catalog?q=${encodeURIComponent(query.trim())}`);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === "Enter" && query.trim().length >= MIN_CHARS) {
        e.preventDefault();
        viewAll();
      }
      return;
    }

    const maxIdx = results.length; // results.length = last idx is "view all"

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIdx((i) => (i < maxIdx ? i + 1 : 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIdx((i) => (i > 0 ? i - 1 : maxIdx));
        break;
      case "Enter":
        e.preventDefault();
        if (activeIdx >= 0 && activeIdx < results.length) {
          navigateTo(productUrl(results[activeIdx]));
        } else {
          viewAll();
        }
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        setActiveIdx(-1);
        break;
    }
  }

  // Highlight matching text
  function highlight(text: string, q: string): React.ReactNode {
    if (!q || q.length < 2) return text;
    const norm = q.toLowerCase();
    const idx = text.toLowerCase().indexOf(norm);
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-brand-100 text-brand-900 rounded-sm px-0.5">{text.slice(idx, idx + norm.length)}</mark>
        {text.slice(idx + norm.length)}
      </>
    );
  }

  return (
    <div ref={containerRef} className="relative flex flex-1 items-center" role="combobox" aria-expanded={open} aria-haspopup="listbox">
      <div className="relative flex w-full max-w-xl items-center">
        <Search size={16} className="absolute left-3 text-gray-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (results.length > 0 && query.length >= MIN_CHARS) setOpen(true); }}
          placeholder="Meklēt produktus..."
          className="w-full rounded-full border border-gray-200 bg-white py-2 pl-9 pr-9 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-brand-500 focus:shadow-sm"
          role="searchbox"
          aria-label="Meklēt produktus"
          aria-autocomplete="list"
          aria-controls="search-results"
          autoComplete="off"
        />
        {/* Clear / Loading indicator */}
        {query && (
          <button
            onClick={clear}
            className="absolute right-3 flex items-center justify-center text-gray-400 hover:text-gray-600 transition"
            aria-label="Notīrīt meklēšanu"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && searched && (
        <div
          id="search-results"
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[70vh] overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-xl"
        >
          {results.length === 0 && !loading && (
            <div className="px-4 py-8 text-center">
              <ShoppingCart size={24} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-500">Nekas netika atrasts</p>
              <p className="text-xs text-gray-400 mt-1">Pamēģini citu meklēšanas vārdu</p>
            </div>
          )}

          {results.length > 0 && (
            <>
              <ul className="divide-y divide-gray-50">
                {results.map((r, i) => (
                  <li key={r.id} role="option" aria-selected={i === activeIdx}>
                    <button
                      onClick={() => navigateTo(productUrl(r))}
                      onMouseEnter={() => setActiveIdx(i)}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition ${
                        i === activeIdx ? "bg-brand-50" : "hover:bg-gray-50"
                      }`}
                    >
                      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                        {r.image_url ? (
                          <Image src={r.image_url} alt={r.title} fill className="object-cover" sizes="40px" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <ShoppingCart size={14} className="text-gray-300" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-gray-900">
                          {highlight(r.title, query)}
                        </p>
                        <p className="truncate text-xs text-gray-500">
                          {r.seller_farm_name} · {r.category}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-bold text-gray-900">
                        {formatPrice(r.price)}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>

              {/* View all link */}
              <button
                onClick={viewAll}
                onMouseEnter={() => setActiveIdx(results.length)}
                className={`flex w-full items-center justify-center gap-2 border-t border-gray-100 px-4 py-3 text-xs font-semibold transition ${
                  activeIdx === results.length ? "bg-brand-50 text-brand-700" : "text-brand-600 hover:bg-gray-50"
                }`}
                role="option"
                aria-selected={activeIdx === results.length}
              >
                <Search size={12} />
                Skatīt visus rezultātus: &ldquo;{query}&rdquo;
              </button>
            </>
          )}

          {loading && results.length === 0 && (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-gray-400" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
