"use server";

import { db } from "@/lib/db";
import { formatAgeLabel } from "@/lib/format-age";
import { requireWorkspaceWithMember } from "@/lib/workspace";
import { planningWeekStartOf } from "@/lib/week";
import { ensureWeeklySlots } from "@/lib/weekly-slots";

export type ResponsibilityTask = {
  taskId: string;
  projectId: string;
  projectName: string;
  projectThumbnailId: string | null;
  title: string;
  statusName: string;
  statusColor: string;
  templateName: string;
  templateColor: string | null;
  templateIcon: string | null;
  ageLabel: string;
};

export type ResponsibilitySlot = {
  slotId: string;
  projectId: string;
  projectName: string;
  projectThumbnailId: string | null;
  templateId: string;
  templateName: string;
  templateColor: string | null;
  templateIcon: string | null;
  slotIndex: number;
};

export type MyResponsibilityData = {
  count: number;
  tasks: ResponsibilityTask[];
  slots: ResponsibilitySlot[];
};

async function accessibleProjectIds(member: { id: string; userId: string; type: string }, workspaceId: string) {
  const isOwner = member.type === "OWNER";
  const rows = await db.project.findMany({
    where: {
      workspaceId,
      deletedAt: null,
      ...(isOwner
        ? {}
        : {
            OR: [
              { ownerId: member.userId },
              { members: { some: { memberId: member.id } } },
            ],
          }),
    },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

/** Tasks assigned to the member plus empty weekly plan slots they own. */
export async function getMyResponsibility(): Promise<MyResponsibilityData> {
  const { workspace, member } = await requireWorkspaceWithMember();
  const projectIds = await accessibleProjectIds(member, workspace.id);

  const taskRows =
    projectIds.length === 0
      ? []
      : await db.task.findMany({
          where: {
            assigneeId: member.id,
            deletedAt: null,
            projectId: { in: projectIds },
            OR: [
              { statusId: null },
              {
                status: {
                  name: { notIn: ["Completed", "Published"] },
                },
              },
            ],
          },
          orderBy: [{ stageEnteredAt: "desc" }, { updatedAt: "desc" }],
          select: {
            id: true,
            title: true,
            projectId: true,
            stageEnteredAt: true,
            createdAt: true,
            project: { select: { name: true, thumbnailId: true } },
            status: { select: { name: true, color: true } },
            checklistItems: {
              take: 1,
              where: { templateItemId: { not: null } },
              select: {
                templateItem: {
                  select: {
                    template: {
                      select: { name: true, color: true, icon: true },
                    },
                  },
                },
              },
            },
          },
        });

  const tasks: ResponsibilityTask[] = taskRows.map((t) => {
    const tpl = t.checklistItems[0]?.templateItem?.template;
    const anchor = t.stageEnteredAt ?? t.createdAt;
    return {
      taskId: t.id,
      projectId: t.projectId,
      projectName: t.project.name,
      projectThumbnailId: t.project.thumbnailId,
      title: t.title,
      statusName: t.status?.name ?? "Backlog",
      statusColor: t.status?.color ?? "#6b7280",
      templateName: tpl?.name ?? "Task",
      templateColor: tpl?.color ?? null,
      templateIcon: tpl?.icon ?? null,
      ageLabel: formatAgeLabel(anchor),
    };
  });

  if (projectIds.length === 0) {
    return { count: tasks.length, tasks, slots: [] };
  }

  await Promise.all(projectIds.map((id) => ensureWeeklySlots(id)));

  // One unified planning week for every project.
  const weekStart = planningWeekStartOf();

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
      project: { select: { name: true, thumbnailId: true } },
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
      projectThumbnailId: r.project.thumbnailId,
      templateId: r.templateId,
      templateName: r.template.name,
      templateColor: r.template.color,
      templateIcon: r.template.icon,
      slotIndex: filled + i,
    };
  });

  return { count: tasks.length + slots.length, tasks, slots };
}
