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
): Promise<ActionResult<string>> {
  const res = await sendMessage({ taskId, projectId, body, kind });
  if (!res.ok) return res;
  revalidatePath(`/projects/${projectId}/tasks/${taskId}`);
  return { ok: true, data: res.data.id };
}

export async function getTaskComments(taskId: string) {
  await requireWorkspaceWithMember();

  return db.message.findMany({
    where: { taskId },
    include: {
      author: { select: { id: true, userId: true, name: true, email: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function getTaskHistory(taskId: string) {
  await requireWorkspaceWithMember();

  return db.taskStatusChange.findMany({
    where: { taskId },
    include: {
      member: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
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
