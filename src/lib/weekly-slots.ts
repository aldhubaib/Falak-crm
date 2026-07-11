import { db } from "@/lib/db";
import { claimThrottle } from "@/lib/cache";
import { weekStartOf } from "@/lib/week";
import { getProjectTimezone } from "@/lib/project-timezone";

// Top the current week's Todo slots up to each Weekly Plan target. Runs lazily
// on board load (after the caller has verified project access), so the first
// visit of a new week materialises that week's slots. Counting ALL rows
// (filled + admin-removed) means removals stay removed and target bumps
// mid-week add just the difference.
export async function ensureWeeklySlots(projectId: string): Promise<void> {
  const timezone = await getProjectTimezone(projectId);
  const weekStart = weekStartOf(new Date(), timezone);

  const claimed = await claimThrottle(
    `weekslots:${projectId}:${weekStart.toISOString().slice(0, 10)}`,
    10,
  );
  if (!claimed) return;

  const [targets, existing] = await Promise.all([
    db.projectWeeklyTarget.findMany({
      where: { projectId, perWeek: { gt: 0 } },
    }),
    db.weeklySlot.groupBy({
      by: ["templateId"],
      where: { projectId, weekStart },
      _count: { _all: true },
    }),
  ]);
  if (targets.length === 0) return;

  const countByTemplate = new Map(
    existing.map((e) => [e.templateId, e._count._all]),
  );
  const data = targets.flatMap((t) => {
    const existingCount = countByTemplate.get(t.templateId) ?? 0;
    const missing = t.perWeek - existingCount;
    if (missing <= 0) return [];
    return Array.from({ length: missing }, () => ({
      projectId,
      templateId: t.templateId,
      weekStart,
      assigneeId: t.responsibleMemberId,
    }));
  });
  if (data.length > 0) {
    await db.weeklySlot.createMany({ data });
  }

  await backfillSlotAssignees(projectId, weekStart, targets);
  await adoptTodoTasksIntoSlots(projectId, weekStart);
}

async function backfillSlotAssignees(
  projectId: string,
  weekStart: Date,
  targets: { templateId: string; responsibleMemberId: string | null }[],
): Promise<void> {
  const byTemplate = new Map(
    targets
      .filter((t) => t.responsibleMemberId)
      .map((t) => [t.templateId, t.responsibleMemberId!]),
  );
  if (byTemplate.size === 0) return;

  const unassigned = await db.weeklySlot.findMany({
    where: {
      projectId,
      weekStart,
      taskId: null,
      assigneeId: null,
      removedAt: null,
      templateId: { in: [...byTemplate.keys()] },
    },
    select: { id: true, templateId: true },
  });
  if (unassigned.length === 0) return;

  await Promise.all(
    unassigned.map((slot) => {
      const assigneeId = byTemplate.get(slot.templateId);
      if (!assigneeId) return Promise.resolve();
      return db.weeklySlot.update({
        where: { id: slot.id },
        data: { assigneeId },
      });
    }),
  );
}

async function adoptTodoTasksIntoSlots(
  projectId: string,
  weekStart: Date,
): Promise<void> {
  const freeSlots = await db.weeklySlot.findMany({
    where: { projectId, weekStart, taskId: null, removedAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, templateId: true },
  });
  if (freeSlots.length === 0) return;

  const unbound = await db.task.findMany({
    where: {
      projectId,
      deletedAt: null,
      status: { name: "Todo" },
      weeklySlot: null,
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      templateId: true,
      checklistItems: {
        select: { templateItem: { select: { templateId: true } } },
      },
    },
  });
  if (unbound.length === 0) return;

  const queue = new Map<string, string[]>();
  for (const t of unbound) {
    // Stored type first; checklist inference covers legacy tasks created
    // before Task.templateId existed.
    const templateId =
      t.templateId ??
      t.checklistItems.find((ci) => ci.templateItem?.templateId)?.templateItem
        ?.templateId ??
      null;
    if (!templateId) continue;
    const ids = queue.get(templateId) ?? [];
    ids.push(t.id);
    queue.set(templateId, ids);
  }

  for (const slot of freeSlots) {
    const taskId = queue.get(slot.templateId)?.shift();
    if (!taskId) continue;
    await db.weeklySlot.updateMany({
      where: { id: slot.id, taskId: null },
      data: { taskId },
    });
  }
}

/** Resolve assigneeId for a single new slot (force-add or move-created). */
export async function resolveNewSlotAssignee(
  projectId: string,
  templateId: string,
): Promise<string | null> {
  const target = await db.projectWeeklyTarget.findUnique({
    where: { projectId_templateId: { projectId, templateId } },
    select: { responsibleMemberId: true },
  });
  return target?.responsibleMemberId ?? null;
}

/** Push responsible-member changes onto this week's still-empty slots. */
export async function syncSlotAssigneesFromTargets(
  projectId: string,
  targets: { templateId: string; responsibleMemberId: string | null }[],
): Promise<void> {
  const timezone = await getProjectTimezone(projectId);
  const weekStart = weekStartOf(new Date(), timezone);
  await Promise.all(
    targets.map((t) =>
      db.weeklySlot.updateMany({
        where: {
          projectId,
          templateId: t.templateId,
          weekStart,
          taskId: null,
          removedAt: null,
        },
        data: { assigneeId: t.responsibleMemberId },
      }),
    ),
  );
}
