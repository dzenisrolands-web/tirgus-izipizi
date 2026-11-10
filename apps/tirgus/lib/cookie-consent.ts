/**
 * Optional tracking defaults off. Memory is authoritative after a decision,
 * including failed persistence, so a failed revoke cannot resurrect old consent.
 */
export const CONSENT_STORAGE_KEY = "cookie-consent-v1";
export const CONSENT_VERSION = 2;
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
  version: CONSENT_VERSION, essential: true, functional: false,
  analytics: false, marketing: false, decidedAt: "",
};

let current: Consent | null = null;
let initialized = false;
const listeners = new Set<() => void>();

function parseConsent(raw: string | null): Consent | null {
  try {
    const value = raw ? JSON.parse(raw) : null;
    if (!value || value.version !== CONSENT_VERSION || value.essential !== true ||
        typeof value.functional !== "boolean" || typeof value.analytics !== "boolean" ||
        typeof value.marketing !== "boolean" || typeof value.decidedAt !== "string" ||
        !Number.isFinite(Date.parse(value.decidedAt)) ||
        new Date(value.decidedAt).toISOString() !== value.decidedAt) return null;
    return {
      version: CONSENT_VERSION, essential: true, functional: value.functional,
      analytics: value.analytics, marketing: value.marketing, decidedAt: value.decidedAt,
    };
  } catch {
    return null;
  }
}

export function readConsent(): Consent | null {
  if (typeof window === "undefined") return null;
  if (!initialized) {
    initialized = true;
    try { current = parseConsent(window.localStorage.getItem(CONSENT_STORAGE_KEY)); }
    catch { current = null; }
  }
  return current;
}

export function hasConsent(category: ConsentCategory): boolean {
  return category === "essential" || readConsent()?.[category] === true;
}

function publish() {
  for (const listener of listeners) listener();
  window.dispatchEvent(new CustomEvent(CONSENT_CHANGED_EVENT, { detail: current }));
}

function onStorage(event: StorageEvent) {
  if (event.key !== CONSENT_STORAGE_KEY && event.key !== null) return;
  // Ignore sessionStorage events; an inaccessible store fails closed.
  try { if (event.storageArea && event.storageArea !== window.localStorage) return; }
  catch { current = null; initialized = true; publish(); return; }
  current = parseConsent(event.newValue);
  initialized = true;
  publish();
}

export function subscribeConsent(listener: () => void): () => void {
  if (listeners.size === 0) window.addEventListener("storage", onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

export function saveConsent(choice: Pick<Consent, "functional" | "analytics" | "marketing">): Consent {
  const next: Consent = {
    ...DEFAULT_CONSENT, functional: choice.functional === true,
    analytics: choice.analytics === true, marketing: choice.marketing === true,
    decidedAt: new Date().toISOString(),
  };
  try { window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(next)); }
  catch {
    // A grant that cannot be stored stays off; a failed revoke stays revoked.
    next.functional = next.analytics = next.marketing = false;
  }
  current = next;
  initialized = true;
  publish();
  return next;
}

export function openCookieSettings() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CONSENT_OPEN_EVENT));
}
