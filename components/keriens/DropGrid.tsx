"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { Flame } from "lucide-react";
import { availableQuantity } from "@/lib/hot-drops/types";
import { useRealtimeDrops } from "@/lib/hot-drops/useRealtimeDrops";
import { supabase } from "@/lib/supabase";
import { AnimatedDropCard } from "./AnimatedDropCard";
import { DropFilters, EMPTY_DROP_FILTERS, type DropFilterState } from "./DropFilters";
import { LiveCounter } from "./LiveCounter";
import type { HotDropWithSeller } from "@/lib/hot-drops/types";

export function DropGrid({ initialDrops }: { initialDrops: HotDropWithSeller[] }) {
  const drops = useRealtimeDrops(initialDrops);
  const [filters, setFilters] = useState<DropFilterState>(EMPTY_DROP_FILTERS);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [subscribedLockerIds, setSubscribedLockerIds] = useState<string[]>([]);
  const prevCountRef = useRef(initialDrops.length);

  // Load user's locker subscriptions to highlight in filter pills
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || cancelled) return;
      const res = await fetch("/api/locker-subscriptions", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok || cancelled) return;
      const { subscriptions } = await res.json();
      if (cancelled) return;
      const ids = (subscriptions ?? [])
        .filter((s: { push_enabled: boolean }) => s.push_enabled)
        .map((s: { locker_id: string }) => s.locker_id);
      setSubscribedLockerIds(ids);
    })();
    return () => { cancelled = true; };
  }, []);

  // Flash newest card briefly when a new drop appears
  useEffect(() => {
    if (drops.length > prevCountRef.current) {
      const newest = drops[0];
      setFlashId(newest?.id ?? null);
      const t = setTimeout(() => setFlashId(null), 2000);
      return () => clearTimeout(t);
    }
    prevCountRef.current = drops.length;
  }, [drops]);

  const activeDrops = useMemo(
    () => drops.filter((d) => d.status === "active" && new Date(d.expires_at).getTime() > Date.now()),
    [drops],
  );

  const filtered = useMemo(() => {
    let list = activeDrops.filter((d) => availableQuantity(d) > 0);

    if (filters.category !== "Visi") {
      list = list.filter((d) => d.category === filters.category);
    }
    if (filters.temp !== "all") {
      list = list.filter((d) => d.temperature_zone === filters.temp);
    }
    if (filters.lockerId !== "all") {
      list = list.filter((d) => d.pickup_locker_id === filters.lockerId);
    }

    // Sort
    let sorted: HotDropWithSeller[];
    switch (filters.sort) {
      case "ending":
        sorted = [...list].sort((a, b) => new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime());
        break;
      case "price_asc":
        sorted = [...list].sort((a, b) => a.price_cents - b.price_cents);
        break;
      case "price_desc":
        sorted = [...list].sort((a, b) => b.price_cents - a.price_cents);
        break;
      default:
        sorted = [...list].sort((a, b) =>
          new Date(b.published_at ?? b.created_at).getTime() - new Date(a.published_at ?? a.created_at).getTime()
        );
    }

    // If user has subscribed lockers AND default ALL filter, prioritize their lockers first
    if (filters.lockerId === "all" && subscribedLockerIds.length > 0 && filters.sort === "newest") {
      const own = sorted.filter((d) => subscribedLockerIds.includes(d.pickup_locker_id));
      const rest = sorted.filter((d) => !subscribedLockerIds.includes(d.pickup_locker_id));
      sorted = [...own, ...rest];
    }

    return sorted;
  }, [activeDrops, filters, subscribedLockerIds]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <LiveCounter count={activeDrops.length} />
      </div>

      <DropFilters
        filters={filters}
        onChange={setFilters}
        subscribedLockerIds={subscribedLockerIds}
      />

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-orange-100 bg-orange-50/30 py-20 text-center">
          <Flame size={40} className="text-orange-200" />
          <p className="mt-3 font-semibold text-gray-700">Nav atrasts neviens sludinājums</p>
          <p className="mt-1 text-sm text-gray-400">Mainiet filtrus vai pārbaudiet vēlāk</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((drop, i) => (
            <div key={drop.id}
              className={flashId === drop.id ? "ring-2 ring-orange-400 ring-offset-2 rounded-2xl transition-all" : ""}>
              <AnimatedDropCard drop={drop} index={i} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
