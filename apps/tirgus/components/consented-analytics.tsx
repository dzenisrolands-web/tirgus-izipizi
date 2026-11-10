"use client";

import { useSyncExternalStore } from "react";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { PageviewTracker } from "@/components/pageview-tracker";
import { PWAInstallTracker } from "@/components/pwa-install-tracker";
import { CONSENT_CHANGED_EVENT, hasConsent } from "@/lib/cookie-consent";

function subscribe(onChange: () => void) {
  window.addEventListener(CONSENT_CHANGED_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CONSENT_CHANGED_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function ConsentedAnalytics() {
  const enabled = useSyncExternalStore(subscribe, () => hasConsent("analytics"), () => false);
  if (!enabled) return null;
  return <>
    <Analytics beforeSend={(event) => hasConsent("analytics") ? event : null} />
    <SpeedInsights beforeSend={(event) => hasConsent("analytics") ? event : null} />
    <PageviewTracker /><PWAInstallTracker />
  </>;
}
