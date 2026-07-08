import { notFound } from "next/navigation";
import { normalizeFormats } from "@/lib/formats";
import { getProjectTaskTemplates } from "@/actions/projects";
import { getTaskStatuses } from "@/actions/settings";
import { db } from "@/lib/db";
import { NewTaskClient } from "./new-task-client";

export default async function NewTaskPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const [project, statuses, tasks] = await Promise.all([
    getProjectTaskTemplates(projectId),
    getTaskStatuses(),
    db.task.findMany({
      where: { projectId, deletedAt: null },
      select: {
        id: true,
        checklistItems: {
          select: { templateItem: { select: { templateId: true } } },
        },
      },
    }),
  ]);

  if (!project) notFound();

  // Count how many existing tasks use each template (a task is counted once per
  // distinct template referenced by its checklist items).
  const countByTemplate: Record<string, number> = {};
  for (const task of tasks) {
    const templateIds = new Set<string>();
    for (const item of task.checklistItems) {
      const tid = item.templateItem?.templateId;
      if (tid) templateIds.add(tid);
    }
    for (const tid of templateIds) {
      countByTemplate[tid] = (countByTemplate[tid] ?? 0) + 1;
    }
  }

  const defaultStatusId =
    statuses.filter((s) => s.name !== "Published")[0]?.id ??
    statuses[0]?.id ??
    null;

  const parseArray = (raw: string | null): string[] => {
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
  };

  const taskTypes = project.projectTemplates.map((pt) => ({
    id: pt.template.id,
    name: pt.template.name,
    titleLabel: pt.template.titleLabel,
    titleHelp: pt.template.titleHelp,
    count: countByTemplate[pt.template.id] ?? 0,
    fields: pt.template.items
      .filter((it) => it.phase !== "delivery")
      .map((it) => ({
        id: it.id,
        name: it.name,
        type: it.type,
        mandatory: it.mandatory,
        options: parseArray(it.options),
        allowedFileTypes: it.allowedFileTypes,
        allowedFormats: normalizeFormats(parseArray(it.allowedFormats)),
        aspectRatio: it.aspectRatio,
      })),
  }));

  return (
    <NewTaskClient
      projectId={projectId}
      projectName={project.name}
      defaultStatusId={defaultStatusId}
      taskTypes={taskTypes}
    />
  );
}
