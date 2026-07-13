"use server";

import { db } from "@/lib/db";
import {
  REPEAT_EVERY_VALUES,
  type RepeatEvery,
  type WeeklyTarget,
} from "@/lib/weekly-plan";
import { requireProjectSettings, requireProjectWork } from "@/lib/workspace";
import { weekStartOf } from "@/lib/week";
import {
  resolveNewSlotAssignee,
  syncSlotAssigneesFromTargets,
} from "@/lib/weekly-slots";
import { getProjectTimezone } from "@/lib/project-timezone";
import { getTodoAutoAssignMemberIds } from "@/lib/weekly-assign";
import { predictEffortMinutesFromItems } from "@/lib/effort";
import { publishTaskEvent } from "@/lib/realtime";
import { revalidatePath } from "next/cache";

export type PlanningEligibleMember = {
  id: string;
  name: string;
  email: string;
  imageUrl: string | null;
};

// ─── Targets (project settings) ───────────────────────────────────────────────

export async function getPlanningEligibleMembers(
  projectId: string,
): Promise<PlanningEligibleMember[]> {
  const { workspace } = await requireProjectWork(projectId);
  const memberIds = await getTodoAutoAssignMemberIds(
    projectId,
    workspace.id,
  );
  if (memberIds.length === 0) return [];

  const members = await db.workspaceMember.findMany({
    where: { id: { in: memberIds } },
    select: { id: true, name: true, email: true, imageUrl: true },
    orderBy: [{ name: "asc" }, { email: "asc" }],
  });

  return members.map((m) => ({
    id: m.id,
    name: m.name || m.email,
    email: m.email,
    imageUrl: m.imageUrl,
  }));
}

// Predicted per-task effort (2-min baseline) for every template × eligible
// member, plus each member's weekly-hours capacity. The planning UI multiplies
// by the per-week count to show "≈ Xh of member's Yh/wk" next to targets.
// null = not computable (no title, uncalibrated rates, or no effort fields).
export type WeeklyEffortMatrix = {
  perTaskMinutes: Record<string, Record<string, number | null>>;
  memberWeeklyHours: Record<string, number>;
};

export async function getWeeklyEffortMatrix(
  projectId: string,
): Promise<WeeklyEffortMatrix> {
  const { workspace } = await requireProjectWork(projectId);
  const memberIds = await getTodoAutoAssignMemberIds(projectId, workspace.id);

  // Three queries total (templates+items, members+rates), computed in memory —
  // never one query per template × member.
  const [templates, members] = await Promise.all([
    db.checklistTemplate.findMany({
      where: { workspaceId: workspace.id },
      select: {
        id: true,
        items: {
          where: { hidden: false, effortUnit: { not: null } },
          select: { id: true, effortUnit: true },
        },
      },
    }),
    memberIds.length > 0
      ? db.workspaceMember.findMany({
          where: { id: { in: memberIds } },
          select: {
            id: true,
            weeklyHours: true,
            capacityTitle: {
              select: {
                fieldRates: {
                  select: { templateItemId: true, minutesPerUnit: true },
                },
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  const ratesByMember = new Map(
    members.map((m) => [
      m.id,
      m.capacityTitle
        ? new Map(
            m.capacityTitle.fieldRates.map((r) => [
              r.templateItemId,
              r.minutesPerUnit,
            ]),
          )
        : null,
    ]),
  );

  const perTaskMinutes: Record<string, Record<string, number | null>> = {};
  for (const t of templates) {
    const row: Record<string, number | null> = {};
    for (const m of members) {
      row[m.id] = predictEffortMinutesFromItems(
        t.items,
        ratesByMember.get(m.id) ?? null,
      );
    }
    perTaskMinutes[t.id] = row;
  }

  return {
    perTaskMinutes,
    memberWeeklyHours: Object.fromEntries(
      members.map((m) => [m.id, m.weeklyHours]),
    ),
  };
}

export async function getWeeklyTargets(
  projectId: string,
): Promise<WeeklyTarget[]> {
  await requireProjectWork(projectId);
  const rows = await db.projectWeeklyTarget.findMany({
    where: { projectId },
    select: {
      templateId: true,
      perWeek: true,
      repeatEvery: true,
      startOn: true,
      endsOn: true,
      neverExpires: true,
      responsibleMemberId: true,
    },
  });
  return rows.map((r) => ({
    templateId: r.templateId,
    perWeek: r.perWeek,
    repeatEvery: (REPEAT_EVERY_VALUES.includes(r.repeatEvery as RepeatEvery)
      ? r.repeatEvery
      : "week") as RepeatEvery,
    startOn: r.startOn,
    endsOn: r.endsOn,
    neverExpires: r.neverExpires,
    responsibleMemberId: r.responsibleMemberId,
  }));
}

export async function setWeeklyTargets(
  projectId: string,
  targets: WeeklyTarget[],
): Promise<void> {
  const { workspace } = await requireProjectSettings(projectId);
  const eligible = new Set(
    await getTodoAutoAssignMemberIds(projectId, workspace.id),
  );

  const clean = targets
    .map((t) => ({
      templateId: t.templateId,
      perWeek: Math.max(0, Math.min(50, Math.round(t.perWeek))),
      repeatEvery: REPEAT_EVERY_VALUES.includes(t.repeatEvery)
        ? t.repeatEvery
        : "week",
      startOn: t.startOn,
      endsOn: t.neverExpires ? null : t.endsOn,
      neverExpires: t.neverExpires,
      responsibleMemberId: t.responsibleMemberId || null,
    }))
    .filter((t) => t.templateId);

  for (const t of clean) {
    if (t.perWeek > 0 && !t.responsibleMemberId) {
      throw new Error("Select a responsible team member for each active plan");
    }
    if (
      t.responsibleMemberId &&
      !eligible.has(t.responsibleMemberId)
    ) {
      throw new Error(
        "Selected member must be on the project team with Todo Auto-Assign",
      );
    }
  }

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

  await syncSlotAssigneesFromTargets(projectId, clean);

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/settings`);
  revalidatePath("/dashboard");
}

/** Owner/admin: add one extra Todo slot for the current week without changing the saved target. */
export async function forceAddWeeklySlot(
  projectId: string,
  templateId: string,
  dueDate: Date,
): Promise<void> {
  const access = await requireProjectSettings(projectId);
  if (access.permissions.projects !== "full") {
    throw new Error("Only an owner can force-add a slot");
  }

  // The client sends end-of-day (23:59) in the project timezone, so picking
  // today is fine while any earlier day is already behind "now".
  const due = new Date(dueDate);
  if (isNaN(due.getTime())) throw new Error("Pick a due date for the slot");
  if (due.getTime() < Date.now()) {
    throw new Error("The due date can't be in the past");
  }

  const weekStart = weekStartOf(new Date(), await getProjectTimezone(projectId));
  const assigneeId = await resolveNewSlotAssignee(projectId, templateId);
  await db.weeklySlot.create({
    data: { projectId, templateId, weekStart, assigneeId, dueDate: due },
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/settings`);
  revalidatePath("/dashboard");
}

export async function removeWeeklySlot(
  slotId: string,
  projectId: string,
): Promise<void> {
  const access = await requireProjectWork(projectId);
  if (access.permissions.projects !== "full") {
    throw new Error("Only an admin can remove a slot");
  }

  const res = await db.weeklySlot.updateMany({
    where: { id: slotId, projectId, taskId: null, removedAt: null },
    data: { removedAt: new Date() },
  });
  if (res.count === 0) throw new Error("Slot not found or already filled");

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/dashboard");
}

/** Claim responsibility for an empty weekly plan slot (avatar self-assign). */
export async function assignWeeklySlotToMe(
  slotId: string,
  projectId: string,
): Promise<void> {
  const access = await requireProjectWork(projectId);
  const { member, workspace } = access;

  const todoStatus = await db.taskStatus.findFirst({
    where: { workspaceId: workspace.id, name: "Todo" },
    select: { id: true },
  });

  const canModify =
    access.permissions.projects === "full" ||
    (todoStatus
      ? access.permissions.taskPermissions?.stages?.[todoStatus.id]?.modify ===
        true
      : false);
  if (!canModify) {
    throw new Error("You don't have permission to assign plan slots at Todo");
  }

  const slot = await db.weeklySlot.findFirst({
    where: { id: slotId, projectId, taskId: null, removedAt: null },
    select: { id: true, templateId: true },
  });
  if (!slot) throw new Error("Slot not found or already filled");

  const [, me] = await Promise.all([
    db.weeklySlot.update({
      where: { id: slotId },
      data: { assigneeId: member.id },
    }),
    db.workspaceMember.findUnique({
      where: { id: member.id },
      select: { id: true, name: true, email: true, imageUrl: true },
    }),
  ]);

  publishTaskEvent(projectId, {
    type: "slot.updated",
    slot: {
      slotId: slot.id,
      templateId: slot.templateId,
      assigneeId: me?.id ?? member.id,
      assigneeName: me ? (me.name ?? me.email) : null,
      assigneeAvatar: me?.imageUrl ?? null,
    },
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/dashboard");
}
