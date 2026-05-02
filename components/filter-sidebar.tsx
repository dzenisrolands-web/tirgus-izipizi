"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { categories, sellers } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export type Filters = {
  category: string;
  maxPrice: number;
  seller: string;
  storageType: "all" | "frozen" | "chilled";
};

type Props = {
  filters: Filters;
  onChange: (filters: Filters) => void;
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border-b border-gray-100 py-4">
      <button
        className="flex w-full items-center justify-between text-sm font-semibold text-gray-900"
        onClick={() => setOpen(!open)}
      >
        {title}
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}

export const DEFAULT_FILTERS: Filters = { category: "Visi", maxPrice: 100, seller: "", storageType: "all" };

export function FilterSidebar({ filters, onChange }: Props) {
  return (
    <aside className="w-full">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-gray-900">Filtri</p>
        <button
          className="text-xs text-brand-600 hover:underline"
          onClick={() => onChange(DEFAULT_FILTERS)}
        >
          Notīrīt
        </button>
      </div>

      <Section title="Temperatūras režīms">
        <div className="flex flex-col gap-1">
          {([
            { value: "all",     label: "Visi produkti" },
            { value: "frozen",  label: "❄ Saldēti  -18°C" },
            { value: "chilled", label: "🌡 Dzesēti  +2°C – +6°C" },
          ] as const).map((opt) => (
            <button key={opt.value}
              onClick={() => onChange({ ...filters, storageType: opt.value })}
              className={cn(
                "rounded-lg px-3 py-1.5 text-left text-sm transition",
                filters.storageType === opt.value
                  ? "bg-brand-50 font-semibold text-brand-700"
                  : "text-gray-600 hover:bg-gray-50"
              )}>
              {opt.label}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Kategorija">
        <div className="flex flex-col gap-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => onChange({ ...filters, category: cat })}
              className={cn(
                "rounded-lg px-3 py-1.5 text-left text-sm transition",
                filters.category === cat
                  ? "bg-brand-50 font-semibold text-brand-700"
                  : "text-gray-600 hover:bg-gray-50"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Ražotājs">
        <div className="flex flex-col gap-1">
          <button
            onClick={() => onChange({ ...filters, seller: "" })}
            className={cn(
              "rounded-lg px-3 py-1.5 text-left text-sm transition",
              filters.seller === ""
                ? "bg-brand-50 font-semibold text-brand-700"
                : "text-gray-600 hover:bg-gray-50"
            )}
          >
            Visi ražotāji
          </button>
          {sellers.map((s) => (
            <button
              key={s.id}
              onClick={() => onChange({ ...filters, seller: s.id })}
              className={cn(
                "rounded-lg px-3 py-1.5 text-left text-sm transition leading-snug",
                filters.seller === s.id
                  ? "bg-brand-50 font-semibold text-brand-700"
                  : "text-gray-600 hover:bg-gray-50"
              )}
            >
              {s.name}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Cena (€)">
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">0€</span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={filters.maxPrice}
            onChange={(e) => onChange({ ...filters, maxPrice: Number(e.target.value) })}
            className="h-1.5 w-full cursor-pointer accent-brand-600"
          />
          <span className="text-xs text-gray-400">{filters.maxPrice}€</span>
        </div>
        <p className="mt-1 text-center text-xs text-gray-500">Līdz {filters.maxPrice}€</p>
      </Section>
    </aside>
  );
}
