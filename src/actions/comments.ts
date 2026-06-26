"use server";

import { db } from "@/lib/db";
import { requireWorkspaceWithMember } from "@/lib/workspace";
import { safeAction, type ActionResult } from "@/lib/action";
import { revalidatePath } from "next/cache";

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
): Promise<ActionResult> {
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

    if (mentionedIds.length > 0) {
      const authorName = member.name || member.email;
      const plainBody = body.replace(MENTION_RE, "@$1");
      const preview = plainBody.length > 80 ? plainBody.slice(0, 80) + "…" : plainBody;

      await db.notification.createMany({
        data: mentionedIds
          .filter((mid) => mid !== member.id)
          .map((mid) => ({
            recipientId: mid,
            type: "mention",
            title: `${authorName} mentioned you in "${task.title}"`,
            body: preview,
            linkUrl: `/projects/${task.projectId}/tasks/${taskId}`,
          })),
      });
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
