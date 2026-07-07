// App icon badge helpers for the installed PWA.
//
// Two mechanisms feed the launcher badge:
//  1. The Badging API (navigator.setAppBadge) — used on desktop and by some
//     Android launchers.
//  2. Android launchers count the push notifications still sitting in the
//     system tray. clearAppBadge() alone does NOT remove those, so the badge
//     looks "stuck" until each notification is tapped or swiped away. We must
//     close them explicitly once their content has been read in-app.

/** Mirror the unread count on the OS app icon and, when everything is read,
 *  close any push notifications still displayed in the system tray. */
export async function syncAppBadge(unreadCount: number) {
  const nav = navigator as Navigator & {
    setAppBadge?: (count: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };
  try {
    if (unreadCount > 0) await nav.setAppBadge?.(unreadCount);
    else await nav.clearAppBadge?.();
  } catch {
    // Badging unsupported — ignore.
  }
  if (unreadCount === 0) await closeDisplayedNotifications();
}

/** Close push notifications shown by the service worker. With no predicate,
 *  closes all of them; otherwise only those whose target URL matches. */
export async function closeDisplayedNotifications(
  matchUrl?: (url: string) => boolean,
) {
  if (!("serviceWorker" in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return;
    const notifications = await registration.getNotifications();
    for (const n of notifications) {
      const url = (n.data as { url?: string } | undefined)?.url;
      if (!matchUrl || (url && matchUrl(url))) n.close();
    }
  } catch {
    // Best-effort — tray state just stays as is.
  }
}

/** Close the tray notifications shown with any of these push tags. */
export async function closeDisplayedNotificationsByTag(tags: string[]) {
  if (tags.length === 0 || !("serviceWorker" in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return;
    const notifications = await registration.getNotifications();
    for (const n of notifications) {
      if (tags.includes(n.tag)) n.close();
    }
  } catch {
    // Best-effort — tray state just stays as is.
  }
}
