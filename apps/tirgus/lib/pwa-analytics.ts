import { hasConsent } from "./cookie-consent";

type InstallPrompt = Event & {
  userChoice?: Promise<{ outcome: "accepted" | "dismissed" }>;
};
const SESSION_KEY = "tirgus.pwa.standaloneLogged";

function send(type: string) {
  if (!hasConsent("analytics")) return;
  fetch("/api/pwa/event", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type }), keepalive: true,
  }).catch(() => {});
}

/** Detached callbacks check both current consent and the mounted lifecycle. */
export function observePwaAnalytics(): () => void {
  let active = true;
  const standalone = window.matchMedia?.("(display-mode: standalone)")?.matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  try {
    if (hasConsent("analytics") && standalone && !sessionStorage.getItem(SESSION_KEY)) {
      sessionStorage.setItem(SESSION_KEY, "1");
      send("standalone_visit");
    }
  } catch { /* Optional telemetry never blocks storage-restricted browsers. */ }
  const onPrompt = (event: Event) => {
    if (!active || !hasConsent("analytics")) return;
    send("prompt_shown");
    (event as InstallPrompt).userChoice?.then(choice => {
      if (active && hasConsent("analytics")) {
        send(choice.outcome === "accepted" ? "prompt_accepted" : "prompt_dismissed");
      }
    }).catch(() => {});
  };
  window.addEventListener("beforeinstallprompt", onPrompt);
  return () => { active = false; window.removeEventListener("beforeinstallprompt", onPrompt); };
}
