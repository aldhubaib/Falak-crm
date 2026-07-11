import { db } from "@/lib/db";
import { isReviewStageName } from "@/lib/checklist-config";

// ─── Effort calculation ─────────────────────────────────────────────────────
//
// Effort is derived from the LATEST content of a task, never from time on the
// board: words in text fields, media length of uploads, a flat 1 for fixed
// items, plus flat minutes per pass through review stages. Each piece is
// attributed to whoever produced it (field completedBy, review-pass mover) and
// costed at that person's Title rates. Completed fields lock their snapshot at
// completion; rates only change when the owner recalculates a completed task.

export const DEFAULT_PLANNED_MINUTES = 2; // the 2-minute-video baseline

export type EffortFlag = "no_rate" | "no_title" | "unknown_duration" | "no_member";

export type EffortRow = {
  kind: "field" | "stage";
  label: string;
  /** Field unit ("words" | "audio_min" | "video_min" | "fixed") or "pass". */
  unit: string;
  /** "actual" = measured from real content; "pending" = not uploaded yet. */
  basis: "actual" | "pending";
  quantity: number | null;
  /** Minutes per unit from the doer's title (null = not calibrated). */
  rate: number | null;
  /** quantity × rate, null when it can't be computed. */
  minutes: number | null;
  memberId: string | null;
  memberName: string | null;
  titleName: string | null;
  /** True when this row reads from a DB lock (field completion snapshot). */
  locked: boolean;
  flags: EffortFlag[];
};

export type MemberSubtotal = {
  memberId: string;
  name: string;
  titleName: string | null;
  imageUrl: string | null;
  minutes: number;
};

export type EffortPerson = {
  memberId: string;
  name: string;
  titleName: string | null;
  imageUrl: string | null;
  minutes: number | null;
  rows: EffortRow[];
};

export type TaskEffort = {
  taskId: string;
  taskTitle: string;
  taskCompleted: boolean;
  rows: EffortRow[];
  people: EffortPerson[];
  subtotals: MemberSubtotal[];
  totalMinutes: number;
  actualMinutes: number;
  pendingFieldCount: number;
  /** True when any row is flagged — the total is incomplete. */
  hasFlags: boolean;
};

function countWords(text: string | null): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

type MemberInfo = {
  id: string;
  name: string | null;
  imageUrl: string | null;
  titleId: string | null;
  titleName: string | null;
  fieldRates: Map<string, number>; // templateItemId → minutes/unit
  stageRates: Map<string, number>; // statusId → minutes/pass
};

async function loadMembers(memberIds: string[]): Promise<Map<string, MemberInfo>> {
  if (memberIds.length === 0) return new Map();
  const rows = await db.workspaceMember.findMany({
    where: { id: { in: memberIds } },
    select: {
      id: true,
      name: true,
      email: true,
      imageUrl: true,
      capacityTitle: {
        select: {
          id: true,
          name: true,
          fieldRates: { select: { templateItemId: true, minutesPerUnit: true } },
          stageRates: { select: { statusId: true, minutesPerPass: true } },
        },
      },
    },
  });
  return new Map(
    rows.map((m) => [
      m.id,
      {
        id: m.id,
        name: m.name ?? m.email,
        imageUrl: m.imageUrl,
        titleId: m.capacityTitle?.id ?? null,
        titleName: m.capacityTitle?.name ?? null,
        fieldRates: new Map(
          (m.capacityTitle?.fieldRates ?? []).map((r) => [
            r.templateItemId,
            r.minutesPerUnit,
          ]),
        ),
        stageRates: new Map(
          (m.capacityTitle?.stageRates ?? []).map((r) => [
            r.statusId,
            r.minutesPerPass,
          ]),
        ),
      },
    ]),
  );
}

export async function computeTaskEffort(taskId: string): Promise<TaskEffort | null> {
  const task = await db.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      title: true,
      assigneeId: true,
      completedAt: true,
      checklistItems: {
        orderBy: [{ phase: "asc" }, { order: "asc" }],
        select: {
          id: true,
          templateItemId: true,
          name: true,
          type: true,
          effortUnit: true,
          hidden: true,
          textValue: true,
          attachmentId: true,
          completed: true,
          completedBy: true,
          effortQuantity: true,
          effortRate: true,
          effortMinutes: true,
          effortLockedAt: true,
          templateItem: {
            select: {
              name: true,
              type: true,
              effortUnit: true,
              hidden: true,
            },
          },
        },
      },
      statusChanges: {
        where: { action: "status_change" },
        orderBy: { createdAt: "asc" },
        select: {
          memberId: true,
          fromStatusId: true,
          fromStatusName: true,
        },
      },
    },
  });
  if (!task) return null;

  const effortItems = task.checklistItems.filter((item) => {
    if (item.templateItem?.hidden ?? item.hidden) return false;
    return !!(item.templateItem?.effortUnit ?? item.effortUnit);
  });

  const multiItemIds = effortItems
    .filter((i) => (i.templateItem?.type ?? i.type) === "multi_file")
    .map((i) => i.id);
  const attachmentIds = effortItems
    .map((i) => i.attachmentId)
    .filter((id): id is string => !!id);

  const [attachments, multiFileRows] = await Promise.all([
    attachmentIds.length > 0
      ? db.attachment.findMany({
          where: { id: { in: attachmentIds } },
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

  const durationByAttachment = new Map(
    attachments.map((a) => [a.id, a.durationSec]),
  );

  const multiFilesByItem = new Map<string, (number | null)[]>();
  for (const row of multiFileRows) {
    const list = multiFilesByItem.get(row.entityId) ?? [];
    list.push(row.durationSec);
    multiFilesByItem.set(row.entityId, list);
  }

  // Review passes: every move OUT of a review stage is one pass, charged to
  // whoever performed the move (approve or decline alike — the review
  // happened either way).
  const reviewPasses = task.statusChanges.filter(
    (c) => c.fromStatusId && isReviewStageName(c.fromStatusName),
  );

  // Everyone involved: field doers, the assignee, reviewers.
  const memberIds = [
    ...new Set(
      [
        ...effortItems.map((i) => i.completedBy),
        task.assigneeId,
        ...reviewPasses.map((c) => c.memberId),
      ].filter((id): id is string => !!id),
    ),
  ];
  const members = await loadMembers(memberIds);

  const rows: EffortRow[] = [];

  for (const item of effortItems) {
    const unit = item.templateItem?.effortUnit ?? item.effortUnit;
    if (!unit) continue;
    const label = item.templateItem?.name ?? item.name;
    const isMulti = (item.templateItem?.type ?? item.type) === "multi_file";
    const multiDurations = isMulti ? (multiFilesByItem.get(item.id) ?? []) : [];

    const doerId =
      (item.effortLockedAt ? item.completedBy : null) ?? task.assigneeId;
    const doer = doerId ? members.get(doerId) : undefined;

    let basis: "actual" | "pending" = "pending";
    let quantity: number | null = null;
    let rate: number | null = null;
    let minutes: number | null = null;
    let locked = false;
    const flags: EffortFlag[] = [];

    if (item.effortLockedAt && task.completedAt) {
      locked = true;
      quantity = item.effortQuantity;
      rate = item.effortRate;
      minutes = item.effortMinutes;
      if (minutes == null && quantity != null && rate != null) {
        minutes = quantity * rate;
      }
      basis = quantity != null ? "actual" : "pending";
      const attrId = item.completedBy ?? task.assigneeId;
      if (!attrId) flags.push("no_member");
      else if (doer && !doer.titleId) flags.push("no_title");
      if (rate == null && doer?.titleId) flags.push("no_rate");
      if (
        (unit === "audio_min" || unit === "video_min") &&
        quantity == null &&
        item.attachmentId
      ) {
        flags.push("unknown_duration");
      }
    } else {
      if (unit === "words") {
        const words = countWords(item.textValue);
        if (words > 0) {
          basis = "actual";
          quantity = words;
        }
      } else if (unit === "audio_min" || unit === "video_min") {
        if (isMulti && multiDurations.length > 0) {
          basis = "actual";
          const known = multiDurations.filter(
            (d): d is number => d != null && d > 0,
          );
          if (known.length < multiDurations.length) flags.push("unknown_duration");
          quantity =
            known.length > 0
              ? known.reduce((sum, d) => sum + d, 0) / 60
              : null;
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

      const liveDoerId = (basis === "actual" ? item.completedBy : null) ?? task.assigneeId;
      const liveDoer = liveDoerId ? members.get(liveDoerId) : undefined;
      if (!liveDoerId) flags.push("no_member");
      else if (liveDoer && !liveDoer.titleId) flags.push("no_title");

      if (liveDoer?.titleId) {
        rate = item.templateItemId != null
          ? (liveDoer.fieldRates.get(item.templateItemId) ?? null)
          : null;
        if (rate == null) flags.push("no_rate");
      }
      minutes = quantity != null && rate != null ? quantity * rate : null;
    }

    const rowDoerId =
      item.effortLockedAt
        ? (item.completedBy ?? task.assigneeId)
        : ((basis === "actual" ? item.completedBy : null) ?? task.assigneeId);
    const rowDoer = rowDoerId ? members.get(rowDoerId) : undefined;

    rows.push({
      kind: "field",
      label,
      unit,
      basis,
      quantity,
      rate,
      minutes,
      memberId: rowDoerId ?? null,
      memberName: rowDoer?.name ?? null,
      titleName: rowDoer?.titleName ?? null,
      locked,
      flags,
    });
  }

  for (const pass of reviewPasses) {
    const reviewer = pass.memberId ? members.get(pass.memberId) : undefined;
    const flags: EffortFlag[] = [];
    if (!pass.memberId) flags.push("no_member");
    else if (reviewer && !reviewer.titleId) flags.push("no_title");

    let rate: number | null = null;
    if (reviewer?.titleId && pass.fromStatusId) {
      rate = reviewer.stageRates.get(pass.fromStatusId) ?? null;
      if (rate == null) flags.push("no_rate");
    }

    rows.push({
      kind: "stage",
      label: pass.fromStatusName ?? "Review",
      unit: "pass",
      basis: "actual",
      quantity: 1,
      rate,
      minutes: rate,
      memberId: pass.memberId,
      memberName: reviewer?.name ?? null,
      titleName: reviewer?.titleName ?? null,
      locked: false,
      flags,
    });
  }

  const subtotalMap = new Map<string, MemberSubtotal>();
  let total = 0;
  let actual = 0;
  let pendingFieldCount = 0;
  for (const row of rows) {
    if (row.basis === "pending") pendingFieldCount++;
    if (row.minutes == null) continue;
    total += row.minutes;
    if (row.basis === "actual") actual += row.minutes;
    if (row.memberId) {
      const existing = subtotalMap.get(row.memberId);
      if (existing) existing.minutes += row.minutes;
      else {
        subtotalMap.set(row.memberId, {
          memberId: row.memberId,
          name: row.memberName ?? "Unknown",
          titleName: row.titleName,
          imageUrl: members.get(row.memberId)?.imageUrl ?? null,
          minutes: row.minutes,
        });
      }
    }
  }

  const fieldRows = rows.filter((r) => r.kind === "field");
  const peopleMap = new Map<string, EffortPerson>();

  for (const row of fieldRows) {
    const key = row.memberId ?? "__unassigned__";
    const existing = peopleMap.get(key);
    if (existing) {
      existing.rows.push(row);
      if (row.minutes != null) {
        existing.minutes = (existing.minutes ?? 0) + row.minutes;
      }
    } else {
      const member = row.memberId ? members.get(row.memberId) : undefined;
      peopleMap.set(key, {
        memberId: row.memberId ?? key,
        name: row.memberName ?? "Unassigned",
        titleName: row.titleName,
        imageUrl: member?.imageUrl ?? null,
        minutes: row.minutes,
        rows: [row],
      });
    }
  }

  const people = [...peopleMap.values()].sort((a, b) => {
    const am = a.minutes ?? -1;
    const bm = b.minutes ?? -1;
    return bm - am;
  });

  return {
    taskId: task.id,
    taskTitle: task.title,
    taskCompleted: task.completedAt != null,
    rows,
    people,
    subtotals: [...subtotalMap.values()].sort((a, b) => b.minutes - a.minutes),
    totalMinutes: total,
    actualMinutes: actual,
    pendingFieldCount,
    hasFlags: rows.some((r) => r.flags.length > 0),
  };
}

// ─── Weekly prediction ───────────────────────────────────────────────────────

export type PredictableTemplateItem = {
  id: string;
  effortUnit: string | null;
  qtyPerVideoMinute: number | null;
};

// Pure prediction from pre-loaded template items and one member's rates.
// Returns null when any effort field is uncalibrated (a partial number would
// look authoritative) or unpredictable (words without a per-minute ratio).
export function predictEffortMinutesFromItems(
  items: PredictableTemplateItem[],
  rates: Map<string, number> | null,
  plannedMinutes: number = DEFAULT_PLANNED_MINUTES,
): number | null {
  if (items.length === 0 || !rates) return null;
  let total = 0;
  for (const item of items) {
    const rate = rates.get(item.id);
    if (rate == null) return null;
    let quantity: number | null;
    if (item.effortUnit === "fixed") {
      quantity = 1;
    } else if (item.qtyPerVideoMinute != null) {
      quantity = item.qtyPerVideoMinute * plannedMinutes;
    } else if (item.effortUnit === "words") {
      // Words can't be predicted without an expected words-per-minute ratio.
      quantity = null;
    } else {
      quantity = plannedMinutes; // audio/video default to 1:1 with video length
    }
    if (quantity == null) return null;
    total += quantity * rate;
  }
  return total;
}

