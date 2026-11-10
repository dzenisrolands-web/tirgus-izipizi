"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { createPageviewSender } from "@/lib/analytics-consent";

export function PageviewTracker() {
  const pathname = usePathname();
  const send = useRef<ReturnType<typeof createPageviewSender> | null>(null);
  useEffect(() => {
    send.current ??= createPageviewSender();
    send.current(pathname);
  }, [pathname]);
  return null;
}
