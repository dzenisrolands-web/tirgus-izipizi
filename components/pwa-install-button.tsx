"use client";

import { Download, X } from "lucide-react";
import { useEffect, useState } from "react";

// Captures the browser's beforeinstallprompt event and exposes a button.
// Hidden when:
//   • app is running in standalone mode (already installed as PWA)
//   • getInstalledRelatedApps() reports the app is installed
//   • user dismissed within the last 30 days (localStorage TTL)
//   • browser never fires beforeinstallprompt (unsupported)
//
// Positioned bottom-LEFT to avoid conflict with Paysera quality badge
// and the feedback widget (both bottom-right).

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "tirgus.pwa.dismissedAt";
const DISMISS_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function isDismissed(): boolean {
  try {
    const ts = localStorage.getItem(DISMISS_KEY);
    if (!ts) return false;
    return Date.now() - Number(ts) < DISMISS_TTL_MS;
  } catch {
    return false;
  }
}

function saveDismiss() {
  try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
}

export function PWAInstallButton() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Already dismissed recently?
    if (isDismissed()) return;

    // Already running as installed PWA?
    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)")?.matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (isStandalone) return;

    // Check via getInstalledRelatedApps if available (Chrome Android)
    type NavWithInstalled = Navigator & {
      getInstalledRelatedApps?: () => Promise<unknown[]>;
    };
    (navigator as NavWithInstalled).getInstalledRelatedApps?.().then((apps) => {
      if (apps && apps.length > 0) {
        // App is already installed — keep button hidden
        saveDismiss();
      }
    }).catch(() => {});

    // iOS Safari: no beforeinstallprompt, show manual hint instead
    const ua = navigator.userAgent;
    const isIOS = /iPhone|iPad|iPod/.test(ua) && !(window as Window & { MSStream?: unknown }).MSStream;
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    if (isIOS && isSafari) {
      setIosHint(true);
      setHidden(false);
      return;
    }

    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setHidden(false);
    }
    function onAppInstalled() {
      saveDismiss();
      setHidden(true);
      setDeferred(null);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  function dismiss() {
    saveDismiss();
    setHidden(true);
  }

  async function install() {
    if (!deferred) return;
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") {
        saveDismiss();
        setHidden(true);
      }
    } catch {
      // ignore
    } finally {
      setDeferred(null);
    }
  }

  if (hidden) return null;

  // Shared card style — bottom-LEFT to avoid Paysera badge + feedback widget (both right)
  const cardCls = "fixed bottom-20 left-3 z-40 w-[300px] max-w-[calc(100vw-1.5rem)] rounded-2xl border border-gray-200 bg-white p-3 shadow-lg md:bottom-5";

  // iOS hint variant
  if (iosHint) {
    return (
      <div className={cardCls}>
        <button onClick={dismiss} aria-label="Aizvērt"
          className="absolute right-2 top-2 rounded p-1 text-gray-400 hover:bg-gray-100">
          <X size={14} />
        </button>
        <div className="flex items-start gap-3 pr-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#192635] text-white">
            <Download size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">Pievieno Tirgu sākumekrānam</p>
            <p className="mt-0.5 text-xs text-gray-500">
              Safari → <span className="font-medium">Share</span> → <span className="font-medium">Add to Home Screen</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Native install prompt (Android Chrome / desktop)
  return (
    <div className={cardCls}>
      <button onClick={dismiss} aria-label="Aizvērt"
        className="absolute right-2 top-2 rounded p-1 text-gray-400 hover:bg-gray-100">
        <X size={14} />
      </button>
      <div className="flex items-center gap-3 pr-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#192635] text-white">
          <Download size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900">Instalē Tirgu</p>
          <p className="text-xs text-gray-500">Ātrāk · push paņojumi · piln ekrānā</p>
        </div>
        <button onClick={install}
          className="shrink-0 rounded-xl bg-[#53F3A4] px-3 py-1.5 text-xs font-bold text-[#192635] hover:brightness-95">
          Instalēt
        </button>
      </div>
    </div>
  );
}
