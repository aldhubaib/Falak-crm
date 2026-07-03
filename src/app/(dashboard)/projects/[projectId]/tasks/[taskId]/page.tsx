import { notFound } from "next/navigation";
import { getTask } from "@/actions/projects";
import { TaskDetailClient, type ChecklistItem } from "./task-detail-client";

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; taskId: string }>;
}) {
  const { projectId, taskId } = await params;
  const task = await getTask(taskId);

  if (!task || task.project.id !== projectId) notFound();

  const items: ChecklistItem[] = task.checklistItems.map((it) => ({
    id: it.id,
    name: it.name,
    type: it.type,
    phase: it.phase,
    completed: it.completed,
    textValue: it.textValue,
    attachmentId: it.attachmentId,
    mandatory: it.mandatory,
  }));

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
