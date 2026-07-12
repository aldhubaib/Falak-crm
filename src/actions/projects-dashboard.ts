"use server";

import { Prisma } from "@/generated/prisma";
import { db } from "@/lib/db";
import { requireWorkspaceWithMember } from "@/lib/workspace";
import { weekStartOf } from "@/lib/week";
import { ensureWeeklySlots, nextWeekStartOf } from "@/lib/weekly-slots";
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

// ─── Dashboard stat cards (Planned / Completed / Rejected) ──────────────────

/** One row inside a stat card's detail dialog. */
export type StatTaskRow = {
  id: string;
  /** Null for open plan slots that have no task yet. */
  taskId: string | null;
  title: string;
  projectId: string;
  projectName: string;
  typeName: string | null;
  typeColor: string | null;
  typeIcon: string | null;
  assigneeName: string | null;
  assigneeAvatar: string | null;
  /** Due / completed / rejected date, e.g. "Jul 17". */
  dateLabel: string | null;
  /** Latest rejection reason (rejected card only). */
  reason?: string | null;
};

export type DashboardStats = {
  planned: {
    thisWeekCount: number;
    nextWeekCount: number;
    thisWeek: StatTaskRow[];
    nextWeek: StatTaskRow[];
  };
  completed: {
    done: number;
    total: number;
    tasks: StatTaskRow[];
  };
  rejected: {
    count: number;
    tasks: StatTaskRow[];
  };
};

const statDateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

/**
 * Data behind the three dashboard stat cards. Planned counts come from the
 * weekly plan slots (this week + next week's plan, where next week is the
 * larger of its target capacity and any overflow already booked into it).
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const { workspace, member } = await requireWorkspaceWithMember();
  const projectIds = await accessibleProjectIds(member, workspace.id);
  if (projectIds.length === 0) {
    return {
      planned: { thisWeekCount: 0, nextWeekCount: 0, thisWeek: [], nextWeek: [] },
      completed: { done: 0, total: 0, tasks: [] },
      rejected: { count: 0, tasks: [] },
    };
  }

  const timezoneByProject = await getProjectTimezones(projectIds);
  const weekClauses = projectIds.map((projectId) => {
    const weekStart = weekStartOf(new Date(), timezoneByProject.get(projectId));
    return { projectId, weekStart, nextWeek: nextWeekStartOf(weekStart) };
  });
  const nextWeekByProject = new Map(
    weekClauses.map((c) => [c.projectId, c.nextWeek.getTime()]),
  );

  const [
    slots,
    targets,
    completedAgg,
    completedCount,
    totalTasks,
    rejectedCandidates,
  ] = await Promise.all([
      // Live plan slots for the current AND next week across all projects.
      db.weeklySlot.findMany({
        where: {
          OR: weekClauses.flatMap((c) => [
            { projectId: c.projectId, weekStart: c.weekStart },
            { projectId: c.projectId, weekStart: c.nextWeek },
          ]),
          removedAt: null,
        },
        orderBy: [{ projectId: "asc" }, { templateId: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          projectId: true,
          templateId: true,
          weekStart: true,
          project: { select: { name: true } },
          template: { select: { name: true, color: true, icon: true } },
          assignee: { select: { name: true, email: true, imageUrl: true } },
          task: {
            select: {
              id: true,
              title: true,
              dueDate: true,
              assignee: { select: { name: true, email: true, imageUrl: true } },
            },
          },
        },
      }),
      // Weekly targets — next week's plan is its full capacity even before
      // its slots materialise (they only exist in the DB after an overflow).
      db.projectWeeklyTarget.findMany({
        where: { projectId: { in: projectIds }, perWeek: { gt: 0 } },
        select: {
          projectId: true,
          templateId: true,
          perWeek: true,
          project: { select: { name: true } },
          template: { select: { name: true, color: true, icon: true } },
          responsibleMember: {
            select: { name: true, email: true, imageUrl: true },
          },
        },
      }),
      db.task.findMany({
        where: {
          projectId: { in: projectIds },
          deletedAt: null,
          completedAt: { not: null },
        },
        orderBy: { completedAt: "desc" },
        take: 100,
        select: {
          id: true,
          title: true,
          projectId: true,
          completedAt: true,
          project: { select: { name: true } },
          template: { select: { name: true, color: true, icon: true } },
          assignee: { select: { name: true, email: true, imageUrl: true } },
        },
      }),
      db.task.count({
        where: {
          projectId: { in: projectIds },
          deletedAt: null,
          completedAt: { not: null },
        },
      }),
      db.task.count({
        where: { projectId: { in: projectIds }, deletedAt: null },
      }),
      // Candidates for the Rejected card: ever-rejected, still open tasks.
      // Whether they're CURRENTLY rejected (last move was a rollback) is
      // resolved below against each task's latest status change.
      db.task.findMany({
        where: {
          projectId: { in: projectIds },
          deletedAt: null,
          completedAt: null,
          rejectionCount: { gt: 0 },
        },
        orderBy: { updatedAt: "desc" },
        take: 200,
        select: {
          id: true,
          title: true,
          projectId: true,
          project: { select: { name: true } },
          template: { select: { name: true, color: true, icon: true } },
          assignee: { select: { name: true, email: true, imageUrl: true } },
        },
      }),
    ]);

  // A task shows on the Rejected card only while it SITS in a rejected state:
  // its most recent status change moved it backward. Moving it forward again
  // clears it from the card; another rejection brings it back.
  const rejectedTasks: typeof rejectedCandidates = [];
  if (rejectedCandidates.length > 0) {
    const latestMoves = await db.$queryRaw<
      { taskId: string; fromOrder: number | null; toOrder: number | null }[]
    >`
      SELECT DISTINCT ON (c."taskId")
        c."taskId" AS "taskId",
        sf."order" AS "fromOrder",
        st."order" AS "toOrder"
      FROM "TaskStatusChange" c
      LEFT JOIN "TaskStatus" sf ON sf."id" = c."fromStatusId"
      LEFT JOIN "TaskStatus" st ON st."id" = c."toStatusId"
      WHERE c."taskId" IN (${Prisma.join(rejectedCandidates.map((t) => t.id))})
        AND c."action" = 'status_change'
      ORDER BY c."taskId", c."createdAt" DESC
    `;
    const currentlyRejected = new Set(
      latestMoves
        .filter(
          (m) =>
            m.fromOrder != null && m.toOrder != null && m.toOrder < m.fromOrder,
        )
        .map((m) => m.taskId),
    );
    rejectedTasks.push(
      ...rejectedCandidates.filter((t) => currentlyRejected.has(t.id)),
    );
  }

  // Latest rejection reason per rejected task, from the decline comments.
  const rejectionMsgs = rejectedTasks.length
    ? await db.message.findMany({
        where: {
          taskId: { in: rejectedTasks.map((t) => t.id) },
          kind: "rejection",
        },
        orderBy: { createdAt: "desc" },
        select: { taskId: true, body: true, createdAt: true },
      })
    : [];
  const reasonByTask = new Map<string, { body: string; createdAt: Date }>();
  for (const m of rejectionMsgs) {
    if (m.taskId && !reasonByTask.has(m.taskId)) {
      reasonByTask.set(m.taskId, { body: m.body, createdAt: m.createdAt });
    }
  }
  // Decline comments start with an "@[Name](id)" mention — strip it for display.
  const cleanReason = (body: string) =>
    body.replace(/@\[[^\]]*\]\([^)]*\)\s*/g, "").trim() || null;

  const memberName = (m: { name: string | null; email: string } | null) =>
    m ? (m.name ?? m.email) : null;

  const thisWeek: StatTaskRow[] = [];
  const nextWeek: StatTaskRow[] = [];
  // Rows that exist in the DB per project+template for next week — used to
  // pad next week's plan up to its target capacity with virtual open slots.
  const nextWeekRowsByKey = new Map<string, number>();

  for (const s of slots) {
    const isNext = s.weekStart.getTime() === nextWeekByProject.get(s.projectId);
    const key = `${s.projectId}:${s.templateId}`;
    if (isNext) {
      nextWeekRowsByKey.set(key, (nextWeekRowsByKey.get(key) ?? 0) + 1);
    }
    const row: StatTaskRow = s.task
      ? {
          id: s.id,
          taskId: s.task.id,
          title: s.task.title,
          projectId: s.projectId,
          projectName: s.project.name,
          typeName: s.template.name,
          typeColor: s.template.color,
          typeIcon: s.template.icon,
          assigneeName: memberName(s.task.assignee),
          assigneeAvatar: s.task.assignee?.imageUrl ?? null,
          dateLabel: s.task.dueDate ? statDateFmt.format(s.task.dueDate) : null,
        }
      : {
          id: s.id,
          taskId: null,
          title: `${s.template.name} — open slot`,
          projectId: s.projectId,
          projectName: s.project.name,
          typeName: s.template.name,
          typeColor: s.template.color,
          typeIcon: s.template.icon,
          assigneeName: memberName(s.assignee),
          assigneeAvatar: s.assignee?.imageUrl ?? null,
          dateLabel: null,
        };
    (isNext ? nextWeek : thisWeek).push(row);
  }

  // Pad next week's plan with the capacity that hasn't materialised yet.
  for (const t of targets) {
    const key = `${t.projectId}:${t.templateId}`;
    const existing = nextWeekRowsByKey.get(key) ?? 0;
    for (let i = existing; i < t.perWeek; i++) {
      nextWeek.push({
        id: `${key}:virtual:${i}`,
        taskId: null,
        title: `${t.template.name} — open slot`,
        projectId: t.projectId,
        projectName: t.project.name,
        typeName: t.template.name,
        typeColor: t.template.color,
        typeIcon: t.template.icon,
        assigneeName: memberName(t.responsibleMember),
        assigneeAvatar: t.responsibleMember?.imageUrl ?? null,
        dateLabel: null,
      });
    }
  }

  return {
    planned: {
      thisWeekCount: thisWeek.length,
      nextWeekCount: nextWeek.length,
      thisWeek,
      nextWeek,
    },
    completed: {
      done: completedCount,
      total: totalTasks,
      tasks: completedAgg.map((t) => ({
        id: t.id,
        taskId: t.id,
        title: t.title,
        projectId: t.projectId,
        projectName: t.project.name,
        typeName: t.template?.name ?? null,
        typeColor: t.template?.color ?? null,
        typeIcon: t.template?.icon ?? null,
        assigneeName: memberName(t.assignee),
        assigneeAvatar: t.assignee?.imageUrl ?? null,
        dateLabel: t.completedAt ? statDateFmt.format(t.completedAt) : null,
      })),
    },
    rejected: {
      count: rejectedTasks.length,
      tasks: rejectedTasks.map((t) => {
        const r = reasonByTask.get(t.id);
        return {
          id: t.id,
          taskId: t.id,
          title: t.title,
          projectId: t.projectId,
          projectName: t.project.name,
          typeName: t.template?.name ?? null,
          typeColor: t.template?.color ?? null,
          typeIcon: t.template?.icon ?? null,
          assigneeName: memberName(t.assignee),
          assigneeAvatar: t.assignee?.imageUrl ?? null,
          dateLabel: r ? statDateFmt.format(r.createdAt) : null,
          reason: r ? cleanReason(r.body) : null,
        };
      }),
    },
  };
}
