// Service worker for tirgus.izipizi.lv PWA.
// Responsibilities:
//   1. Web Push notifications (existing — used by hot drops)
//   2. Network-first fetch handler with offline fallback page
//      so the SW qualifies as "active" for the install prompt AND
//      can show /offline.html when the user goes off-grid.
const CACHE_VERSION = "v2";
const OFFLINE_CACHE = `tirgus-offline-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(OFFLINE_CACHE).then((cache) => cache.add(OFFLINE_URL)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      // Drop old offline caches
      caches.keys().then((keys) =>
        Promise.all(keys.filter((k) => k.startsWith("tirgus-offline-") && k !== OFFLINE_CACHE).map((k) => caches.delete(k))),
      ),
      self.clients.claim(),
    ]),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (!url.protocol.startsWith("http")) return;

  // Navigation requests (HTML pages): network-first, fall back to /offline.html
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match(OFFLINE_URL).then((r) => r ?? Response.error())),
    );
    return;
  }
  // Everything else: pass-through, no caching (catalog data must stay fresh).
  event.respondWith(fetch(req).catch(() => Response.error()));
});

self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? "Jauns drops!", {
      body: data.body ?? "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.tag ?? "drop",
      renotify: true,
      data: { url: data.url ?? "/keriens" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(event.notification.data?.url);
          return client.focus();
        }
      }
      return clients.openWindow(event.notification.data?.url ?? "/keriens");
    })
  );
});
