import { notFound } from "next/navigation";
import { getProject } from "@/actions/projects";
import { getTaskStatuses } from "@/actions/settings";
import { NewTaskClient } from "./new-task-client";

export default async function NewTaskPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const [project, statuses] = await Promise.all([
    getProject(projectId),
    getTaskStatuses(),
  ]);

  if (!project) notFound();

  const defaultStatusId =
    statuses.filter((s) => s.name !== "Published")[0]?.id ??
    statuses[0]?.id ??
    null;

  const taskTypes = project.projectTemplates.map((pt) => ({
    id: pt.template.id,
    name: pt.template.name,
    fields: pt.template.items
      .filter((it) => it.phase === "requirement")
      .map((it) => ({
        id: it.id,
        name: it.name,
        type: it.type,
        mandatory: it.mandatory,
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
