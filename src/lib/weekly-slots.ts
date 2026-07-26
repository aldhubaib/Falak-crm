import { db } from "@/lib/db";
import { claimThrottle } from "@/lib/cache";
import { planningWeekStartOf, weekStartOf } from "@/lib/week";

/** Start of the week after the given week start. */
export function nextWeekStartOf(weekStart: Date): Date {
  const next = new Date(weekStart);
  next.setUTCDate(next.getUTCDate() + 7);
  return next;
}

type SlotTarget = {
  templateId: string;
  perWeek: number;
  startsOn: Date;
  intervalWeeks: number;
  responsibleMemberId: string | null;
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * A plan produces slots on its start week and every `intervalWeeks` after it
 * (1 = weekly, 2 = biweekly…). Weeks before the start, and off-weeks between
 * cycles, produce nothing.
 */
export function planActiveForWeek(
  startsOn: Date,
  weekStart: Date,
  intervalWeeks = 1,
): boolean {
  const start = weekStartOf(startsOn);
  if (start.getTime() > weekStart.getTime()) return false;
  const interval = Math.max(1, Math.round(intervalWeeks));
  if (interval === 1) return true;
  const diffWeeks = Math.round((weekStart.getTime() - start.getTime()) / WEEK_MS);
  return diffWeeks % interval === 0;
}

/** First active week of the plan at or after `fromWeek` (a week start). */
export function nextActiveWeekStart(
  startsOn: Date,
  intervalWeeks: number,
  fromWeek: Date,
): Date {
  const start = weekStartOf(startsOn);
  if (start.getTime() >= fromWeek.getTime()) return start;
  const interval = Math.max(1, Math.round(intervalWeeks));
  const diffWeeks = Math.round((fromWeek.getTime() - start.getTime()) / WEEK_MS);
  const cyclesUp = Math.ceil(diffWeeks / interval);
  const next = new Date(start);
  next.setUTCDate(next.getUTCDate() + cyclesUp * interval * 7);
  return next;
}

// Top one week's Todo slots up to each Weekly Plan target. Counting ALL rows
// (filled + admin-removed) means removals stay removed and target bumps
// mid-week add just the difference. Plans that haven't reached their start
// week yet produce nothing. Idempotent.
export async function materialiseWeekSlots(
  projectId: string,
  weekStart: Date,
  targets?: SlotTarget[],
): Promise<void> {
  const resolvedTargets = (
    targets ??
    (await db.projectWeeklyTarget.findMany({
      where: { projectId, perWeek: { gt: 0 } },
    }))
  ).filter((t) => planActiveForWeek(t.startsOn, weekStart, t.intervalWeeks));
  if (resolvedTargets.length === 0) return;

  const existing = await db.weeklySlot.groupBy({
    by: ["templateId"],
    where: { projectId, weekStart },
    _count: { _all: true },
  });
  const countByTemplate = new Map(
    existing.map((e) => [e.templateId, e._count._all]),
  );
  const data = resolvedTargets.flatMap((t) => {
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
}

// Top the current week's Todo slots up to each Weekly Plan target. Runs lazily
// on board load (after the caller has verified project access), so the first
// visit of a new week materialises that week's slots. When overflow tasks have
// already booked into next week, next week's plan is topped up too so its
// placeholders track target changes.
export async function ensureWeeklySlots(projectId: string): Promise<void> {
  const weekStart = planningWeekStartOf();

  const claimed = await claimThrottle(
    `weekslots:${projectId}:${weekStart.toISOString().slice(0, 10)}`,
    10,
  );
  if (!claimed) return;

  const targets = await db.projectWeeklyTarget.findMany({
    where: { projectId, perWeek: { gt: 0 } },
  });
  if (targets.length === 0) return;

  await materialiseWeekSlots(projectId, weekStart, targets);

  // Next week's slots materialise in two cases: a task has overflowed into it
  // (keep the whole next plan in sync with the targets while it's visible),
  // or a plan's next active week is NEXT week (its start, or the next cycle
  // of an every-N-weeks plan) — those slots must show under "Next week" even
  // though nothing overflowed.
  const nextWeek = nextWeekStartOf(weekStart);
  const startsNextWeek = targets.filter(
    (t) =>
      !planActiveForWeek(t.startsOn, weekStart, t.intervalWeeks) &&
      planActiveForWeek(t.startsOn, nextWeek, t.intervalWeeks),
  );
  const nextWeekRows = await db.weeklySlot.findMany({
    where: { projectId, weekStart: nextWeek },
    select: { templateId: true },
  });
  // Only rows of plans already running count as overflow — a future-start
  // plan's own slots shouldn't drag every other plan onto the board early.
  const activeNow = new Set(
    targets
      .filter((t) => planActiveForWeek(t.startsOn, weekStart, t.intervalWeeks))
      .map((t) => t.templateId),
  );
  const hasOverflowRows = nextWeekRows.some((r) => activeNow.has(r.templateId));
  if (hasOverflowRows) {
    await materialiseWeekSlots(projectId, nextWeek, targets);
  } else if (startsNextWeek.length > 0) {
    await materialiseWeekSlots(projectId, nextWeek, startsNextWeek);
  }

  await backfillSlotAssignees(projectId, weekStart, targets);
  await carryOverTodoTasks(projectId, weekStart);
  await adoptTodoTasksIntoSlots(projectId, weekStart);
}

// Unfinished Todo work rolls into the new week: a task still sitting in Todo
// whose slot belongs to a previous week takes one of the new week's free
// slots (same type, oldest first) instead of the plan minting full fresh
// capacity on top of the carried-over task.
async function carryOverTodoTasks(
  projectId: string,
  weekStart: Date,
): Promise<void> {
  const stale = await db.weeklySlot.findMany({
    where: {
      projectId,
      weekStart: { lt: weekStart },
      removedAt: null,
      task: { deletedAt: null, status: { name: "Todo" } },
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, templateId: true, taskId: true },
  });
  if (stale.length === 0) return;

  const free = await db.weeklySlot.findMany({
    where: { projectId, weekStart, taskId: null, removedAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, templateId: true },
  });
  if (free.length === 0) return;

  const freeByTemplate = new Map<string, string[]>();
  for (const s of free) {
    const ids = freeByTemplate.get(s.templateId) ?? [];
    ids.push(s.id);
    freeByTemplate.set(s.templateId, ids);
  }

  for (const old of stale) {
    const targetId = freeByTemplate.get(old.templateId)?.shift();
    if (!targetId || !old.taskId) continue;
    // taskId is unique across slots — free the old binding before claiming
    // the new one. The `taskId: null` guard leaves concurrently claimed
    // slots alone (the task then just keeps last week's slot).
    await db.$transaction([
      db.weeklySlot.update({
        where: { id: old.id },
        data: { taskId: null },
      }),
      db.weeklySlot.updateMany({
        where: { id: targetId, taskId: null },
        data: { taskId: old.taskId },
      }),
    ]);
  }
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
  const weekStart = planningWeekStartOf();
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
