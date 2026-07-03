import { notFound } from "next/navigation";
import { getTask } from "@/actions/projects";
import { getTaskStatuses } from "@/actions/settings";
import { getTaskHistory, getTaskComments } from "@/actions/comments";
import { db } from "@/lib/db";
import { createPresignedGet } from "@/lib/storage";
import { TaskDetailClient, type ChecklistItem } from "./task-detail-client";

function parseArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
}

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; taskId: string }>;
}) {
  const { projectId, taskId } = await params;
  const task = await getTask(taskId);

  if (!task || task.project.id !== projectId) notFound();

  // Resolve attachment metadata (name + presigned preview URL) for any file
  // fields that already have an upload.
  const attachmentIds = task.checklistItems
    .map((it) => it.attachmentId)
    .filter((id): id is string => !!id);

  const attachments = attachmentIds.length
    ? await db.attachment.findMany({
        where: { id: { in: attachmentIds } },
        select: { id: true, name: true, contentType: true, r2Key: true },
      })
    : [];

  const attachmentMap = new Map(
    await Promise.all(
      attachments.map(async (a) => {
        const url = a.r2Key ? await createPresignedGet(a.r2Key) : null;
        return [
          a.id,
          { name: a.name, contentType: a.contentType, url },
        ] as const;
      }),
    ),
  );

  // Resolve stage ordering so each field's lock rule can be evaluated against
  // the task's current stage.
  const statuses = await getTaskStatuses();
  const orderById = new Map(statuses.map((s) => [s.id, s.order]));
  const todoOrder = statuses.length
    ? Math.min(...statuses.map((s) => s.order))
    : 0;
  const currentOrder = task.status?.order ?? null;

  // A field is read-only when the task has reached its configured "Locked From"
  // stage. When left on "Auto" (no stage set) we preserve the built-in rule:
  // requirement fields lock once the task moves past Todo; delivery stays open.
  const isLocked = (
    phase: string,
    lockedFromStageId: string | null,
  ): boolean => {
    if (currentOrder == null) return false;
    if (lockedFromStageId) {
      const lockOrder = orderById.get(lockedFromStageId);
      return lockOrder != null && currentOrder >= lockOrder;
    }
    if (phase === "delivery") return false;
    return currentOrder > todoOrder;
  };

  const items: ChecklistItem[] = task.checklistItems.map((it) => {
    const att = it.attachmentId ? attachmentMap.get(it.attachmentId) : null;
    return {
      id: it.id,
      name: it.name,
      type: it.type,
      phase: it.phase,
      completed: it.completed,
      textValue: it.textValue,
      attachmentId: it.attachmentId,
      attachmentName: att?.name ?? null,
      attachmentUrl: att?.url ?? null,
      attachmentContentType: att?.contentType ?? null,
      mandatory: it.mandatory,
      options: parseArray(it.options),
      allowedFileTypes: it.allowedFileTypes,
      allowedFormats: parseArray(it.allowedFormats),
      aspectRatio: it.aspectRatio,
      locked: isLocked(it.phase, it.lockedFromStageId),
    };
  });

  const typeName =
    task.service?.name ??
    task.checklistItems.find((it) => it.templateItem?.template?.name)?.templateItem
      ?.template?.name ??
    null;

  const history = await getTaskHistory(taskId);
  const comments = await getTaskComments(taskId);

  return (
    <TaskDetailClient
      projectId={projectId}
      taskId={taskId}
      title={task.title}
      typeName={typeName}
      statusName={task.status?.name ?? null}
      statusColor={task.status?.color ?? "#3b82f6"}
      stageEnteredAt={task.stageEnteredAt?.toISOString() ?? null}
      createdAt={task.createdAt.toISOString()}
      items={items}
      comments={comments.map((c) => ({
        id: c.id,
        body: c.body,
        authorName: c.author?.name ?? c.author?.email ?? "Unknown",
        createdAt: c.createdAt.toISOString(),
      }))}
      history={history.map((h) => ({
        id: h.id,
        action: h.action,
        fromStatusName: h.fromStatusName,
        toStatusName: h.toStatusName,
        durationMs: h.durationMs,
        memberName: h.member?.name ?? h.member?.email ?? null,
        createdAt: h.createdAt.toISOString(),
      }))}
      totalTimeMs={
        Object.values((task.stageTimings as Record<string, number>) ?? {}).reduce(
          (sum, v) => sum + v,
          0,
        ) + (task.stageEnteredAt ? Date.now() - task.stageEnteredAt.getTime() : 0)
      }
    />
  );
}
