"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { MapPin, Calendar, Search, X, SlidersHorizontal } from "lucide-react";
import {
  events,
  months,
  typeColors,
  typeEmoji,
  type EventType,
  type MarketEvent,
} from "@/lib/events-data";
import { cn } from "@/lib/utils";

const allTypes = Array.from(new Set(events.map((e) => e.type))) as EventType[];
const allRegions = Array.from(
  new Set(events.filter((e) => e.month > 0).map((e) => e.region))
).sort();

function EventCard({ event }: { event: MarketEvent }) {
  return (
    <Link href={`/kalendars/${event.id}`} className="group block rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:shadow-md hover:border-brand-300">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", typeColors[event.type])}>
          {typeEmoji[event.type]} {event.type}
        </span>
        {event.recurring && (
          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">Regulārs</span>
        )}
      </div>
      <h3 className="text-base font-bold text-gray-900 leading-snug group-hover:text-brand-600 transition-colors">
        {event.name}
      </h3>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <Calendar size={12} />
          {event.dateLabel}
        </span>
        <span className="flex items-center gap-1">
          <MapPin size={12} />
          {event.city}
        </span>
      </div>
      <p className="mt-2.5 text-sm text-gray-500 leading-relaxed line-clamp-2">
        {event.description}
      </p>
      <p className="mt-3 text-xs font-medium text-brand-600 group-hover:underline">
        Lasīt vairāk →
      </p>
    </Link>
  );
}

export function KalendarsClient() {
  const [search, setSearch] = useState("");
  const [activeType, setActiveType] = useState<EventType | "">("");
  const [activeRegion, setActiveRegion] = useState("");
  const [activeMonth, setActiveMonth] = useState<number | 0>(0);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const recurring = useMemo(
    () => events.filter((e) => e.month === 0),
    []
  );

  const filtered = useMemo(() => {
    let result = events.filter((e) => e.month > 0);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.city.toLowerCase().includes(q) ||
          e.description.toLowerCase().includes(q)
      );
    }
    if (activeType) result = result.filter((e) => e.type === activeType);
    if (activeRegion) result = result.filter((e) => e.region === activeRegion);
    if (activeMonth) result = result.filter((e) => e.month === activeMonth);
    return result;
  }, [search, activeType, activeRegion, activeMonth]);

  const grouped = useMemo(() => {
    if (activeMonth) {
      return [{ month: activeMonth, label: months[activeMonth], items: filtered }];
    }
    return Object.entries(months)
      .filter(([m]) => Number(m) > 0)
      .map(([m, label]) => ({
        month: Number(m),
        label,
        items: filtered.filter((e) => e.month === Number(m)),
      }))
      .filter((g) => g.items.length > 0);
  }, [filtered, activeMonth]);

  const activeFilterCount = [search, activeType, activeRegion, activeMonth].filter(Boolean).length;

  const clearAll = () => {
    setSearch("");
    setActiveType("");
    setActiveRegion("");
    setActiveMonth(0);
  };

  return (
    <div>
      {/* Search + filter bar */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Meklēt pasākumu vai pilsētu..."
            className="input pl-10 rounded-full bg-gray-50"
          />
        </div>
        <button
          onClick={() => setFiltersOpen(!filtersOpen)}
          className={cn(
            "flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm transition shrink-0",
            activeFilterCount > 0
              ? "border-brand-500 bg-brand-50 text-brand-700"
              : "border-gray-200 text-gray-700 hover:border-gray-300"
          )}
        >
          <SlidersHorizontal size={15} />
          Filtri
          {activeFilterCount > 0 && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 text-[10px] text-white">
              {activeFilterCount}
            </span>
          )}
        </button>
        {activeFilterCount > 0 && (
          <button onClick={clearAll} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
            <X size={14} /> Notīrīt
          </button>
        )}
      </div>

      {/* Expanded filters */}
      {filtersOpen && (
        <div className="mt-3 rounded-2xl border border-gray-100 bg-gray-50 p-5 space-y-4">
          {/* Month */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Mēnesis</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setActiveMonth(0)}
                className={cn("rounded-full border px-3 py-1 text-sm transition",
                  activeMonth === 0 ? "border-brand-500 bg-brand-50 text-brand-700 font-semibold" : "border-gray-200 text-gray-600 hover:border-gray-300 bg-white"
                )}
              >
                Visi
              </button>
              {Object.entries(months).filter(([m]) => Number(m) > 0).map(([m, label]) => (
                <button
                  key={m}
                  onClick={() => setActiveMonth(Number(m))}
                  className={cn("rounded-full border px-3 py-1 text-sm transition",
                    activeMonth === Number(m) ? "border-brand-500 bg-brand-50 text-brand-700 font-semibold" : "border-gray-200 text-gray-600 hover:border-gray-300 bg-white"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Type */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Veids</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setActiveType("")}
                className={cn("rounded-full border px-3 py-1 text-sm transition",
                  activeType === "" ? "border-brand-500 bg-brand-50 text-brand-700 font-semibold" : "border-gray-200 text-gray-600 hover:border-gray-300 bg-white"
                )}
              >
                Visi
              </button>
              {allTypes.map((t) => (
                <button
                  key={t}
                  onClick={() => setActiveType(activeType === t ? "" : t)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm transition",
                    activeType === t ? cn(typeColors[t], "border-transparent font-semibold") : "border-gray-200 text-gray-600 hover:border-gray-300 bg-white"
                  )}
                >
                  {typeEmoji[t]} {t}
                </button>
              ))}
            </div>
          </div>

          {/* Region */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Reģions</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setActiveRegion("")}
                className={cn("rounded-full border px-3 py-1 text-sm transition",
                  activeRegion === "" ? "border-brand-500 bg-brand-50 text-brand-700 font-semibold" : "border-gray-200 text-gray-600 hover:border-gray-300 bg-white"
                )}
              >
                Visi reģioni
              </button>
              {allRegions.map((r) => (
                <button
                  key={r}
                  onClick={() => setActiveRegion(activeRegion === r ? "" : r)}
                  className={cn("rounded-full border px-3 py-1 text-sm transition",
                    activeRegion === r ? "border-brand-500 bg-brand-50 text-brand-700 font-semibold" : "border-gray-200 text-gray-600 hover:border-gray-300 bg-white"
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Results count */}
      <p className="mt-4 text-sm text-gray-400">
        {filtered.length} pasākumi{activeFilterCount > 0 ? " (filtrēts)" : ""}
      </p>

      {/* Recurring */}
      {!activeType && !activeRegion && !activeMonth && !search && (
        <section className="mt-6">
          <h2 className="text-lg font-bold text-gray-900 mb-3">🔄 Regulārie tirgi</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {recurring.map((e) => <EventCard key={e.id} event={e} />)}
          </div>
        </section>
      )}

      {/* No results */}
      {filtered.length === 0 && (
        <div className="mt-10 text-center py-16">
          <p className="text-lg font-semibold text-gray-400">Nav atrasts neviens pasākums</p>
          <button onClick={clearAll} className="mt-3 btn-outline text-sm">Notīrīt filtrus</button>
        </div>
      )}

      {/* Grouped by month */}
      {grouped.map(({ month, label, items }) => (
        <section key={month} className="mt-10" id={`month-${month}`}>
          <div className="flex items-baseline justify-between border-b border-gray-100 pb-2 mb-4">
            <h2 className="text-lg font-bold text-gray-900">{label}</h2>
            <span className="text-sm text-gray-400">{items.length}</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((e) => <EventCard key={e.id} event={e} />)}
          </div>
        </section>
      ))}
    </div>
  );
}
