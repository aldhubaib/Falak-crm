"use server";

import { db } from "@/lib/db";
import { requireWorkspaceWithMember } from "@/lib/workspace";
import { safeAction, type ActionResult } from "@/lib/action";
import { revalidatePath } from "next/cache";
import { sendNotification } from "@/lib/push";

const MENTION_RE = /@\[([^\]]+)\]\(([^)]+)\)/g;

function parseMentions(body: string): string[] {
  const ids = new Set<string>();
  let match;
  while ((match = MENTION_RE.exec(body)) !== null) {
    ids.add(match[2]);
  }
  return [...ids];
}

export async function addTaskComment(
  taskId: string,
  body: string,
  projectId: string
): Promise<ActionResult<string>> {
  return safeAction("Add Comment", async () => {
    const { member } = await requireWorkspaceWithMember();

    const task = await db.task.findFirst({
      where: { id: taskId },
      select: { id: true, title: true, projectId: true },
    });
    if (!task) throw new Error("Task not found");

    const mentionedIds = parseMentions(body);

    const comment = await db.taskComment.create({
      data: {
        taskId,
        authorId: member.id,
        body,
        mentions: mentionedIds.length > 0
          ? { create: mentionedIds.map((mid) => ({ memberId: mid })) }
          : undefined,
      },
    });

    const authorMember = await db.workspaceMember.findUnique({
      where: { id: member.id },
      select: { name: true, email: true },
    });
    const authorName = authorMember?.name || authorMember?.email || "Someone";
    const plainBody = body.replace(MENTION_RE, "@$1");
    const preview = plainBody.length > 80 ? plainBody.slice(0, 80) + "…" : plainBody;
    const taskUrl = `/projects/${task.projectId}/tasks/${taskId}`;

    const notifyIds = new Set<string>();

    for (const mid of mentionedIds) {
      if (mid !== member.id) {
        notifyIds.add(mid);
        sendNotification({
          recipientId: mid,
          type: "mention",
          title: `${authorName} mentioned you in "${task.title}"`,
          body: preview,
          url: taskUrl,
          tag: `mention-${comment.id}`,
        }).catch(() => {});
      }
    }

    const taskFull = await db.task.findUnique({ where: { id: taskId }, select: { assigneeId: true } });
    if (taskFull?.assigneeId && taskFull.assigneeId !== member.id && !notifyIds.has(taskFull.assigneeId)) {
      sendNotification({
        recipientId: taskFull.assigneeId,
        type: "comment",
        title: `${authorName} commented on "${task.title}"`,
        body: preview,
        url: taskUrl,
        tag: `comment-${comment.id}`,
      }).catch(() => {});
    }

    revalidatePath(`/projects/${projectId}/tasks/${taskId}`);
    return comment.id;
  });
}

export async function getTaskComments(taskId: string) {
  const { member } = await requireWorkspaceWithMember();

  return db.taskComment.findMany({
    where: { taskId },
    include: {
      author: { select: { id: true, userId: true, name: true, email: true } },
    },
    orderBy: { createdAt: "asc" },
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
