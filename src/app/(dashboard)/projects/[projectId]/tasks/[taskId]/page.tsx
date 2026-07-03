import { notFound } from "next/navigation";
import { getTask } from "@/actions/projects";
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
    };
  });

  const typeName =
    task.service?.name ??
    task.checklistItems.find((it) => it.templateItem?.template?.name)?.templateItem
      ?.template?.name ??
    null;

  return (
    <TaskDetailClient
      projectId={projectId}
      taskId={taskId}
      title={task.title}
      typeName={typeName}
      statusName={task.status?.name ?? null}
      items={items}
    />
  );
}
