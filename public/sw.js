const CACHE_NAME = "falak-crm-6b936df9";
// Embedded at generation time (scripts/generate-sw.mjs) so the SW can
// re-subscribe to push without a page being open.
const VAPID_PUBLIC_KEY = "";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

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

  // Never intercept React Server Component payloads: caching them serves
  // stale UI after deploys and can desync client-side navigation.
  if (url.searchParams.has("_rsc") || event.request.headers.get("RSC") === "1") {
    return;
  }

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
    (async () => {
      // Skip the OS notification when the user is already looking at the
      // target page (the in-app UI shows the message instantly). Never skip on
      // Apple endpoints: iOS revokes the push subscription if a push doesn't
      // produce a visible notification.
      let suppress = false;
      const subscription = await self.registration.pushManager.getSubscription();
      const isApple =
        subscription && subscription.endpoint.includes("push.apple.com");
      if (!isApple && url) {
        const windowClients = await clients.matchAll({
          type: "window",
          includeUncontrolled: true,
        });
        const targetPath = new URL(url, self.location.origin).pathname;
        suppress = windowClients.some(
          (client) =>
            client.visibilityState === "visible" &&
            new URL(client.url).pathname === targetPath
        );
      }

      await Promise.all([
        suppress
          ? Promise.resolve()
          : self.registration.showNotification(title, {
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
      ]);
    })()
  );
});

// Browsers rotate push subscriptions (key expiry, endpoint refresh). Without
// this handler the device silently stops receiving pushes until the user next
// opens the app. Re-subscribe immediately and hand the new endpoint to the
// server, referencing the old one so the server can transfer the row even if
// the session cookie has gone stale.
self.addEventListener("pushsubscriptionchange", (event) => {
  if (!VAPID_PUBLIC_KEY || VAPID_PUBLIC_KEY.startsWith("__")) return;
  const oldEndpoint =
    (event.oldSubscription && event.oldSubscription.endpoint) || null;

  event.waitUntil(
    self.registration.pushManager
      .subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
      .then((subscription) => {
        const sub = subscription.toJSON();
        return fetch("/api/push/resubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            oldEndpoint,
            endpoint: sub.endpoint,
            keys: sub.keys,
            userAgent: navigator.userAgent,
          }),
        });
      })
      .catch(() => {})
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
