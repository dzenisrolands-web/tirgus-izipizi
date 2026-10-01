"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

function formatMs(ms: number): string {
  if (ms <= 0) return "Beidzies";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}min`;
  if (m > 0) return `${m}min ${s.toString().padStart(2, "0")}s`;
  return `${s}s`;
}

export function DropCountdown({ expiresAt, className = "" }: { expiresAt: string; className?: string }) {
  const [ms, setMs] = useState(() => new Date(expiresAt).getTime() - Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      setMs(new Date(expiresAt).getTime() - Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const urgent = ms > 0 && ms < 3600000;

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${urgent ? "text-red-600 animate-pulse" : "text-gray-500"} ${className}`}>
      <Clock size={11} />
      {formatMs(ms)}
    </span>
  );
}
