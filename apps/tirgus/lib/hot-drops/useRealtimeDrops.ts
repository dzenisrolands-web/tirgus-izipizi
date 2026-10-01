"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { fetchDropById } from "./queries";
import type { HotDrop, HotDropWithSeller } from "./types";

export function useRealtimeDrops(initial: HotDropWithSeller[]): HotDropWithSeller[] {
  const [drops, setDrops] = useState<HotDropWithSeller[]>(initial);

  // Patch a drop in state from a realtime UPDATE payload (no seller data in payload)
  const handleUpdate = useCallback((row: HotDrop) => {
    if (row.status !== "active") {
      setDrops((prev) => prev.filter((d) => d.id !== row.id));
      return;
    }
    setDrops((prev) =>
      prev.map((d) =>
        d.id === row.id
          ? {
              ...d,
              reserved_quantity: row.reserved_quantity,
              sold_quantity: row.sold_quantity,
              total_quantity: row.total_quantity,
              status: row.status,
              expires_at: row.expires_at,
              price_cents: row.price_cents,
              cover_image_url: row.cover_image_url,
              title: row.title,
              updated_at: row.updated_at,
            }
          : d
      )
    );
  }, []);

  // On INSERT fetch full drop with seller data and prepend
  const handleInsert = useCallback(async (id: string) => {
    const drop = await fetchDropById(id);
    if (!drop || drop.status !== "active") return;
    setDrops((prev) => {
      if (prev.find((d) => d.id === id)) return prev;
      return [drop, ...prev];
    });
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("hot_drops_realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "hot_drops" },
        (payload) => handleInsert((payload.new as { id: string }).id),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "hot_drops" },
        (payload) => handleUpdate(payload.new as HotDrop),
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [handleInsert, handleUpdate]);

  return drops;
}
