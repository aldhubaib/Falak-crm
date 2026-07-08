const CACHE_NAME = "falak-crm-b4f53c45";

self.addEventListener("install", () => {
  // Don't skipWaiting automatically — wait for user to accept the update
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && url.origin === self.location.origin) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  const data = event.data.json();

  // Cross-device clear: notifications were read on another device — close the
  // matching ones in this device's tray and fix the badge. No new notification
  // is shown.
  if (data.type === "clear") {
    event.waitUntil(
      self.registration.getNotifications().then((shown) => {
        for (const n of shown) {
          if (data.clearAll || (data.tags || []).includes(n.tag)) n.close();
        }
        if (!navigator.setAppBadge) return;
        return data.badge > 0
          ? navigator.setAppBadge(data.badge)
          : navigator.clearAppBadge();
      })
    );
    return;
  }

  const { title, body, url, badge, icon } = data;

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, {
        body: body || "",
        // Falls back to the static icon via /api/public/branding when no
        // custom icon is uploaded in Settings → App Logo.
        icon: icon || "/api/public/branding/androidAny192",
        badge: "/api/public/branding/androidAny192",
        data: { url: url || "/dashboard" },
        vibrate: [200, 100, 200],
        tag: data.tag || undefined,
        renotify: !!data.tag,
      }),
      badge != null && navigator.setAppBadge
        ? navigator.setAppBadge(badge)
        : Promise.resolve(),
    ])
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
