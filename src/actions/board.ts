"use server";

import { db } from "@/lib/db";
import { fieldConfig } from "@/lib/checklist-config";
import { requireProjectWork } from "@/lib/workspace";

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
};

export type BoardData = {
  tasks: BoardTask[];
  statuses: BoardStatus[];
};

// Lightweight board payload — selects ONLY the fields a card renders, so a
// status change never triggers the heavy `getProject` query. Powers both the
// SSR initial render and the client-side React Query cache.
export async function getBoardData(projectId: string): Promise<BoardData> {
  const { workspace } = await requireProjectWork(projectId);

  const [tasks, statuses, changes] = await Promise.all([
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
        checklistItems: {
          select: {
            name: true,
            phase: true,
            mandatory: true,
            completed: true,
            hidden: true,
            // Live template config — the per-task copy is only a fallback.
            templateItem: {
              select: { name: true, phase: true, mandatory: true, hidden: true },
            },
          },
        },
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

  const now = Date.now();
  const mappedTasks: BoardTask[] = tasks.map((t) => {
    const pastMs = Object.values(
      (t.stageTimings as Record<string, number>) ?? {},
    ).reduce((sum, v) => sum + v, 0);
    const currentMs = t.stageEnteredAt
      ? now - t.stageEnteredAt.getTime()
      : 0;
    // Counts follow the LIVE template config (hidden/phase/mandatory), so a
    // settings change is reflected on every card without touching tasks.
    const checklist = t.checklistItems
      .map((i) => ({ cfg: fieldConfig(i), completed: i.completed }))
      .filter((i) => !i.cfg.hidden);
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
      checklistTotal: checklist.length,
      checklistDone: checklist.filter((i) => i.completed).length,
      deliveryIncomplete: checklist
        .filter((i) => i.cfg.phase === "delivery" && i.cfg.mandatory && !i.completed)
        .map((i) => i.cfg.name),
      submittedById: submittedBy.get(t.id)?.id ?? null,
      submittedByName: submittedBy.get(t.id)?.name ?? null,
      rejectionCount: t.rejectionCount ?? 0,
    };
  });

  return {
    tasks: mappedTasks,
    statuses: statuses.filter((s) => s.name !== "Published"),
  };
}
