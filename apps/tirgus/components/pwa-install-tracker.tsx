"use client";

import { useEffect } from "react";

// Tracks PWA install lifecycle to /api/pwa/event:
//   • prompt_shown      — browser fired beforeinstallprompt
//   • prompt_accepted   — user accepted install
//   • prompt_dismissed  — user dismissed
//   • standalone_visit  — page loaded inside an installed PWA
//
// Each tab fires standalone_visit at most once per session (sessionStorage
// guard) so we don't double-count internal navigation.

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const SESSION_KEY = "tirgus.pwa.standaloneLogged";

function send(type: string) {
  // Fire-and-forget; never block UX on telemetry
  fetch("/api/pwa/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type }),
    keepalive: true,
  }).catch(() => {});
}

export function PWAInstallTracker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;

    // Detect standalone (PWA was launched from home screen) once per session
    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)")?.matches ||
      // iOS-specific
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (isStandalone && !sessionStorage.getItem(SESSION_KEY)) {
      sessionStorage.setItem(SESSION_KEY, "1");
      send("standalone_visit");
    }

    function onBeforeInstallPrompt(e: Event) {
      send("prompt_shown");
      const evt = e as BeforeInstallPromptEvent;
      // Don't preventDefault — let the browser's UI handle it. Just track outcome.
      evt.userChoice
        ?.then((choice) => {
          send(choice.outcome === "accepted" ? "prompt_accepted" : "prompt_dismissed");
        })
        .catch(() => {});
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  return null;
}
