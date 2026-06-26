"use server";

import { db } from "@/lib/db";
import { requireWorkspaceWithMember } from "@/lib/workspace";

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

  await db.notification.updateMany({
    where: { id, recipientId: member.id },
    data: { read: true },
  });
}

export async function markAllNotificationsRead() {
  const { member } = await requireWorkspaceWithMember();

  await db.notification.updateMany({
    where: { recipientId: member.id, read: false },
    data: { read: true },
  });
}
