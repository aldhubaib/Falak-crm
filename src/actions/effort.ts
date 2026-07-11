"use server";

import { requireWorkspaceWithMember } from "@/lib/workspace";
import { db } from "@/lib/db";
import { computeTaskEffort, type TaskEffort } from "@/lib/effort";
import { computeWorkloadReport, type WorkloadReport } from "@/lib/workload-report";

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

// Everyone's effort between two dates, grouped by person. Owner-only, same as
// every other effort surface. Dates arrive as "YYYY-MM-DD" and span whole days.
export async function getWorkloadReport(
  fromDate: string,
  toDate: string,
): Promise<WorkloadReport> {
  const { workspace, member } = await requireWorkspaceWithMember();
  if (member.type !== "OWNER") throw new Error("Permission denied");

  const from = new Date(`${fromDate}T00:00:00.000`);
  const to = new Date(`${toDate}T23:59:59.999`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new Error("Invalid date range");
  }
  if (to < from) throw new Error("The end date is before the start date");
  if (to.getTime() - from.getTime() > 366 * 86_400_000) {
    throw new Error("Pick a range of one year or less");
  }

  return computeWorkloadReport(workspace.id, from, to);
}
