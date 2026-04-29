"use client";

import { openCookieSettings } from "@/lib/cookie-consent";

export function CookieSettingsLink({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={openCookieSettings}
      className={className ?? "text-sm text-gray-600 hover:text-brand-600"}
    >
      Sīkdatņu iestatījumi
    </button>
  );
}
