import { db } from "@/lib/db";
import type { EffortFlag } from "@/lib/effort";

function countWords(text: string | null): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

type MemberRates = {
  id: string;
  titleId: string | null;
  fieldRates: Map<string, number>;
};

/** One query for any number of members' title field rates. */
async function loadMemberRatesMany(
  memberIds: string[],
): Promise<Map<string, MemberRates>> {
  if (memberIds.length === 0) return new Map();
  const rows = await db.workspaceMember.findMany({
    where: { id: { in: memberIds } },
    select: {
      id: true,
      capacityTitle: {
        select: {
          id: true,
          fieldRates: { select: { templateItemId: true, minutesPerUnit: true } },
        },
      },
    },
  });
  return new Map(
    rows.map((m) => [
      m.id,
      {
        id: m.id,
        titleId: m.capacityTitle?.id ?? null,
        fieldRates: new Map(
          (m.capacityTitle?.fieldRates ?? []).map((r) => [
            r.templateItemId,
            r.minutesPerUnit,
          ]),
        ),
      },
    ]),
  );
}

type ItemForMeasure = {
  id: string;
  templateItemId: string | null;
  type: string;
  effortUnit: string | null;
  textValue: string | null;
  attachmentId: string | null;
  completed: boolean;
  completedBy: string | null;
  templateItem: {
    type: string;
    effortUnit: string | null;
  } | null;
};

export type FieldMeasure = {
  basis: "actual" | "pending";
  quantity: number | null;
  rate: number | null;
  minutes: number | null;
  flags: EffortFlag[];
};

/** Pure measurement — all data (durations, rates) is pre-loaded by callers. */
export function measureChecklistField(
  item: ItemForMeasure,
  assigneeId: string | null,
  durationByAttachment: Map<string, number | null>,
  multiDurations: (number | null)[],
  ratesByMember: Map<string, MemberRates>,
): FieldMeasure {
  const unit = item.templateItem?.effortUnit ?? item.effortUnit;
  if (!unit) {
    return { basis: "pending", quantity: null, rate: null, minutes: null, flags: [] };
  }

  const isMulti = (item.templateItem?.type ?? item.type) === "multi_file";
  let basis: "actual" | "pending" = "pending";
  let quantity: number | null = null;
  const flags: EffortFlag[] = [];

  if (unit === "words") {
    const words = countWords(item.textValue);
    if (words > 0) {
      basis = "actual";
      quantity = words;
    }
  } else if (unit === "audio_min" || unit === "video_min") {
    if (isMulti && multiDurations.length > 0) {
      const known = multiDurations.filter((d): d is number => d != null && d > 0);
      if (known.length > 0) {
        basis = "actual";
        quantity = known.reduce((sum, d) => sum + d, 0) / 60;
      }
      if (known.length < multiDurations.length) flags.push("unknown_duration");
    } else if (!isMulti && item.attachmentId) {
      const durationSec = durationByAttachment.get(item.attachmentId);
      if (durationSec != null && durationSec > 0) {
        basis = "actual";
        quantity = durationSec / 60;
      } else {
        flags.push("unknown_duration");
      }
    }
  } else if (isMulti) {
    if (multiDurations.length > 0) {
      basis = "actual";
      quantity = multiDurations.length;
    }
  } else if (item.completed) {
    basis = "actual";
    quantity = 1;
  }

  const doerId = (basis === "actual" ? item.completedBy : null) ?? assigneeId;
  if (!doerId) flags.push("no_member");

  const doer = doerId ? (ratesByMember.get(doerId) ?? null) : null;
  if (doerId && doer && !doer.titleId) flags.push("no_title");

  let rate: number | null = null;
  if (doer?.titleId && item.templateItemId) {
    rate = doer.fieldRates.get(item.templateItemId) ?? null;
    if (rate == null) flags.push("no_rate");
  }

  const minutes = quantity != null && rate != null ? quantity * rate : null;
  return { basis, quantity, rate, minutes, flags };
}

const EFFORT_LOCK_CLEARED = {
  effortQuantity: null,
  effortRate: null,
  effortMinutes: null,
  effortLockedAt: null,
} as const;

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/**
 * Batched lock: snapshot live effort onto every given field that is completed
 * and effort-bearing; clear the lock on the rest. Query count is constant
 * (items + attachments + rates + writes) regardless of how many ids come in.
 */
export async function lockManyChecklistItemEffort(itemIds: string[]): Promise<void> {
  if (itemIds.length === 0) return;

  const items = await db.taskChecklistItem.findMany({
    where: { id: { in: itemIds } },
    select: {
      id: true,
      templateItemId: true,
      type: true,
      effortUnit: true,
      textValue: true,
      attachmentId: true,
      completed: true,
      completedBy: true,
      hidden: true,
      templateItem: { select: { type: true, effortUnit: true, hidden: true } },
      task: { select: { assigneeId: true } },
    },
  });

  const lockable: typeof items = [];
  const clearIds: string[] = [];
  for (const item of items) {
    const hidden = item.templateItem?.hidden ?? item.hidden;
    const unit = item.templateItem?.effortUnit ?? item.effortUnit;
    if (hidden || !unit || !item.completed) clearIds.push(item.id);
    else lockable.push(item);
  }

  const isMultiItem = (i: (typeof items)[number]) =>
    (i.templateItem?.type ?? i.type) === "multi_file";

  const singleAttachmentIds = lockable
    .filter((i) => !isMultiItem(i) && i.attachmentId)
    .map((i) => i.attachmentId!) as string[];
  const multiItemIds = lockable.filter(isMultiItem).map((i) => i.id);

  const [attachments, multiFiles] = await Promise.all([
    singleAttachmentIds.length > 0
      ? db.attachment.findMany({
          where: { id: { in: singleAttachmentIds } },
          select: { id: true, durationSec: true },
        })
      : Promise.resolve([]),
    multiItemIds.length > 0
      ? db.attachment.findMany({
          where: {
            entityType: "checklist_item",
            entityId: { in: multiItemIds },
            status: "uploaded",
          },
          select: { entityId: true, durationSec: true },
        })
      : Promise.resolve([]),
  ]);

  const durationByAttachment = new Map<string, number | null>(
    attachments.map((a) => [a.id, a.durationSec]),
  );
  const multiDurationsByItem = new Map<string, (number | null)[]>();
  for (const f of multiFiles) {
    const list = multiDurationsByItem.get(f.entityId) ?? [];
    list.push(f.durationSec);
    multiDurationsByItem.set(f.entityId, list);
  }

  // Superset of possible doers (field completer or task assignee) — the
  // measure picks the right one per field.
  const doerIds = [
    ...new Set(
      lockable
        .flatMap((i) => [i.completedBy, i.task.assigneeId])
        .filter((id): id is string => !!id),
    ),
  ];
  const ratesByMember = await loadMemberRatesMany(doerIds);

  const lockedAt = new Date();
  const updates = lockable.map((item) => {
    const measure = measureChecklistField(
      item,
      item.task.assigneeId,
      durationByAttachment,
      isMultiItem(item) ? (multiDurationsByItem.get(item.id) ?? []) : [],
      ratesByMember,
    );
    return db.taskChecklistItem.update({
      where: { id: item.id },
      data: {
        effortQuantity: measure.quantity,
        effortRate: measure.rate,
        effortMinutes: measure.minutes,
        effortLockedAt: lockedAt,
      },
    });
  });

  if (clearIds.length > 0) {
    await db.taskChecklistItem.updateMany({
      where: { id: { in: clearIds } },
      data: EFFORT_LOCK_CLEARED,
    });
  }
  for (const batch of chunk(updates, 100)) {
    await db.$transaction(batch);
  }
}

/** Snapshot live effort onto a completed checklist field. */
export async function lockChecklistItemEffort(itemId: string): Promise<void> {
  await lockManyChecklistItemEffort([itemId]);
}

export async function clearChecklistItemEffortLock(itemId: string): Promise<void> {
  await db.taskChecklistItem.updateMany({
    where: { id: itemId },
    data: EFFORT_LOCK_CLEARED,
  });
}

/** Clear effort locks on every checklist field of a task. */
export async function clearTaskEffortLocks(taskId: string): Promise<void> {
  await db.taskChecklistItem.updateMany({
    where: { taskId },
    data: EFFORT_LOCK_CLEARED,
  });
}

/** Snapshot effort for all completed effort-bearing fields on a task. */
export async function lockTaskEffortLocks(taskId: string): Promise<void> {
  const items = await db.taskChecklistItem.findMany({
    where: { taskId, completed: true },
    select: {
      id: true,
      hidden: true,
      effortUnit: true,
      templateItem: { select: { hidden: true, effortUnit: true } },
    },
  });
  const effortItemIds = items
    .filter((i) => {
      if (i.templateItem?.hidden ?? i.hidden) return false;
      return !!(i.templateItem?.effortUnit ?? i.effortUnit);
    })
    .map((i) => i.id);
  await lockManyChecklistItemEffort(effortItemIds);
}

/** Recompute and persist locks for every effort field on a completed task. */
export async function recalculateTaskEffortLocks(taskId: string): Promise<void> {
  const task = await db.task.findUnique({
    where: { id: taskId },
    select: {
      completedAt: true,
      checklistItems: {
        select: {
          id: true,
          hidden: true,
          effortUnit: true,
          templateItem: { select: { hidden: true, effortUnit: true } },
        },
      },
    },
  });
  if (!task) throw new Error("Task not found");
  if (!task.completedAt) throw new Error("Task must be completed before recalculating effort");

  // Completed fields re-lock at current rates; incomplete ones clear — the
  // batch function routes each id to the right side.
  const effortItemIds = task.checklistItems
    .filter((i) => {
      if (i.templateItem?.hidden ?? i.hidden) return false;
      return !!(i.templateItem?.effortUnit ?? i.effortUnit);
    })
    .map((i) => i.id);
  await lockManyChecklistItemEffort(effortItemIds);
}

/**
 * Recompute and save effort for every completed field this title's members
 * did on completed tasks — including old tasks completed before effort
 * tracking existed (they get their first snapshot here). In-progress tasks
 * are never stored.
 */
export async function recalculateTitleEffortLocks(
  titleId: string,
  workspaceId: string,
): Promise<{ fieldCount: number; taskCount: number }> {
  const members = await db.workspaceMember.findMany({
    where: { workspaceId, titleId },
    select: { id: true },
  });
  const memberIds = members.map((m) => m.id);
  if (memberIds.length === 0) return { fieldCount: 0, taskCount: 0 };

  const items = await db.taskChecklistItem.findMany({
    where: {
      completed: true,
      completedBy: { in: memberIds },
      hidden: false,
      task: {
        completedAt: { not: null },
        project: { workspaceId },
      },
      OR: [
        { effortUnit: { not: null } },
        { templateItem: { effortUnit: { not: null }, hidden: false } },
      ],
    },
    select: { id: true, taskId: true, templateItem: { select: { hidden: true } } },
  });

  const effortItems = items.filter((i) => !i.templateItem?.hidden);
  const taskIds = new Set(effortItems.map((i) => i.taskId));

  await lockManyChecklistItemEffort(effortItems.map((i) => i.id));

  return { fieldCount: effortItems.length, taskCount: taskIds.size };
}
