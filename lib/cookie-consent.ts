/**
 * Cookie consent helper — accessible from any client component.
 * Read whether user has consented to a category, listen for changes.
 */

export const CONSENT_STORAGE_KEY = "cookie-consent-v1";
export const CONSENT_VERSION = 1;
export const CONSENT_OPEN_EVENT = "open-cookie-settings";
export const CONSENT_CHANGED_EVENT = "cookie-consent-changed";

export type ConsentCategory = "essential" | "functional" | "analytics" | "marketing";

export type Consent = {
  version: number;
  essential: true;
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
  decidedAt: string;
};

export const DEFAULT_CONSENT: Consent = {
  version: CONSENT_VERSION,
  essential: true,
  functional: false,
  analytics: false,
  marketing: false,
  decidedAt: "",
};

export function readConsent(): Consent | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Consent;
    if (parsed.version !== CONSENT_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function hasConsent(category: ConsentCategory): boolean {
  if (category === "essential") return true;
  const c = readConsent();
  return c ? c[category] === true : false;
}

export function openCookieSettings() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CONSENT_OPEN_EVENT));
}
