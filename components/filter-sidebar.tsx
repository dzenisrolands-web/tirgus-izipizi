"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { categories, lockers } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

type Filters = {
  category: string;
  city: string;
  maxPrice: number;
};

type Props = {
  filters: Filters;
  onChange: (filters: Filters) => void;
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
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

export function FilterSidebar({ filters, onChange }: Props) {
  const cities = Array.from(new Set(lockers.map((l) => l.city)));

  return (
    <aside className="w-full">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-gray-900">Filtri</p>
        <button
          className="text-xs text-brand-600 hover:underline"
          onClick={() => onChange({ category: "Visi", city: "", maxPrice: 50 })}
        >
          Notīrīt
        </button>
      </div>

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

      <Section title="Pakomāta pilsēta">
        <div className="flex flex-col gap-1">
          <button
            onClick={() => onChange({ ...filters, city: "" })}
            className={cn(
              "rounded-lg px-3 py-1.5 text-left text-sm transition",
              filters.city === ""
                ? "bg-brand-50 font-semibold text-brand-700"
                : "text-gray-600 hover:bg-gray-50"
            )}
          >
            Visas pilsētas
          </button>
          {cities.map((city) => (
            <button
              key={city}
              onClick={() => onChange({ ...filters, city })}
              className={cn(
                "rounded-lg px-3 py-1.5 text-left text-sm transition",
                filters.city === city
                  ? "bg-brand-50 font-semibold text-brand-700"
                  : "text-gray-600 hover:bg-gray-50"
              )}
            >
              {city}
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
            max={50}
            step={1}
            value={filters.maxPrice}
            onChange={(e) =>
              onChange({ ...filters, maxPrice: Number(e.target.value) })
            }
            className="h-1.5 w-full cursor-pointer accent-brand-600"
          />
          <span className="text-xs text-gray-400">{filters.maxPrice}€</span>
        </div>
        <p className="mt-1 text-center text-xs text-gray-500">
          Līdz {filters.maxPrice}€
        </p>
      </Section>
    </aside>
  );
}
