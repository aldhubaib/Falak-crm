import webpush from "web-push";
import { db } from "@/lib/db";
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

export async function sendNotification(payload: NotifyPayload) {
  const { recipientId, type, title, body, url, tag, icon } = payload;

  const notification = await db.notification.create({
    data: {
      recipientId,
      type,
      title,
      body,
      linkUrl: url,
      // The push tag the OS notification will carry. Null means "the
      // notification's own id" (resolved below) — no second write needed.
      tag,
    },
  });

  const unreadCount = await db.notification.count({
    where: { recipientId, read: false },
  });

  const subscriptions = await db.pushSubscription.findMany({
    where: { memberId: recipientId },
  });

  const pushPayload = JSON.stringify({
    title,
    body: body || "",
    url: url || "/dashboard",
    badge: unreadCount,
    tag: tag || notification.id,
    icon,
  });

  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        pushPayload
      ).catch(async (err) => {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await db.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        }
      })
    )
  );

  return { notification, pushResults: results.length };
}

export async function notifyMany(recipientIds: string[], payload: Omit<NotifyPayload, "recipientId">) {
  const unique = [...new Set(recipientIds)];
  await Promise.allSettled(
    unique.map((id) => sendNotification({ ...payload, recipientId: id }))
  );
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

  await Promise.allSettled(
    subscriptions
      .filter((sub) => !sub.endpoint.includes("push.apple.com"))
      .map((sub) =>
        webpush
          .sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            pushPayload,
          )
          .catch(async (err) => {
            if (err.statusCode === 410 || err.statusCode === 404) {
              await db.pushSubscription
                .delete({ where: { id: sub.id } })
                .catch(() => {});
            }
          }),
      ),
  );
}
