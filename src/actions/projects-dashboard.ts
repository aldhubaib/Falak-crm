"use server";

import { db } from "@/lib/db";
import { requireWorkspaceWithMember } from "@/lib/workspace";
import { weekStartOf } from "@/lib/week";
import { ensureWeeklySlots } from "@/lib/weekly-slots";
import { getProjectTimezones } from "@/lib/project-timezone";

export type DashboardProject = {
  id: string;
  name: string;
  thumbnailId: string | null;
  taskCount: number;
  statusName: string | null;
};

export type WeekScheduleTask = {
  taskId: string;
  title: string;
  templateName: string;
  templateColor: string | null;
  templateIcon: string | null;
  done: boolean;
};

export type WeekScheduleSlot = {
  slotId: string;
  templateName: string;
  templateColor: string | null;
  templateIcon: string | null;
  slotIndex: number;
};

export type WeekScheduleProject = {
  projectId: string;
  projectName: string;
  thumbnailId: string | null;
  doneCount: number;
  totalCount: number;
  tasks: WeekScheduleTask[];
  slots: WeekScheduleSlot[];
};

export type ThisWeekData = {
  doneCount: number;
  totalPlanned: number;
  projects: WeekScheduleProject[];
};

async function accessibleProjectIds(
  member: { id: string; userId: string; type: string },
  workspaceId: string,
) {
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

/** Active projects for the dashboard avatar stack (status = Active). */
export async function getActiveProjectsDashboard(): Promise<DashboardProject[]> {
  const { workspace, member } = await requireWorkspaceWithMember();
  const isOwner = member.type === "OWNER";
  return db.project
    .findMany({
      where: {
        workspaceId: workspace.id,
        deletedAt: null,
        status: { name: "Active" },
        ...(isOwner
          ? {}
          : {
              OR: [
                { ownerId: member.userId },
                { members: { some: { memberId: member.id } } },
              ],
            }),
      },
      select: {
        id: true,
        name: true,
        thumbnailId: true,
        status: { select: { name: true } },
        _count: { select: { tasks: { where: { deletedAt: null } } } },
      },
      orderBy: { name: "asc" },
    })
    .then((rows) =>
      rows.map((p) => ({
        id: p.id,
        name: p.name,
        thumbnailId: p.thumbnailId,
        taskCount: p._count.tasks,
        statusName: p.status?.name ?? null,
      })),
    );
}

/** This week's planned tasks and open slots, grouped by project. */
export async function getThisWeekSchedule(): Promise<ThisWeekData> {
  const { workspace, member } = await requireWorkspaceWithMember();
  const projectIds = await accessibleProjectIds(member, workspace.id);
  if (projectIds.length === 0) {
    return { doneCount: 0, totalPlanned: 0, projects: [] };
  }

  await Promise.all(projectIds.map((id) => ensureWeeklySlots(id)));

  const timezoneByProject = await getProjectTimezones(projectIds);
  const weekClauses = projectIds.map((projectId) => ({
    projectId,
    weekStart: weekStartOf(new Date(), timezoneByProject.get(projectId)),
  }));

  const slots = await db.weeklySlot.findMany({
    where: {
      OR: weekClauses.map((c) => ({
        projectId: c.projectId,
        weekStart: c.weekStart,
      })),
      removedAt: null,
    },
    orderBy: [{ projectId: "asc" }, { templateId: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      projectId: true,
      templateId: true,
      taskId: true,
      project: { select: { name: true, thumbnailId: true } },
      template: { select: { name: true, color: true, icon: true } },
      task: {
        select: {
          id: true,
          title: true,
          completedAt: true,
          status: { select: { name: true } },
        },
      },
    },
  });

  const filledCounts = await db.weeklySlot.groupBy({
    by: ["projectId", "templateId"],
    where: {
      OR: weekClauses.map((c) => ({
        projectId: c.projectId,
        weekStart: c.weekStart,
      })),
      taskId: { not: null },
      removedAt: null,
    },
    _count: { _all: true },
  });
  const filledMap = new Map(
    filledCounts.map((c) => [`${c.projectId}:${c.templateId}`, c._count._all]),
  );

  const emptyOrdinal = new Map<string, number>();
  const byProject = new Map<string, WeekScheduleProject>();

  for (const s of slots) {
    let group = byProject.get(s.projectId);
    if (!group) {
      group = {
        projectId: s.projectId,
        projectName: s.project.name,
        thumbnailId: s.project.thumbnailId,
        doneCount: 0,
        totalCount: 0,
        tasks: [],
        slots: [],
      };
      byProject.set(s.projectId, group);
    }
    group.totalCount += 1;

    if (s.taskId && s.task) {
      const done =
        !!s.task.completedAt ||
        s.task.status?.name === "Completed" ||
        s.task.status?.name === "Published";
      if (done) group.doneCount += 1;
      group.tasks.push({
        taskId: s.task.id,
        title: s.task.title,
        templateName: s.template.name,
        templateColor: s.template.color,
        templateIcon: s.template.icon,
        done,
      });
    } else {
      const key = `${s.projectId}:${s.templateId}`;
      const i = (emptyOrdinal.get(key) ?? 0) + 1;
      emptyOrdinal.set(key, i);
      const filled = filledMap.get(key) ?? 0;
      group.slots.push({
        slotId: s.id,
        templateName: s.template.name,
        templateColor: s.template.color,
        templateIcon: s.template.icon,
        slotIndex: filled + i,
      });
    }
  }

  const projects = [...byProject.values()].sort((a, b) =>
    a.projectName.localeCompare(b.projectName),
  );
  const doneCount = projects.reduce((n, p) => n + p.doneCount, 0);
  const totalPlanned = projects.reduce((n, p) => n + p.totalCount, 0);

  return { doneCount, totalPlanned, projects };
}
