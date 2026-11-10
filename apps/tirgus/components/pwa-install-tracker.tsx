"use client";

import { useEffect } from "react";
import { observePwaAnalytics } from "@/lib/pwa-analytics";

export function PWAInstallTracker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    return observePwaAnalytics();
  }, []);
  return null;
}
