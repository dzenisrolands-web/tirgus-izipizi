"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { PageviewTracker } from "./pageview-tracker";
import { PWAInstallTracker } from "./pwa-install-tracker";
import { hasConsent, subscribeConsent } from "@/lib/cookie-consent";
import { consentedAnalyticsEvent, observeAnalyticsConsent } from "@/lib/analytics-consent";

const snapshot = () => hasConsent("analytics");
const serverSnapshot = () => false;

export function ConsentedAnalytics() {
  const enabled = useSyncExternalStore(subscribeConsent, snapshot, serverSnapshot);
  useEffect(observeAnalyticsConsent, []);
  if (!enabled) return null;
  return <>
    <Analytics beforeSend={consentedAnalyticsEvent} />
    <SpeedInsights beforeSend={consentedAnalyticsEvent} />
    <PageviewTracker />
    <PWAInstallTracker />
  </>;
}
