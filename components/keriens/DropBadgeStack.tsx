"use client";

import { getDropBadges } from "@/lib/hot-drops/badges";
import type { HotDrop, DropBadge } from "@/lib/hot-drops/types";

const STYLES: Record<DropBadge["key"], string> = {
  new:         "bg-gradient-to-r from-green-500 to-emerald-400 text-white",
  hot:         "bg-gradient-to-r from-orange-500 to-red-500 text-white",
  ending:      "bg-gradient-to-r from-yellow-400 to-orange-400 text-white animate-pulse",
  almost_gone: "bg-gradient-to-r from-purple-500 to-violet-500 text-white",
};

export function DropBadgeStack({ drop, className = "" }: { drop: HotDrop; className?: string }) {
  const badges = getDropBadges(drop);
  if (badges.length === 0) return null;
  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {badges.map((b) => (
        <span key={b.key}
          className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide shadow-sm ${STYLES[b.key]}`}>
          {b.emoji} {b.label}
        </span>
      ))}
    </div>
  );
}
