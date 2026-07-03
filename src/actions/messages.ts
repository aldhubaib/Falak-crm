"use server";

import { db } from "@/lib/db";
import { requireWorkspaceWithMember } from "@/lib/workspace";

export type InboxThread = {
  id: string;
  kind: "project" | "notification";
  name: string;
  subtitle: string;
  projectId: string;
  taskId: string | null;
  lastMessage: string;
  lastAuthor: string;
  lastAt: string;
  unread: number;
  avatar: string;
  initials: string;
};

export async function getInboxThreads(): Promise<InboxThread[]> {
  const { workspace, member } = await requireWorkspaceWithMember();

  const tasks = await db.task.findMany({
    where: {
      deletedAt: null,
      project: { workspaceId: workspace.id, deletedAt: null },
      comments: { some: {} },
    },
    select: {
      id: true,
      title: true,
      projectId: true,
      project: { select: { name: true } },
      comments: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          author: { select: { id: true, name: true, email: true } },
        },
      },
      _count: { select: { comments: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const unreadCounts = await db.notification.groupBy({
    by: ["linkUrl"],
    where: {
      recipientId: member.id,
      read: false,
      linkUrl: { not: null },
    },
    _count: true,
  });

  const unreadMap = new Map<string, number>();
  for (const row of unreadCounts) {
    if (row.linkUrl) unreadMap.set(row.linkUrl, row._count);
  }

  return tasks.map((task) => {
    const last = task.comments[0];
    const projectName = task.project.name;
    const initial = projectName.charAt(0).toUpperCase();
    const taskUrl = `/projects/${task.projectId}/tasks/${task.id}`;

    return {
      id: `task-${task.id}`,
      kind: "project" as const,
      name: task.title,
      subtitle: projectName,
      projectId: task.projectId,
      taskId: task.id,
      lastMessage: last
        ? last.body.replace(/@\[([^\]]+)\]\([^)]+\)/g, "@$1")
        : "",
      lastAuthor: last
        ? (last.author.name ?? last.author.email)
        : "",
      lastAt: last ? last.createdAt.toISOString() : "",
      unread: unreadMap.get(taskUrl) ?? 0,
      avatar: generateColor(projectName),
      initials: initial,
    };
  });
}

const PALETTE = [
  "#6366f1", "#10b981", "#f59e0b", "#ec4899",
  "#0ea5e9", "#a855f7", "#f97316", "#14b8a6",
];

function generateColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}
