"use server";

import { db } from "@/lib/db";
import { requireProjectWork } from "@/lib/workspace";
import { weekStartOf } from "@/lib/week";
import { ensureWeeklySlots } from "@/lib/weekly-slots";
import { getProjectTimezone } from "@/lib/project-timezone";

export type BoardStatus = {
  id: string;
  name: string;
  color: string;
  order: number;
};

export type BoardTask = {
  id: string;
  taskNumber: number;
  title: string;
  statusId: string | null;
  statusName: string;
  statusColor: string;
  assigneeId: string | null;
  assigneeName: string | null;
  assigneeAvatar: string | null;
  serviceName: string | null;
  priority: number | null;
  stageEnteredAt: string | null;
  completedAt: string | null;
  createdAt: string;
  totalTimeMs: number;
  checklistTotal: number;
  checklistDone: number;
  deliveryIncomplete: string[];
  submittedById: string | null;
  submittedByName: string | null;
  rejectionCount: number;
  /** Task type (ChecklistTemplate id) — groups the Todo column's weekly slots. */
  templateId: string | null;
};

// One unfilled weekly plan slot shown as a dashed Todo placeholder.
export type WeeklyEmptySlot = {
  id: string;
  assigneeId: string | null;
  assigneeName: string | null;
  assigneeAvatar: string | null;
};

// Weekly Plan capacity for one task type in the current week. `total` counts
// live slots (admin-removed excluded); `emptySlots` are still claimable.
export type WeeklyGroup = {
  templateId: string;
  templateName: string;
  templateColor: string | null;
  templateIcon: string | null;
  total: number;
  emptySlots: WeeklyEmptySlot[];
};

export type BoardData = {
  tasks: BoardTask[];
  statuses: BoardStatus[];
  weekly: WeeklyGroup[];
};

// Lightweight board payload — selects ONLY the fields a card renders, so a
// status change never triggers the heavy `getProject` query. Powers both the
// SSR initial render and the client-side React Query cache.
export async function getBoardData(projectId: string): Promise<BoardData> {
  const { workspace } = await requireProjectWork(projectId);
  const timezone = await getProjectTimezone(projectId);

  // Materialise this week's Todo slots from the weekly targets before reading
  // them back — the first board visit of a new week creates the fresh slots.
  await ensureWeeklySlots(projectId);

  const weekStart = weekStartOf(new Date(), timezone);

  const [tasks, statuses, changes, checklistAgg, slots] = await Promise.all([
    db.task.findMany({
      where: { projectId, deletedAt: null },
      orderBy: { order: "asc" },
      select: {
        id: true,
        taskNumber: true,
        title: true,
        statusId: true,
        priority: true,
        stageEnteredAt: true,
        completedAt: true,
        createdAt: true,
        stageTimings: true,
        rejectionCount: true,
        status: { select: { name: true, color: true } },
        assignee: { select: { id: true, name: true, email: true, imageUrl: true } },
        service: { select: { name: true } },
      },
    }),
    db.taskStatus.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { order: "asc" },
      select: { id: true, name: true, color: true, order: true },
    }),
    // One row per task: the latest status change INTO the task's current
    // status, resolved in the database (DISTINCT ON) instead of loading the
    // project's entire unbounded status-change history into memory.
    db.$queryRaw<
      {
        taskId: string;
        memberId: string | null;
        memberName: string | null;
        memberEmail: string | null;
      }[]
    >`
      SELECT DISTINCT ON (c."taskId")
        c."taskId" AS "taskId",
        m."id" AS "memberId",
        m."name" AS "memberName",
        m."email" AS "memberEmail"
      FROM "TaskStatusChange" c
      JOIN "Task" t ON t."id" = c."taskId"
      JOIN "WorkspaceMember" m ON m."id" = c."memberId"
      WHERE c."action" = 'status_change'
        AND c."toStatusId" = t."statusId"
        AND t."projectId" = ${projectId}
        AND t."deletedAt" IS NULL
      ORDER BY c."taskId", c."createdAt" DESC
    `,
    // Checklist progress per card, aggregated in the database instead of
    // loading every checklist row (with its template item) for every task.
    // Config precedence matches fieldConfig(): the LIVE template item wins
    // when the field is still linked; the per-task snapshot is the fallback.
    db.$queryRaw<
      {
        taskId: string;
        total: number;
        done: number;
        deliveryIncomplete: string[];
        templateId: string | null;
      }[]
    >`
      SELECT
        ci."taskId" AS "taskId",
        COUNT(*) FILTER (
          WHERE NOT COALESCE(ti."hidden", ci."hidden")
        )::int AS "total",
        COUNT(*) FILTER (
          WHERE NOT COALESCE(ti."hidden", ci."hidden") AND ci."completed"
        )::int AS "done",
        COALESCE(
          array_agg(COALESCE(ti."name", ci."name")) FILTER (
            WHERE NOT COALESCE(ti."hidden", ci."hidden")
              AND COALESCE(ti."phase", ci."phase") = 'delivery'
              AND COALESCE(ti."mandatory", ci."mandatory")
              AND NOT ci."completed"
          ),
          '{}'
        ) AS "deliveryIncomplete",
        MAX(ti."templateId") AS "templateId"
      FROM "TaskChecklistItem" ci
      JOIN "Task" t ON t."id" = ci."taskId"
      LEFT JOIN "ChecklistTemplateItem" ti ON ti."id" = ci."templateItemId"
      WHERE t."projectId" = ${projectId}
        AND t."deletedAt" IS NULL
      GROUP BY ci."taskId"
    `,
    db.weeklySlot.findMany({
      where: { projectId, weekStart, removedAt: null },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        templateId: true,
        taskId: true,
        assignee: {
          select: { id: true, name: true, email: true, imageUrl: true },
        },
        template: { select: { name: true, color: true, icon: true } },
      },
    }),
  ]);

  // Resolve who to @mention (and cannot be changed) when a task is declined.
  // Primary: whoever last moved the task INTO its current status — the
  // "submitter". Fallback: the current assignee, so every rejection popup always
  // has someone to notify even when no status-change record exists.
  const changeByTask = new Map(changes.map((c) => [c.taskId, c]));
  const submittedBy = new Map<string, { id: string; name: string }>();
  for (const t of tasks) {
    if (!t.statusId) continue;
    const c = changeByTask.get(t.id);
    if (c?.memberId) {
      submittedBy.set(t.id, {
        id: c.memberId,
        name: c.memberName ?? c.memberEmail ?? "Unknown",
      });
    } else if (t.assignee) {
      submittedBy.set(t.id, {
        id: t.assignee.id,
        name: t.assignee.name ?? t.assignee.email,
      });
    }
  }

  const checklistByTask = new Map(checklistAgg.map((row) => [row.taskId, row]));

  const now = Date.now();
  const mappedTasks: BoardTask[] = tasks.map((t) => {
    const pastMs = Object.values(
      (t.stageTimings as Record<string, number>) ?? {},
    ).reduce((sum, v) => sum + v, 0);
    const currentMs = t.stageEnteredAt
      ? now - t.stageEnteredAt.getTime()
      : 0;
    const checklist = checklistByTask.get(t.id);
    return {
      id: t.id,
      taskNumber: t.taskNumber,
      title: t.title,
      statusId: t.statusId,
      statusName: t.status?.name ?? "Unknown",
      statusColor: t.status?.color ?? "#3b82f6",
      assigneeId: t.assignee?.id ?? null,
      assigneeName: t.assignee?.name ?? t.assignee?.email ?? null,
      assigneeAvatar: t.assignee?.imageUrl ?? null,
      serviceName: t.service?.name ?? null,
      priority: t.priority,
      stageEnteredAt: t.stageEnteredAt?.toISOString() ?? null,
      completedAt: t.completedAt?.toISOString() ?? null,
      createdAt: t.createdAt.toISOString(),
      totalTimeMs: pastMs + currentMs,
      checklistTotal: checklist?.total ?? 0,
      checklistDone: checklist?.done ?? 0,
      deliveryIncomplete: checklist?.deliveryIncomplete ?? [],
      submittedById: submittedBy.get(t.id)?.id ?? null,
      submittedByName: submittedBy.get(t.id)?.name ?? null,
      rejectionCount: t.rejectionCount ?? 0,
      templateId: checklist?.templateId ?? null,
    };
  });

  const weekly: WeeklyGroup[] = [];
  for (const s of slots) {
    let group = weekly.find((g) => g.templateId === s.templateId);
    if (!group) {
      group = {
        templateId: s.templateId,
        templateName: s.template.name,
        templateColor: s.template.color,
        templateIcon: s.template.icon,
        total: 0,
        emptySlots: [],
      };
      weekly.push(group);
    }
    group.total += 1;
    if (!s.taskId) {
      group.emptySlots.push({
        id: s.id,
        assigneeId: s.assignee?.id ?? null,
        assigneeName: s.assignee
          ? (s.assignee.name ?? s.assignee.email)
          : null,
        assigneeAvatar: s.assignee?.imageUrl ?? null,
      });
    }
  }

  return {
    tasks: mappedTasks,
    statuses: statuses.filter((s) => s.name !== "Published"),
    weekly,
  };
}
