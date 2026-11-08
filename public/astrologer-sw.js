/*
 * Astrounkle Partner service worker (scope /astrologer/).
 *
 * Only handles notifications: it does NOT cache pages or API calls, so the
 * panel never shows stale money or session data and auth is unaffected.
 *   • push              → show the alert (requests stay on screen until acted on)
 *   • notificationclick → focus an open panel tab or open the target page
 */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "Astrounkle Partner", body: event.data ? event.data.text() : "" };
  }
  const title = typeof data.title === "string" ? data.title.slice(0, 80) : "Astrounkle Partner";
  const isRequest = data.kind === "request";
  const url = typeof data.url === "string" && data.url.startsWith("/astrologer") ? data.url : "/astrologer";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof data.body === "string" ? data.body.slice(0, 200) : "",
      tag: typeof data.tag === "string" ? data.tag : undefined,
      icon: "/images/image1.png",
      badge: "/images/image1.png",
      requireInteraction: isRequest,
      renotify: isRequest,
      vibrate: isRequest ? [300, 150, 300, 150, 300] : undefined,
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/astrologer";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (new URL(c.url).pathname.startsWith("/astrologer") && "focus" in c) {
          c.navigate(target).catch(() => undefined);
          return c.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
