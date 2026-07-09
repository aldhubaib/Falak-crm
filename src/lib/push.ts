import webpush from "web-push";
import * as Sentry from "@sentry/nextjs";
import { db } from "@/lib/db";
import { invalidateInboxCache } from "@/lib/cache";
import { publish, userChannel } from "@/lib/centrifugo";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://panel.falak.media";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(`mailto:admin@falak.media`, VAPID_PUBLIC, VAPID_PRIVATE);
}

interface NotifyPayload {
  recipientId: string;
  type: string;
  title: string;
  body?: string;
  url?: string;
  tag?: string;
  /** Notification icon: sender avatar or project thumbnail. */
  icon?: string;
}

type SubscriptionRow = {
  id: string;
  memberId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

/**
 * Deliver one web push. 410/404 mean the endpoint is dead — delete the row so
 * fan-out stops paying for it. Every other failure is logged to Sentry so
 * dead-endpoint spikes or push-service outages are visible in production.
 */
async function deliverWebPush(sub: SubscriptionRow, payload: string): Promise<void> {
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      payload,
    );
  } catch (err) {
    const statusCode = (err as { statusCode?: number }).statusCode;
    if (statusCode === 410 || statusCode === 404) {
      await db.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
      return;
    }
    Sentry.captureMessage("web-push delivery failed", {
      level: "warning",
      tags: { statusCode: String(statusCode ?? "unknown") },
      extra: { endpointHost: new URL(sub.endpoint).host },
    });
  }
}

/**
 * Single-recipient convenience wrapper around notifyMany — same batched
 * queries and non-blocking push fan-out.
 */
export async function sendNotification(payload: NotifyPayload) {
  const { recipientId, ...rest } = payload;
  await notifyMany([recipientId], rest);
}

// Batched fan-out: one INSERT for all recipients, one grouped unread count,
// one subscription fetch — instead of 3 queries per recipient (an "@all"
// mention used to fire dozens of sequential query triplets).
//
// DB writes are awaited (the caller needs the rows to exist), but the
// web-push HTTP round-trips are fire-and-forget: sending a message must never
// wait on Google's/Apple's/Mozilla's push services.
export async function notifyMany(
  recipientIds: string[],
  payload: Omit<NotifyPayload, "recipientId">,
) {
  const unique = [...new Set(recipientIds)];
  if (unique.length === 0) return;
  const { type, title, body, url, tag, icon } = payload;

  const created = await db.notification.createManyAndReturn({
    data: unique.map((recipientId) => ({
      recipientId,
      type,
      title,
      body,
      linkUrl: url,
      // The push tag the OS notification carries. Null means "the
      // notification's own id" (resolved below) — no second write needed.
      tag,
    })),
    select: { id: true, recipientId: true },
  });

  void invalidateInboxCache(unique);
  // Live bell updates — lets clients skip polling while realtime is up.
  for (const id of unique) {
    void publish(userChannel(id), { type: "notification.new" }).catch(() => {});
  }

  const [unreadRows, subscriptions] = await Promise.all([
    db.notification.groupBy({
      by: ["recipientId"],
      where: { recipientId: { in: unique }, read: false },
      _count: true,
    }),
    db.pushSubscription.findMany({ where: { memberId: { in: unique } } }),
  ]);
  const unreadByMember = new Map(unreadRows.map((r) => [r.recipientId, r._count]));
  const notificationByMember = new Map(created.map((r) => [r.recipientId, r.id]));

  void Promise.allSettled(
    subscriptions.map((sub) =>
      deliverWebPush(
        sub,
        JSON.stringify({
          title,
          body: body || "",
          url: url || "/dashboard",
          badge: unreadByMember.get(sub.memberId) ?? 0,
          tag: tag || notificationByMember.get(sub.memberId),
          icon,
        }),
      ),
    ),
  );
}

/**
 * Mark a member's notifications read by their link URL and sync every device.
 * This is THE read path for "the user opened the page the notification points
 * to" (chat thread, task page, project feed): it flips the rows, drops the
 * cached inbox summary, and clears the matching OS-tray notifications + badge
 * on the member's other devices.
 *
 * Returns the number of notifications cleared.
 */
export async function markReadByLink(
  memberId: string,
  links: { equals?: string[]; startsWith?: string[] },
): Promise<number> {
  const or = [
    ...(links.equals ?? []).map((url) => ({ linkUrl: url })),
    ...(links.startsWith ?? []).map((url) => ({
      linkUrl: { startsWith: url },
    })),
  ];
  if (or.length === 0) return 0;

  const rows = await db.notification.findMany({
    where: { recipientId: memberId, read: false, OR: or },
    select: { id: true, tag: true },
  });
  if (rows.length === 0) return 0;

  await db.notification.updateMany({
    where: { id: { in: rows.map((r) => r.id) } },
    data: { read: true },
  });

  // Awaited so a sidebar/bell refetch fired right after navigation can't race
  // a stale cached summary.
  await invalidateInboxCache([memberId]);

  // Tray + badge sync on other devices is best-effort and must never delay
  // the page render that triggered the read.
  void pushClearToMember(memberId, {
    tags: rows.map((r) => r.tag ?? r.id),
  }).catch(() => {});

  return rows.length;
}

/**
 * Cross-device clear: after notifications are read on one device, tell the
 * member's other devices to remove them from the OS tray and fix the badge.
 *
 * Two delivery paths:
 *  - Centrifugo `notification.read` event on the user channel — devices with
 *    the app open refresh the bell and close matching tray notifications.
 *  - A silent `{ type: "clear" }` web push — reaches devices where the app is
 *    closed. Apple endpoints are skipped: iOS expects every push to show a
 *    notification and may revoke the subscription otherwise; iPhones catch up
 *    via the foreground path the next time the app opens.
 */
export async function pushClearToMember(
  memberId: string,
  opts: { clearAll?: boolean; tags?: string[] },
) {
  const { clearAll = false, tags = [] } = opts;
  if (!clearAll && tags.length === 0) return;

  const unreadCount = await db.notification.count({
    where: { recipientId: memberId, read: false },
  });

  const event = {
    type: "notification.read",
    clearAll,
    tags,
    badge: unreadCount,
  };

  void publish(userChannel(memberId), event).catch(() => {});

  const subscriptions = await db.pushSubscription.findMany({
    where: { memberId },
  });
  const pushPayload = JSON.stringify({ ...event, type: "clear" });

  // Fire-and-forget: clearing trays on other devices must not delay the
  // action (marking read / opening a page) that triggered it.
  void Promise.allSettled(
    subscriptions
      .filter((sub) => !sub.endpoint.includes("push.apple.com"))
      .map((sub) => deliverWebPush(sub, pushPayload)),
  );
}
