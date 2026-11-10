import "./react-runtime";
import { test, expect } from "@playwright/test";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  CONSENT_STORAGE_KEY, CONSENT_VERSION, DEFAULT_CONSENT, hasConsent,
  readConsent, saveConsent, subscribeConsent, openCookieSettings, CONSENT_OPEN_EVENT,
} from "../../lib/cookie-consent";
import {
  GA_MEASUREMENT_ID, observeAnalyticsConsent, createPageviewSender, consentedAnalyticsEvent,
} from "../../lib/analytics-consent";
import { observePwaAnalytics } from "../../lib/pwa-analytics";
import { ConsentedAnalytics } from "../../components/consented-analytics";

type Script = { id: string; async: boolean; src: string };
const target = new EventTarget();
const store = new Map<string, string>();
const sessions = new Map<string, string>();
const scripts: Script[] = [];
let readsBlocked = false;
let writesBlocked = false;
let standalone = false;
const storage = {
  getItem: (key: string) => { if (readsBlocked) throw new Error("Blocked read"); return store.get(key) ?? null; },
  setItem: (key: string, value: string) => { if (writesBlocked) throw new Error("Blocked write"); store.set(key, value); },
};
const fakeWindow = Object.assign(target, {
  localStorage: storage,
  matchMedia: () => ({ matches: standalone }),
  dataLayer: undefined as unknown[] | undefined,
  gtag: undefined as ((...args: unknown[]) => void) | undefined,
});
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
const originalSession = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
const originalFetch = globalThis.fetch;
const sent: { path: string; body: Record<string, unknown> }[] = [];
const stops: (() => void)[] = [];

function crossTab(value: unknown) {
  const event = new Event("storage");
  Object.assign(event, { key: CONSENT_STORAGE_KEY, newValue: value == null ? null : JSON.stringify(value), storageArea: storage });
  fakeWindow.dispatchEvent(event);
}
const choice = (analytics: boolean) => ({ functional: false, analytics, marketing: false });
const recorded = (analytics = true) => ({
  ...DEFAULT_CONSENT, analytics, decidedAt: "2026-11-10T00:00:00.000Z",
});
const commands = () => (fakeWindow.dataLayer ?? []).map(command => Array.from(command as ArrayLike<unknown>));

test.beforeAll(() => {
  Object.defineProperty(fakeWindow, "localStorage", { configurable: true, get: () => {
    if (readsBlocked) throw new Error("Blocked storage");
    return storage;
  } });
  Object.defineProperty(globalThis, "window", { configurable: true, value: fakeWindow });
  Object.defineProperty(globalThis, "document", { configurable: true, value: {
    referrer: "https://example.invalid/referrer",
    getElementById: (id: string) => scripts.find(script => script.id === id),
    createElement: () => ({ id: "", async: false, src: "" }),
    head: { appendChild: (script: Script) => { scripts.push(script); } },
  } });
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: {
    getItem: (key: string) => sessions.get(key) ?? null,
    setItem: (key: string, value: string) => sessions.set(key, value),
  } });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { standalone: false } });
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), "https://example.invalid");
    if (url.origin !== "https://example.invalid") throw new Error("Non-dummy network forbidden");
    sent.push({ path: url.pathname, body: JSON.parse(String(init?.body ?? "{}")) });
    return Response.json({ ok: true });
  };
});
test.beforeEach(() => {
  readsBlocked = writesBlocked = standalone = false;
  sent.length = scripts.length = 0;
  store.clear(); sessions.clear();
  fakeWindow.dataLayer = undefined; fakeWindow.gtag = undefined;
  stops.push(subscribeConsent(() => {}));
  crossTab(null);
});
test.afterEach(() => { while (stops.length) stops.pop()!(); });
test.afterAll(() => {
  for (const [key, descriptor] of [
    ["window", originalWindow], ["document", originalDocument],
    ["sessionStorage", originalSession], ["navigator", originalNavigator],
  ] as const) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
  globalThis.fetch = originalFetch;
});

test("SSR/default/reject-all never loads or sends analytics", () => {
  expect(renderToStaticMarkup(<ConsentedAnalytics />)).toBe("");
  stops.push(observeAnalyticsConsent());
  createPageviewSender()("/catalog");
  expect(readConsent()).toBeNull();
  expect(scripts).toHaveLength(0);
  expect(sent).toHaveLength(0);
  expect(consentedAnalyticsEvent({ type: "pageview" })).toBeNull();
  saveConsent(choice(false));
  createPageviewSender()("/contact");
  expect(scripts).toHaveLength(0);
  expect(sent).toHaveLength(0);
});

test("explicit initial grant loads/configures original GA ID and tracks current page once", () => {
  stops.push(observeAnalyticsConsent());
  const send = createPageviewSender();
  send("/catalog");
  saveConsent(choice(true));
  send("/catalog"); send("/catalog");
  expect(scripts).toHaveLength(1);
  expect(scripts[0].src).toBe(`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`);
  expect(commands().filter(command => command[0] === "config")).toEqual([["config", GA_MEASUREMENT_ID, { send_page_view: false }]]);
  expect(commands().filter(command => command[0] === "event")).toHaveLength(1);
  expect(sent).toHaveLength(1);
  expect(sent[0].body.path).toBe("/catalog");
  send("/contact"); send("/contact"); send("/admin"); send("/dashboard/orders");
  expect(sent.map(item => item.body.path)).toEqual(["/catalog", "/contact"]);
});

test("revoke immediately disables GA, custom and Vercel late events without relying on unmount", () => {
  stops.push(observeAnalyticsConsent());
  saveConsent(choice(true));
  const send = createPageviewSender();
  send("/");
  saveConsent(choice(false));
  const previous = sent.length;
  const queueLength = commands().length;
  fakeWindow.gtag?.("event", "late_event");
  send("/catalog");
  expect(commands()).toHaveLength(queueLength);
  expect(sent).toHaveLength(previous);
  expect((fakeWindow as unknown as Record<string, unknown>)[`ga-disable-${GA_MEASUREMENT_ID}`]).toBe(true);
  expect(consentedAnalyticsEvent({ type: "pageview" })).toBeNull();
  expect(commands().at(-1)).toMatchObject(["consent", "update", { analytics_storage: "denied" }]);
});

test("failed writes deny grant and failed revoke stays denied over stale stored true", () => {
  stops.push(observeAnalyticsConsent());
  writesBlocked = true;
  saveConsent(choice(true));
  expect(hasConsent("analytics")).toBe(false);
  expect(scripts).toHaveLength(0);
  writesBlocked = false;
  saveConsent(choice(true));
  expect(JSON.parse(store.get(CONSENT_STORAGE_KEY)!).analytics).toBe(true);
  writesBlocked = true;
  saveConsent(choice(false));
  expect(JSON.parse(store.get(CONSENT_STORAGE_KEY)!).analytics).toBe(true);
  expect(readConsent()?.analytics).toBe(false);
  createPageviewSender()("/catalog");
  expect(sent).toHaveLength(0);
  expect((fakeWindow as unknown as Record<string, unknown>)[`ga-disable-${GA_MEASUREMENT_ID}`]).toBe(true);
});

test("blocked reads, malformed flags/timestamps and old version fail closed", () => {
  readsBlocked = true;
  crossTab(recorded());
  expect(hasConsent("analytics")).toBe(false);
  readsBlocked = false;
  for (const invalid of [
    {}, { ...recorded(), version: CONSENT_VERSION - 1 }, { ...recorded(), analytics: "true" },
    { ...recorded(), functional: undefined }, { ...recorded(), essential: false },
    { ...recorded(), decidedAt: "not-a-date" }, { ...recorded(), decidedAt: "123" },
    { ...recorded(), decidedAt: "2026-02-30T00:00:00.000Z" },
  ]) {
    crossTab(invalid);
    expect(readConsent()).toBeNull();
    expect(hasConsent("analytics")).toBe(false);
  }
});

test("cross-tab decisions and reopened settings reflect current memory including failed revoke", () => {
  stops.push(observeAnalyticsConsent());
  crossTab(recorded());
  expect(hasConsent("analytics")).toBe(true);
  crossTab(recorded(false));
  expect(hasConsent("analytics")).toBe(false);
  crossTab(recorded());
  writesBlocked = true;
  saveConsent(choice(false));
  let reopened: boolean | undefined;
  const onOpen = () => { reopened = readConsent()?.analytics; };
  fakeWindow.addEventListener(CONSENT_OPEN_EVENT, onOpen);
  openCookieSettings();
  fakeWindow.removeEventListener(CONSENT_OPEN_EVENT, onOpen);
  expect(reopened).toBe(false);
});

test("grant revoke grant has one script/config; new mount sends exactly one current page", () => {
  stops.push(observeAnalyticsConsent());
  saveConsent(choice(true));
  const first = createPageviewSender();
  first("/catalog"); first("/catalog");
  saveConsent(choice(false)); first("/contact");
  saveConsent(choice(true));
  const second = createPageviewSender();
  second("/contact"); second("/contact");
  expect(sent.map(item => item.body.path)).toEqual(["/catalog", "/contact"]);
  expect(scripts).toHaveLength(1);
  expect(commands().filter(command => command[0] === "config")).toHaveLength(1);
});

test("PWA denied/late callbacks and grant-revoke-grant lifecycle never leak or duplicate", async () => {
  let resolveChoice!: (value: { outcome: "accepted" }) => void;
  const prompt = () => Object.assign(new Event("beforeinstallprompt"), {
    userChoice: new Promise<{ outcome: "accepted" }>(resolve => { resolveChoice = resolve; }),
  });
  const stopDenied = observePwaAnalytics();
  fakeWindow.dispatchEvent(prompt());
  expect(sent).toHaveLength(0);
  stopDenied();
  saveConsent(choice(true));
  const stopFirst = observePwaAnalytics();
  fakeWindow.dispatchEvent(prompt());
  expect(sent.map(item => item.body.type)).toEqual(["prompt_shown"]);
  saveConsent(choice(false));
  resolveChoice({ outcome: "accepted" });
  await Promise.resolve();
  expect(sent.map(item => item.body.type)).toEqual(["prompt_shown"]);
  stopFirst();
  saveConsent(choice(true));
  const stopSecond = observePwaAnalytics();
  fakeWindow.dispatchEvent(prompt());
  stopSecond(); // A pending old callback must stay dead even if consent remains true.
  resolveChoice({ outcome: "accepted" });
  await Promise.resolve();
  expect(sent.map(item => item.body.type)).toEqual(["prompt_shown", "prompt_shown"]);
});

test("PWA standalone sends once per consented session and touches no essential keys", () => {
  standalone = true;
  stops.push(observePwaAnalytics());
  expect(sent).toHaveLength(0);
  expect(sessions.size).toBe(0);
  saveConsent(choice(true));
  stops.push(observePwaAnalytics());
  stops.push(observePwaAnalytics());
  expect(sent.map(item => item.body.type)).toEqual(["standalone_visit"]);
  expect([...sessions.keys()]).toEqual(["tirgus.pwa.standaloneLogged"]);
  expect([...store.keys()]).toEqual([CONSENT_STORAGE_KEY]);
});

test("root is SDK-free before consent and wrapper dynamically mounts current-path tracker", () => {
  const source = (path: string) => readFileSync(resolve(__dirname, "../..", path), "utf8");
  expect(source("app/layout.tsx")).not.toContain("googletagmanager");
  expect(source("app/layout.tsx")).toContain("<ConsentedAnalytics />");
  const wrapper = source("components/consented-analytics.tsx");
  expect(wrapper).toContain("useSyncExternalStore(subscribeConsent, snapshot, serverSnapshot)");
  expect(wrapper).toContain("if (!enabled) return null");
  expect(wrapper.match(/beforeSend=\{consentedAnalyticsEvent\}/g)).toHaveLength(2);
  expect(source("components/cookie-consent.tsx")).toContain("refresh();");
});
