import { notFound } from "next/navigation";
import { isFieldVisible } from "@/lib/checklist-config";
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

  // A field whose "Required Before" gate sits at or before the stage right
  // after the initial one must be filled at creation — otherwise the task is
  // born stuck: it saves fine but the very first forward move is rejected.
  const orderById = new Map(statuses.map((s) => [s.id, s.order]));
  const defaultOrder = defaultStatusId ? orderById.get(defaultStatusId) : undefined;
  const firstMoveOrder =
    defaultOrder != null
      ? statuses
          .filter((s) => s.order > defaultOrder)
          .sort((a, b) => a.order - b.order)[0]?.order
      : undefined;
  const requiredAtCreate = (it: {
    mandatory: boolean;
    requiredBeforeStageId: string | null;
  }): boolean => {
    if (it.mandatory) return true;
    if (!it.requiredBeforeStageId || firstMoveOrder == null) return false;
    const gateOrder = orderById.get(it.requiredBeforeStageId);
    return gateOrder != null && gateOrder <= firstMoveOrder;
  };

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
      .filter(
        (it) =>
          it.phase !== "delivery" &&
          isFieldVisible(it, defaultOrder ?? null, orderById),
      )
      .map((it) => ({
        id: it.id,
        name: it.name,
        type: it.type,
        // "Required" from the form's perspective: explicitly mandatory OR
        // gated before the first forward move (drives the * and the save gate).
        mandatory: requiredAtCreate(it),
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
