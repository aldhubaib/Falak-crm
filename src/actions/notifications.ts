"use server";

import { db } from "@/lib/db";
import { requireWorkspaceWithMember } from "@/lib/workspace";
import { pushClearToMember } from "@/lib/push";
import { invalidateInboxCache } from "@/lib/cache";

export async function getNotifications(limit = 30) {
  const { member } = await requireWorkspaceWithMember();

  return db.notification.findMany({
    where: { recipientId: member.id },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getUnreadCount(): Promise<number> {
  const { member } = await requireWorkspaceWithMember();

  return db.notification.count({
    where: { recipientId: member.id, read: false },
  });
}

export async function markNotificationRead(id: string) {
  const { member } = await requireWorkspaceWithMember();

  const row = await db.notification.findFirst({
    where: { id, recipientId: member.id },
    select: { id: true, tag: true, read: true },
  });
  if (!row) return;

  await db.notification.update({
    where: { id: row.id },
    data: { read: true },
  });

  // Sync other devices: close this notification in their OS tray and fix the
  // badge. Skipped when it was already read (nothing to clear).
  if (!row.read) {
    void invalidateInboxCache([member.id]);
    await pushClearToMember(member.id, { tags: [row.tag ?? row.id] }).catch(
      () => {},
    );
  }
}

export async function markAllNotificationsRead() {
  const { member } = await requireWorkspaceWithMember();

  const { count } = await db.notification.updateMany({
    where: { recipientId: member.id, read: false },
    data: { read: true },
  });

  if (count > 0) {
    void invalidateInboxCache([member.id]);
    await pushClearToMember(member.id, { clearAll: true }).catch(() => {});
  }
}
