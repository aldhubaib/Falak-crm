import webpush from "web-push";
import { db } from "@/lib/db";

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
