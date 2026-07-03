"use server";

import { db } from "@/lib/db";
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
  assigneeName: string | null;
  assigneeAvatar: string | null;
  serviceName: string | null;
  priority: number | null;
  estimateMin: number | null;
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
        estimateMin: true,
        stageEnteredAt: true,
        completedAt: true,
        createdAt: true,
        stageTimings: true,
        rejectionCount: true,
        status: { select: { name: true, color: true } },
        assignee: { select: { id: true, name: true, email: true } },
        service: { select: { name: true } },
        checklistItems: {
          select: { name: true, phase: true, mandatory: true, completed: true },
        },
      },
    }),
    db.taskStatus.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { order: "asc" },
      select: { id: true, name: true, color: true, order: true },
    }),
    db.taskStatusChange.findMany({
      where: {
        action: "status_change",
        task: { projectId, deletedAt: null },
      },
      orderBy: { createdAt: "desc" },
      select: {
        taskId: true,
        toStatusId: true,
        member: { select: { id: true, name: true, email: true } },
      },
    }),
  ]);

  // Resolve who to @mention (and cannot be changed) when a task is declined.
  // Primary: whoever last moved the task INTO its current status — the
  // "submitter". Fallback: the current assignee, so every rejection popup always
  // has someone to notify even when no status-change record exists.
  const submittedBy = new Map<string, { id: string; name: string }>();
  for (const t of tasks) {
    if (!t.statusId) continue;
    const c = changes.find(
      (ch) => ch.taskId === t.id && ch.toStatusId === t.statusId && ch.member,
    );
    if (c?.member) {
      submittedBy.set(t.id, {
        id: c.member.id,
        name: c.member.name ?? c.member.email,
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
    return {
      id: t.id,
      taskNumber: t.taskNumber,
      title: t.title,
      statusId: t.statusId,
      statusName: t.status?.name ?? "Unknown",
      statusColor: t.status?.color ?? "#3b82f6",
      assigneeName: t.assignee?.name ?? null,
      assigneeAvatar: null,
      serviceName: t.service?.name ?? null,
      priority: t.priority,
      estimateMin: t.estimateMin,
      stageEnteredAt: t.stageEnteredAt?.toISOString() ?? null,
      completedAt: t.completedAt?.toISOString() ?? null,
      createdAt: t.createdAt.toISOString(),
      totalTimeMs: pastMs + currentMs,
      checklistTotal: t.checklistItems.length,
      checklistDone: t.checklistItems.filter((i) => i.completed).length,
      deliveryIncomplete: t.checklistItems
        .filter((i) => i.phase === "delivery" && i.mandatory && !i.completed)
        .map((i) => i.name),
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
