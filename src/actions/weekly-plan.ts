"use server";

import { db } from "@/lib/db";
import { requireProjectSettings, requireProjectWork } from "@/lib/workspace";
import { revalidatePath } from "next/cache";

// ─── Targets (project settings) ───────────────────────────────────────────────

export type WeeklyTarget = { templateId: string; perWeek: number };

export async function getWeeklyTargets(
  projectId: string,
): Promise<WeeklyTarget[]> {
  await requireProjectWork(projectId);
  const rows = await db.projectWeeklyTarget.findMany({
    where: { projectId },
    select: { templateId: true, perWeek: true },
  });
  return rows;
}

// Replace the project's weekly plan. Targets only shape FUTURE weeks — the
// current week's slots were already seeded, except raising a target mid-week
// tops the current week up (see ensureWeeklySlots).
export async function setWeeklyTargets(
  projectId: string,
  targets: WeeklyTarget[],
): Promise<void> {
  await requireProjectSettings(projectId);

  const clean = targets
    .map((t) => ({
      templateId: t.templateId,
      perWeek: Math.max(0, Math.min(50, Math.round(t.perWeek))),
    }))
    .filter((t) => t.templateId);

  await db.$transaction([
    db.projectWeeklyTarget.deleteMany({ where: { projectId } }),
    ...(clean.length
      ? [
          db.projectWeeklyTarget.createMany({
            data: clean.map((t) => ({ projectId, ...t })),
          }),
        ]
      : []),
  ]);

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/settings`);
}

// ─── Slot removal (admin) ─────────────────────────────────────────────────────

export async function removeWeeklySlot(
  slotId: string,
  projectId: string,
): Promise<void> {
  const access = await requireProjectWork(projectId);
  if (access.permissions.projects !== "full") {
    throw new Error("Only an admin can remove a slot");
  }

  // Soft-remove and only when still empty — a claimed slot belongs to a task.
  const res = await db.weeklySlot.updateMany({
    where: { id: slotId, projectId, taskId: null, removedAt: null },
    data: { removedAt: new Date() },
  });
  if (res.count === 0) throw new Error("Slot not found or already filled");

  revalidatePath(`/projects/${projectId}`);
}
