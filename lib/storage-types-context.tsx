"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";

type StorageMap = Record<string, "frozen" | "chilled" | "ambient">;

const Ctx = createContext<StorageMap>({});

export function StorageTypesProvider({ children }: { children: ReactNode }) {
  const [map, setMap] = useState<StorageMap>({});

  useEffect(() => {
    supabase
      .from("listings")
      .select("slug, storage_type")
      .then(({ data }) => {
        const m: StorageMap = {};
        for (const row of data ?? []) {
          if (row.slug && row.storage_type) m[row.slug] = row.storage_type;
        }
        setMap(m);
      });
  }, []);

  return <Ctx.Provider value={map}>{children}</Ctx.Provider>;
}

export function useStorageTypes() {
  return useContext(Ctx);
}
