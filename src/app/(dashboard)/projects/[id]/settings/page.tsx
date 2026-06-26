import { getProject } from "@/actions/projects";
import { getChecklistTemplates, getTaskStatuses, getProjectStatuses } from "@/actions/settings";
import { notFound } from "next/navigation";
import { ProjectSettingsClient } from "./project-settings-client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProjectSettingsPage({ params }: Props) {
  const { id } = await params;

  const [project, allTemplates, taskStatuses, projectStatuses] = await Promise.all([
    getProject(id),
    getChecklistTemplates(),
    getTaskStatuses(),
    getProjectStatuses(),
  ]);

  if (!project) notFound();

  const safe = <T,>(obj: T): T => JSON.parse(JSON.stringify(obj));

  return (
    <ProjectSettingsClient
      project={{
        id: project.id,
        name: project.name,
        description: project.description || null,
        requirePublishing: project.requirePublishing ?? false,
        statusId: project.status?.id || null,
        thumbnailId: project.thumbnailId || null,
        projectTemplates: project.projectTemplates.map((pt) => ({
          templateId: pt.templateId,
        })),
      }}
      allTemplates={safe(
        allTemplates.map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description,
          items: t.items.map((item) => ({
            id: item.id,
            name: item.name,
            type: item.type,
            role: item.role,
            requiredBeforeStage: item.requiredBeforeStage,
          })),
        }))
      )}
      taskStatuses={safe(taskStatuses)}
      projectStatuses={safe(projectStatuses)}
    />
  );
}
