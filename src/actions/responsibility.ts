"use server";

import { db } from "@/lib/db";
import { requireWorkspaceWithMember } from "@/lib/workspace";
import { weekStartOf } from "@/lib/week";
import { ensureWeeklySlots } from "@/lib/weekly-slots";

export type ResponsibilitySlot = {
  slotId: string;
  projectId: string;
  projectName: string;
  templateId: string;
  templateName: string;
  templateColor: string | null;
  templateIcon: string | null;
  slotIndex: number;
};

export type MyResponsibilityData = {
  count: number;
  slots: ResponsibilitySlot[];
};

/** Empty weekly plan slots assigned to the current member this week. */
export async function getMyResponsibility(): Promise<MyResponsibilityData> {
  const { member } = await requireWorkspaceWithMember();
  const weekStart = weekStartOf();

  const memberships = await db.projectMember.findMany({
    where: { memberId: member.id },
    select: { projectId: true },
  });
  const projectIds = memberships.map((m) => m.projectId);
  if (projectIds.length === 0) {
    return { count: 0, slots: [] };
  }

  await Promise.all(projectIds.map((id) => ensureWeeklySlots(id)));

  const rows = await db.weeklySlot.findMany({
    where: {
      projectId: { in: projectIds },
      weekStart,
      taskId: null,
      removedAt: null,
      assigneeId: member.id,
    },
    orderBy: [{ projectId: "asc" }, { templateId: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      projectId: true,
      templateId: true,
      project: { select: { name: true } },
      template: { select: { name: true, color: true, icon: true } },
    },
  });

  const filledCounts = await db.weeklySlot.groupBy({
    by: ["projectId", "templateId"],
    where: {
      projectId: { in: projectIds },
      weekStart,
      taskId: { not: null },
      removedAt: null,
    },
    _count: { _all: true },
  });
  const filledMap = new Map(
    filledCounts.map((c) => [`${c.projectId}:${c.templateId}`, c._count._all]),
  );

  const emptyOrdinal = new Map<string, number>();
  const slots: ResponsibilitySlot[] = rows.map((r) => {
    const key = `${r.projectId}:${r.templateId}`;
    const i = (emptyOrdinal.get(key) ?? 0) + 1;
    emptyOrdinal.set(key, i);
    const filled = filledMap.get(key) ?? 0;
    return {
      slotId: r.id,
      projectId: r.projectId,
      projectName: r.project.name,
      templateId: r.templateId,
      templateName: r.template.name,
      templateColor: r.template.color,
      templateIcon: r.template.icon,
      slotIndex: filled + i,
    };
  });

  return { count: slots.length, slots };
}
