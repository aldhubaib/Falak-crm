import { getTask } from "@/actions/projects";
import { getTaskStatuses, getChecklistTemplates } from "@/actions/settings";
import { notFound } from "next/navigation";
import { TaskDetailClient } from "./task-detail-client";

interface Props {
  params: Promise<{ id: string; taskId: string }>;
  searchParams: Promise<{ statusId?: string }>;
}

export default async function TaskDetailPage({ params, searchParams }: Props) {
  const { id: projectId, taskId } = await params;
  const { statusId } = await searchParams;

  const isNew = taskId === "new";

  const [task, taskStatuses, allTemplates] = await Promise.all([
    isNew ? null : getTask(taskId),
    getTaskStatuses(),
    getChecklistTemplates(),
  ]);

  if (!isNew && (!task || task.project.id !== projectId)) notFound();

  const safe = <T,>(obj: T): T => JSON.parse(JSON.stringify(obj));

  const templates = allTemplates.map((t) => ({
    id: t.id,
    name: t.name,
    itemCount: t.items.length,
    items: t.items.map((i) => ({
      id: i.id,
      name: i.name,
      type: i.type,
      role: i.role,
      options: i.options,
      allowedFileTypes: i.allowedFileTypes,
      allowedFormats: i.allowedFormats,
      aspectRatio: i.aspectRatio,
      mandatory: i.mandatory,
      phase: i.phase,
      visibleFromStageId: i.visibleFromStageId,
      requiredBeforeStageId: i.requiredBeforeStageId,
      order: i.order,
    })),
  }));

  return (
    <TaskDetailClient
      task={task ? safe(task) : null}
      projectId={projectId}
      initialStatusId={statusId || taskStatuses[0]?.id || ""}
      taskStatuses={safe(taskStatuses)}
      availableTemplates={templates}
    />
  );
}
