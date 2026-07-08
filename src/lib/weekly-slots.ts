import { db } from "@/lib/db";
import { claimThrottle } from "@/lib/cache";
import { weekStartOf } from "@/lib/week";

// Top the current week's Todo slots up to each Weekly Plan target. Runs lazily
// on board load (after the caller has verified project access), so the first
// visit of a new week materialises that week's slots. Counting ALL rows
// (filled + admin-removed) means removals stay removed and target bumps
// mid-week add just the difference.
export async function ensureWeeklySlots(projectId: string): Promise<void> {
  const weekStart = weekStartOf();

  // Cheap redis guard so concurrent board loads don't double-seed. Redis-less
  // environments fall through — the top-up math keeps duplicates rare and
  // harmless (an extra empty slot an admin can remove).
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
    const missing = t.perWeek - (countByTemplate.get(t.templateId) ?? 0);
    return missing > 0
      ? Array.from({ length: missing }, () => ({
          projectId,
          templateId: t.templateId,
          weekStart,
        }))
      : [];
  });
  if (data.length > 0) {
    await db.weeklySlot.createMany({ data });
  }

  await adoptTodoTasksIntoSlots(projectId, weekStart);
}

// Tasks that are ALREADY sitting in Todo but aren't bound to any slot (they
// were there before the weekly plan existed, or before this week's slots were
// seeded) adopt the week's free slots of their type. Without this the counter
// reads 0/N with dashed placeholders below real cards.
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
      checklistItems: {
        select: { templateItem: { select: { templateId: true } } },
      },
    },
  });
  if (unbound.length === 0) return;

  // Same type resolution the board and the move gate use: the first checklist
  // item that traces back to a template.
  const queue = new Map<string, string[]>();
  for (const t of unbound) {
    const templateId =
      t.checklistItems.find((ci) => ci.templateItem?.templateId)?.templateItem
        ?.templateId ?? null;
    if (!templateId) continue;
    const ids = queue.get(templateId) ?? [];
    ids.push(t.id);
    queue.set(templateId, ids);
  }

  for (const slot of freeSlots) {
    const taskId = queue.get(slot.templateId)?.shift();
    if (!taskId) continue;
    // `taskId: null` guard keeps a concurrent claim from being overwritten.
    await db.weeklySlot.updateMany({
      where: { id: slot.id, taskId: null },
      data: { taskId },
    });
  }
}
