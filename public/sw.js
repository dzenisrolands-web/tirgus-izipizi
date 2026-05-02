// Service worker for tirgus.izipizi.lv PWA.
// Two responsibilities:
//   1. Web Push notifications (existing — used by hot drops)
//   2. Network-first fetch handler so the SW counts as "active" for
//      Chrome's PWA install criteria. We don't aggressively cache yet
//      (catalog data should always be fresh) — just pass-through.
const CACHE_VERSION = "v1";

self.addEventListener("install", (event) => {
  // Skip waiting so updated SW takes over the next page load
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  // Only handle GET — POSTs / mutations must always hit network
  if (req.method !== "GET") return;
  // Skip cross-origin and non-http(s)
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (!url.protocol.startsWith("http")) return;

  // Network-first with no caching for now. Just being a registered SW
  // with a fetch handler is enough for the install prompt.
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
