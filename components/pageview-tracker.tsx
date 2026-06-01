"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Fires a page view event on every client-side route change.
 * Placed once in the root layout. Fire-and-forget — never blocks rendering.
 */
export function PageviewTracker() {
  const pathname = usePathname();
  const lastPath = useRef("");

  useEffect(() => {
    // Skip duplicate fires for the same path
    if (pathname === lastPath.current) return;
    lastPath.current = pathname;

    // Skip admin/dashboard paths to reduce noise
    if (pathname.startsWith("/admin") || pathname.startsWith("/dashboard")) return;

    fetch("/api/track-pageview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: pathname,
        referrer: document.referrer || null,
      }),
    }).catch(() => {});
  }, [pathname]);

  return null;
}
