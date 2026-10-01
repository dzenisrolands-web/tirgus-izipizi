"use client";

import { Flame } from "lucide-react";

export function LiveCounter({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <div className="flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-600 border border-orange-100">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500" />
      </span>
      <Flame size={12} />
      {count} aktīv{count === 1 ? "s" : "i"} sludinājum{count === 1 ? "s" : "i"} tagad
    </div>
  );
}
