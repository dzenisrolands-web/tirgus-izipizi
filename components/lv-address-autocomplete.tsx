"use client";

import { useState, useEffect, useRef } from "react";
import { MapPin, Loader2, Search } from "lucide-react";

type NominatimResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  address?: {
    road?: string;
    pedestrian?: string;
    house_number?: string;
    suburb?: string;
    neighbourhood?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    postcode?: string;
    country?: string;
    country_code?: string;
  };
};

export type ParsedAddress = {
  fullText: string;
  street: string;
  city: string;
  postalCode: string; // 4-digit only, no "LV-" prefix
};

function parseResult(r: NominatimResult): ParsedAddress {
  const a = r.address ?? {};
  const road = a.road ?? a.pedestrian ?? "";
  const street = [road, a.house_number].filter(Boolean).join(" ").trim();
  const city = a.city ?? a.town ?? a.village ?? a.municipality ?? a.suburb ?? a.neighbourhood ?? a.county ?? "";
  const postalCode = (a.postcode ?? "").replace(/^LV[-\s]?/i, "").replace(/\D/g, "").slice(0, 4);
  return { fullText: r.display_name, street, city, postalCode };
}

export function LvAddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Sāc rakstīt adresi (piem., Brīvības 100)",
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (parsed: ParsedAddress) => void;
  placeholder?: string;
}) {
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!value || value.trim().length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      // Cancel any in-flight request
      if (abortRef.current) abortRef.current.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      setLoading(true);
      try {
        const url = new URL("https://nominatim.openstreetmap.org/search");
        url.searchParams.set("format", "jsonv2");
        url.searchParams.set("countrycodes", "lv");
        url.searchParams.set("addressdetails", "1");
        url.searchParams.set("limit", "6");
        url.searchParams.set("accept-language", "lv");
        url.searchParams.set("q", value);

        const res = await fetch(url.toString(), { signal: ctrl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: NominatimResult[] = await res.json();
        setSuggestions(data);
        setOpen(data.length > 0);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("Address autocomplete failed:", err);
        }
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  function handlePick(r: NominatimResult) {
    const parsed = parseResult(r);
    onChange(parsed.fullText);
    onSelect(parsed);
    setOpen(false);
    setSuggestions([]);
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder={placeholder}
          autoComplete="off"
          className="input w-full pl-9 pr-9"
        />
        {loading && (
          <Loader2
            size={14}
            className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400"
          />
        )}
      </div>

      {open && suggestions.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full max-h-64 overflow-auto rounded-xl border border-gray-200 bg-white shadow-lg">
          {suggestions.map((s) => {
            const parsed = parseResult(s);
            const primary = parsed.street || s.display_name.split(",")[0] || s.display_name;
            const secondary = [parsed.city, parsed.postalCode ? `LV-${parsed.postalCode}` : null]
              .filter(Boolean)
              .join(", ");
            return (
              <li
                key={s.place_id}
                onMouseDown={(e) => { e.preventDefault(); handlePick(s); }}
                className="flex cursor-pointer items-start gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition"
              >
                <MapPin size={14} className="mt-0.5 shrink-0 text-gray-400" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900 truncate">{primary}</p>
                  {secondary && <p className="text-xs text-gray-500 truncate">{secondary}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
