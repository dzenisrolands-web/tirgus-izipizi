"use client";

import { X, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { lockers } from "@/lib/mock-data";

export type DropFilterState = {
  category: string;
  temp: string;
  lockerId: string; // "all" or locker.id
  sort: "newest" | "ending" | "price_asc" | "price_desc";
};

const CATEGORIES = [
  "Visi", "Dārzeņi", "Augļi", "Gaļa", "Piena produkti",
  "Maize", "Medus", "Zivis", "Citi",
];

const TEMPS = [
  { key: "all",      label: "Visi" },
  { key: "chilled",  label: "❄️ Atdzesēts" },
  { key: "frozen",   label: "🧊 Saldēts" },
];

const SORTS: { key: DropFilterState["sort"]; label: string }[] = [
  { key: "newest",    label: "Jaunākie" },
  { key: "ending",    label: "Beidzas drīz" },
  { key: "price_asc", label: "Cena ↑" },
  { key: "price_desc",label: "Cena ↓" },
];

export const EMPTY_DROP_FILTERS: DropFilterState = {
  category: "Visi",
  temp: "all",
  lockerId: "all",
  sort: "newest",
};

function isActive(f: DropFilterState) {
  return f.category !== "Visi" || f.temp !== "all" || f.lockerId !== "all" || f.sort !== "newest";
}

export function DropFilters({
  filters,
  onChange,
  subscribedLockerIds = [],
}: {
  filters: DropFilterState;
  onChange: (f: DropFilterState) => void;
  subscribedLockerIds?: string[];
}) {
  return (
    <div className="space-y-3">
      {/* Locker pills — abonētie izcelti */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => onChange({ ...filters, lockerId: "all" })}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-semibold transition border",
            filters.lockerId === "all"
              ? "bg-orange-500 text-white border-orange-500"
              : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
          )}>
          Visi pakomāti
        </button>
        {lockers.map((l) => {
          const isSubscribed = subscribedLockerIds.includes(l.id);
          const isSelected = filters.lockerId === l.id;
          return (
            <button key={l.id}
              onClick={() => onChange({ ...filters, lockerId: l.id })}
              className={cn(
                "flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition border",
                isSelected
                  ? "bg-orange-500 text-white border-orange-500"
                  : isSubscribed
                  ? "bg-brand-50 text-brand-700 border-brand-300 hover:bg-brand-100"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
              )}
              title={isSubscribed ? "Tavs abonētais pakomāts" : undefined}
            >
              {isSubscribed && <Bell size={10} className={isSelected ? "text-white" : "text-brand-600"} />}
              {l.name}
            </button>
          );
        })}
      </div>

      {/* Category pills */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {CATEGORIES.map((cat) => (
            <button key={cat}
              onClick={() => onChange({ ...filters, category: cat })}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold transition-all border",
                filters.category === cat
                  ? "bg-[#192635] text-white border-[#192635]"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
              )}>
              {cat}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Temp filter */}
          <select value={filters.temp}
            onChange={(e) => onChange({ ...filters, temp: e.target.value })}
            className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-300">
            {TEMPS.map(({ key, label }) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>

          {/* Sort */}
          <select value={filters.sort}
            onChange={(e) => onChange({ ...filters, sort: e.target.value as DropFilterState["sort"] })}
            className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-300">
            {SORTS.map(({ key, label }) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>

          {/* Clear */}
          {isActive(filters) && (
            <button onClick={() => onChange(EMPTY_DROP_FILTERS)}
              className="flex items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 transition">
              <X size={11} /> Notīrīt
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
