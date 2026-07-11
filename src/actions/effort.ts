"use server";

import { requireWorkspaceWithMember } from "@/lib/workspace";
import { db } from "@/lib/db";
import { computeTaskEffort, type TaskEffort } from "@/lib/effort";
import { recalculateTaskEffortLocks } from "@/lib/effort-lock";

// Full effort breakdown for a task — the audit ledger behind every number.
// Owner-only: this is the workspace owner's calibration/verification view.
export async function getTaskEffort(taskId: string): Promise<TaskEffort> {
  const { workspace, member } = await requireWorkspaceWithMember();
  if (member.type !== "OWNER") throw new Error("Permission denied");

  const task = await db.task.findFirst({
    where: { id: taskId, project: { workspaceId: workspace.id } },
    select: { id: true },
  });
  if (!task) throw new Error("Task not found");

  const effort = await computeTaskEffort(taskId);
  if (!effort) throw new Error("Task not found");
  return effort;
}

// Adjust the planned video length after creation (owner-only, from the Effort
// dialog). Predictions recalculate on the next read.
export async function setTaskPlannedMinutes(
  taskId: string,
  plannedMinutes: number | null,
): Promise<TaskEffort> {
  const { workspace, member } = await requireWorkspaceWithMember();
  if (member.type !== "OWNER") throw new Error("Permission denied");
  if (plannedMinutes != null && !(plannedMinutes > 0 && plannedMinutes <= 600)) {
    throw new Error("Planned length must be between 0 and 600 minutes");
  }

  const task = await db.task.findFirst({
    where: { id: taskId, project: { workspaceId: workspace.id } },
    select: { id: true },
  });
  if (!task) throw new Error("Task not found");

  await db.task.update({
    where: { id: taskId },
    data: { plannedMinutes },
  });

  const effort = await computeTaskEffort(taskId);
  if (!effort) throw new Error("Task not found");
  return effort;
}

// Recompute effort locks from current content and title rates, then persist.
// Only allowed on completed tasks — this is the owner's explicit rate refresh.
export async function recalculateTaskEffort(taskId: string): Promise<TaskEffort> {
  const { workspace, member } = await requireWorkspaceWithMember();
  if (member.type !== "OWNER") throw new Error("Permission denied");

  const task = await db.task.findFirst({
    where: { id: taskId, project: { workspaceId: workspace.id } },
    select: { id: true, completedAt: true },
  });
  if (!task) throw new Error("Task not found");
  if (!task.completedAt) {
    throw new Error("Complete the task before recalculating effort");
  }

  await recalculateTaskEffortLocks(taskId);

  const effort = await computeTaskEffort(taskId);
  if (!effort) throw new Error("Task not found");
  return effort;
}
