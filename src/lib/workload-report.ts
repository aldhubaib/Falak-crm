import { db } from "@/lib/db";
import { isReviewStageName } from "@/lib/checklist-config";
import { measureChecklistField } from "@/lib/effort-lock";
import type { EffortFlag } from "@/lib/effort";

// ─── Workload report ─────────────────────────────────────────────────────────
//
// "Who worked on what between two dates, grouped by person." One row per
// effort-bearing field completed in the range (plus review passes moved in the
// range), attributed to the person who actually did it (completedBy / mover).
// Locked snapshots are used as-is; unlocked fields are measured live at
// current title rates — same math as the per-task Effort dialog.

export type WorkloadRow = {
  kind: "field" | "review";
  taskId: string;
  taskTitle: string;
  projectName: string;
  typeName: string | null;
  typeIcon: string | null;
  typeColor: string | null;
  /** Field name or review stage name. */
  label: string;
  /** "words" | "audio_min" | "video_min" | "fixed" | "pass" */
  unit: string;
  quantity: number | null;
  rate: number | null;
  minutes: number | null;
  /** When the work happened (field completedAt / move createdAt), ISO. */
  date: string;
  locked: boolean;
  flags: EffortFlag[];
};

export type WorkloadPerson = {
  memberId: string;
  name: string;
  titleName: string | null;
  imageUrl: string | null;
  taskCount: number;
  minutes: number;
  /** Working capacity over the range (weeklyHours prorated), minutes. */
  capacityMinutes: number | null;
  rows: WorkloadRow[];
};

export type WorkloadReport = {
  from: string;
  to: string;
  people: WorkloadPerson[];
  totalMinutes: number;
  hasFlags: boolean;
};

export async function computeWorkloadReport(
  workspaceId: string,
  from: Date,
  to: Date,
): Promise<WorkloadReport> {
  const taskSelect = {
    id: true,
    title: true,
    completedAt: true,
    assigneeId: true,
    project: { select: { name: true } },
    template: { select: { name: true, icon: true, color: true } },
  } as const;

  const [items, passes] = await Promise.all([
    db.taskChecklistItem.findMany({
      where: {
        completed: true,
        completedBy: { not: null },
        completedAt: { gte: from, lte: to },
        hidden: false,
        task: { deletedAt: null, project: { workspaceId } },
        OR: [
          { effortUnit: { not: null } },
          { templateItem: { effortUnit: { not: null }, hidden: false } },
        ],
      },
      select: {
        id: true,
        taskId: true,
        templateItemId: true,
        name: true,
        type: true,
        effortUnit: true,
        textValue: true,
        attachmentId: true,
        completed: true,
        completedBy: true,
        completedAt: true,
        effortQuantity: true,
        effortRate: true,
        effortMinutes: true,
        effortLockedAt: true,
        templateItem: {
          select: { name: true, type: true, effortUnit: true, hidden: true },
        },
        task: { select: taskSelect },
      },
    }),
    db.taskStatusChange.findMany({
      where: {
        action: "status_change",
        memberId: { not: null },
        createdAt: { gte: from, lte: to },
        task: { deletedAt: null, project: { workspaceId } },
      },
      select: {
        memberId: true,
        fromStatusId: true,
        fromStatusName: true,
        createdAt: true,
        task: { select: taskSelect },
      },
    }),
  ]);

  const effortItems = items.filter((i) => {
    if (i.templateItem?.hidden) return false;
    return !!(i.templateItem?.effortUnit ?? i.effortUnit);
  });
  const reviewPasses = passes.filter(
    (p) => p.fromStatusId && isReviewStageName(p.fromStatusName),
  );

  // ── Load everyone involved, with rates and capacity ──
  const memberIds = [
    ...new Set(
      [
        ...effortItems.map((i) => i.completedBy),
        ...reviewPasses.map((p) => p.memberId),
      ].filter((id): id is string => !!id),
    ),
  ];
  const memberRows = memberIds.length
    ? await db.workspaceMember.findMany({
        where: { id: { in: memberIds } },
        select: {
          id: true,
          name: true,
          email: true,
          imageUrl: true,
          weeklyHours: true,
          capacityTitle: {
            select: {
              id: true,
              name: true,
              fieldRates: { select: { templateItemId: true, minutesPerUnit: true } },
              stageRates: { select: { statusId: true, minutesPerPass: true } },
            },
          },
        },
      })
    : [];
  const members = new Map(
    memberRows.map((m) => [
      m.id,
      {
        id: m.id,
        name: m.name ?? m.email,
        imageUrl: m.imageUrl,
        weeklyHours: m.weeklyHours,
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

  // ── Media durations, only needed for live (unlocked) measurement ──
  const liveItems = effortItems.filter(
    (i) => !(i.effortLockedAt && i.task.completedAt),
  );
  const isMultiItem = (i: (typeof effortItems)[number]) =>
    (i.templateItem?.type ?? i.type) === "multi_file";
  const singleAttachmentIds = liveItems
    .filter((i) => !isMultiItem(i) && i.attachmentId)
    .map((i) => i.attachmentId!);
  const multiItemIds = liveItems.filter(isMultiItem).map((i) => i.id);

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

  // ── Build rows ──
  const rowsByMember = new Map<string, WorkloadRow[]>();
  const pushRow = (memberId: string, row: WorkloadRow) => {
    const list = rowsByMember.get(memberId) ?? [];
    list.push(row);
    rowsByMember.set(memberId, list);
  };

  for (const item of effortItems) {
    const memberId = item.completedBy!;
    const unit = item.templateItem?.effortUnit ?? item.effortUnit!;
    const doer = members.get(memberId);

    let quantity: number | null = null;
    let rate: number | null = null;
    let minutes: number | null = null;
    let locked = false;
    let flags: EffortFlag[] = [];

    if (item.effortLockedAt && item.task.completedAt) {
      // Saved snapshot — the numbers the owner locked in.
      locked = true;
      quantity = item.effortQuantity;
      rate = item.effortRate;
      minutes =
        item.effortMinutes ??
        (quantity != null && rate != null ? quantity * rate : null);
      if (doer && !doer.titleId) flags.push("no_title");
      if (rate == null && doer?.titleId) flags.push("no_rate");
      if (
        (unit === "audio_min" || unit === "video_min") &&
        quantity == null &&
        item.attachmentId
      ) {
        flags.push("unknown_duration");
      }
    } else {
      const measure = measureChecklistField(
        item,
        item.task.assigneeId,
        durationByAttachment,
        isMultiItem(item) ? (multiDurationsByItem.get(item.id) ?? []) : [],
        members,
      );
      quantity = measure.quantity;
      rate = measure.rate;
      minutes = measure.minutes;
      flags = measure.flags;
    }

    pushRow(memberId, {
      kind: "field",
      taskId: item.task.id,
      taskTitle: item.task.title,
      projectName: item.task.project.name,
      typeName: item.task.template?.name ?? null,
      typeIcon: item.task.template?.icon ?? null,
      typeColor: item.task.template?.color ?? null,
      label: item.templateItem?.name ?? item.name,
      unit,
      quantity,
      rate,
      minutes,
      date: (item.completedAt ?? new Date()).toISOString(),
      locked,
      flags,
    });
  }

  for (const pass of reviewPasses) {
    const memberId = pass.memberId!;
    const reviewer = members.get(memberId);
    const flags: EffortFlag[] = [];
    if (reviewer && !reviewer.titleId) flags.push("no_title");

    let rate: number | null = null;
    if (reviewer?.titleId && pass.fromStatusId) {
      rate = reviewer.stageRates.get(pass.fromStatusId) ?? null;
      if (rate == null) flags.push("no_rate");
    }

    pushRow(memberId, {
      kind: "review",
      taskId: pass.task.id,
      taskTitle: pass.task.title,
      projectName: pass.task.project.name,
      typeName: pass.task.template?.name ?? null,
      typeIcon: pass.task.template?.icon ?? null,
      typeColor: pass.task.template?.color ?? null,
      label: pass.fromStatusName ?? "Review",
      unit: "pass",
      quantity: 1,
      rate,
      minutes: rate,
      date: pass.createdAt.toISOString(),
      locked: false,
      flags,
    });
  }

  // ── Group into people ──
  const rangeDays = Math.max(
    1,
    (to.getTime() - from.getTime()) / 86_400_000,
  );

  const people: WorkloadPerson[] = [...rowsByMember.entries()].map(
    ([memberId, rows]) => {
      rows.sort((a, b) => a.date.localeCompare(b.date));
      const member = members.get(memberId);
      const minutes = rows.reduce((sum, r) => sum + (r.minutes ?? 0), 0);
      const capacityMinutes =
        member && member.weeklyHours > 0
          ? member.weeklyHours * 60 * (rangeDays / 7)
          : null;
      return {
        memberId,
        name: member?.name ?? "Unknown",
        titleName: member?.titleName ?? null,
        imageUrl: member?.imageUrl ?? null,
        taskCount: new Set(rows.map((r) => r.taskId)).size,
        minutes,
        capacityMinutes,
        rows,
      };
    },
  );
  people.sort((a, b) => b.minutes - a.minutes);

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    people,
    totalMinutes: people.reduce((sum, p) => sum + p.minutes, 0),
    hasFlags: people.some((p) => p.rows.some((r) => r.flags.length > 0)),
  };
}
