"use server";

import { db } from "@/lib/db";
import { requireWorkspaceWithMember } from "@/lib/workspace";
import { type ActionResult } from "@/lib/action";
import { revalidatePath } from "next/cache";
import { sendMessage } from "@/actions/messages";

// Thin wrapper kept for existing callers (board decline flow, task detail).
// All the real logic — persistence, mention-driven notifications, and Centrifugo
// delivery — lives in the unified sendMessage action.
export async function addTaskComment(
  taskId: string,
  body: string,
  projectId: string,
  kind: "message" | "rejection" | "system" = "message",
  attachmentIds?: string[],
): Promise<ActionResult<string>> {
  const res = await sendMessage({ taskId, projectId, body, kind, attachmentIds });
  if (!res.ok) return res;
  revalidatePath(`/projects/${projectId}/tasks/${taskId}`);
  return { ok: true, data: res.data.id };
}

export async function getTaskComments(taskId: string) {
  const { workspace } = await requireWorkspaceWithMember();

  // Newest 100, rendered oldest → newest. Busy tasks used to load their whole
  // comment history on every task page render.
  const comments = (
    await db.message.findMany({
      where: { taskId },
      include: {
        author: { select: { id: true, userId: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    })
  ).reverse();

  // Attachments live in their own table keyed by entity — join them in so the
  // task page can render files posted with a comment (e.g. decline screenshots).
  const attachmentRows =
    comments.length > 0
      ? await db.attachment.findMany({
          where: {
            workspaceId: workspace.id,
            entityType: "message",
            entityId: { in: comments.map((c) => c.id) },
            status: "uploaded",
          },
          select: { id: true, name: true, contentType: true, sizeBytes: true, entityId: true },
          orderBy: { createdAt: "asc" },
        })
      : [];
  const byMessage = new Map<string, typeof attachmentRows>();
  for (const a of attachmentRows) {
    const list = byMessage.get(a.entityId) ?? [];
    list.push(a);
    byMessage.set(a.entityId, list);
  }

  return comments.map((c) => ({
    ...c,
    attachments: (byMessage.get(c.id) ?? []).map((a) => ({
      id: a.id,
      name: a.name,
      contentType: a.contentType,
      sizeBytes: a.sizeBytes,
      isImage: Boolean(a.contentType?.startsWith("image/")),
    })),
  }));
}

export async function getTaskHistory(taskId: string) {
  await requireWorkspaceWithMember();

  return db.taskStatusChange.findMany({
    where: { taskId },
    include: {
      member: { select: { id: true, name: true, email: true, imageUrl: true } },
    },
    orderBy: { createdAt: "desc" },
    // Newest 100 status changes — enough for the history panel.
    take: 100,
  });
}

export async function getWorkspaceMembers() {
  const { workspace } = await requireWorkspaceWithMember();

  return db.workspaceMember.findMany({
    where: { workspaceId: workspace.id },
    select: { id: true, userId: true, name: true, email: true },
    orderBy: { name: "asc" },
  });
}
