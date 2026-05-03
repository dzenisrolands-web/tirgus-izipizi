"use client";

import { Download, X } from "lucide-react";
import { useEffect, useState } from "react";

// Captures the browser's beforeinstallprompt event and exposes a button.
// Hidden when:
//   • we never received the event (browser doesn't support PWA install, or user
//     already installed, or quota not yet met),
//   • the page is already running standalone (PWA already installed),
//   • the user dismissed our promo this session (sessionStorage flag).
//
// On iOS Safari there's no beforeinstallprompt — instead we show a one-line
// "Pievienot sākumekrānam: Share → Add to Home Screen" hint when the user
// looks like they're on iOS Safari and not already installed.

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "tirgus.pwa.installPromptDismissed";

export function PWAInstallButton() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(DISMISS_KEY)) return;

    // Already installed?
    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)")?.matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (isStandalone) return;

    // iOS Safari fallback
    const ua = navigator.userAgent;
    const isIOS = /iPhone|iPad|iPod/.test(ua) && !(window as Window & { MSStream?: unknown }).MSStream;
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    if (isIOS && isSafari) {
      setIosHint(true);
      setHidden(false);
      return;
    }

    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault(); // hold the prompt; we'll fire it on click
      setDeferred(e as BeforeInstallPromptEvent);
      setHidden(false);
    }
    function onAppInstalled() {
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
    sessionStorage.setItem(DISMISS_KEY, "1");
    setHidden(true);
  }

  async function install() {
    if (!deferred) return;
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") setHidden(true);
    } catch {
      // ignore
    } finally {
      setDeferred(null);
    }
  }

  if (hidden) return null;

  // iOS hint variant
  if (iosHint) {
    return (
      <div className="fixed bottom-20 left-3 right-3 z-40 mx-auto max-w-md rounded-2xl border border-gray-200 bg-white p-3 shadow-lg sm:bottom-3 md:bottom-4 md:left-auto md:right-4">
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
    <div className="fixed bottom-20 left-3 right-3 z-40 mx-auto max-w-md rounded-2xl border border-gray-200 bg-white p-3 shadow-lg sm:bottom-3 md:bottom-4 md:left-auto md:right-4">
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
          <p className="text-xs text-gray-500">Ātrāk · push paziņojumi · pilnekrānā</p>
        </div>
        <button onClick={install}
          className="shrink-0 rounded-xl bg-[#53F3A4] px-3 py-1.5 text-xs font-bold text-[#192635] hover:brightness-95">
          Instalēt
        </button>
      </div>
    </div>
  );
}
