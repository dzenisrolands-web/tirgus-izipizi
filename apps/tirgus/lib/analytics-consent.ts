import { hasConsent, subscribeConsent } from "./cookie-consent";

export const GA_MEASUREMENT_ID = "G-VD3DEWCQ5Q";
const GA_SCRIPT_ID = "consented-google-analytics";
type AnalyticsWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  [key: `ga-disable-${string}`]: boolean;
};

function googleWindow(): AnalyticsWindow {
  return window as unknown as AnalyticsWindow;
}

function queueGoogleCommand(...args: unknown[]) {
  const target = googleWindow();
  target.dataLayer ??= [];
  // gtag's documented queue uses Arguments objects, not generic data-layer arrays.
  // eslint-disable-next-line prefer-rest-params
  if (args.length) target.dataLayer.push(arguments);
}

/** Called synchronously on every decision, not only after React unmounts. */
export function syncAnalyticsConsent() {
  const target = googleWindow();
  const enabled = hasConsent("analytics");
  target[`ga-disable-${GA_MEASUREMENT_ID}`] = !enabled;
  if (!enabled) {
    if (target.dataLayer) queueGoogleCommand("consent", "update", {
      analytics_storage: "denied", ad_storage: "denied",
      ad_user_data: "denied", ad_personalization: "denied",
    });
    return;
  }
  if (!target.gtag) {
    target.gtag = (...args) => {
      if (hasConsent("analytics")) queueGoogleCommand(...args);
    };
    queueGoogleCommand("consent", "default", {
      analytics_storage: "granted", ad_storage: "denied",
      ad_user_data: "denied", ad_personalization: "denied",
    });
    target.gtag("js", new Date());
    target.gtag("config", GA_MEASUREMENT_ID, { send_page_view: false });
  } else {
    queueGoogleCommand("consent", "update", { analytics_storage: "granted" });
  }
  if (!document.getElementById(GA_SCRIPT_ID)) {
    const script = document.createElement("script");
    script.id = GA_SCRIPT_ID;
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    document.head.appendChild(script);
  }
}

export function observeAnalyticsConsent(): () => void {
  syncAnalyticsConsent();
  return subscribeConsent(syncAnalyticsConsent);
}

/** This is also used by SDK beforeSend hooks after the SDK has been loaded. */
export function consentedAnalyticsEvent<T>(event: T): T | null {
  return hasConsent("analytics") ? event : null;
}

/** One tracker instance per consent-enabled mount; grant tracks current path. */
export function createPageviewSender() {
  let lastPath = "";
  return (path: string) => {
    if (!hasConsent("analytics") || path === lastPath) return;
    lastPath = path;
    if (/^\/(?:admin|dashboard)(?:\/|$)/.test(path)) return;
    syncAnalyticsConsent();
    googleWindow().gtag?.("event", "page_view", { page_path: path });
    if (!hasConsent("analytics")) return;
    fetch("/api/track-pageview", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, referrer: document.referrer || null }),
    }).catch(() => {});
  };
}
