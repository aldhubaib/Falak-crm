import { notFound, redirect } from "next/navigation";
import { getProjectMeta } from "@/actions/projects";
import { getProjectStatuses, getChecklistTemplates } from "@/actions/settings";
import { getProjectAccess } from "@/lib/workspace";
import { hasCap } from "@/lib/permissions";
import { AppHeader } from "@/components/app-header";
import { ProjectPhotoButton } from "@/components/projects/project-photo-button";
import { ProjectSettingsClient } from "./settings-client";

export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  // The whole page is edit-only: require the "modify project settings"
  // capability before fetching anything else.
  const access = await getProjectAccess(projectId);
  if (!access.hasAccess || !hasCap(access.permissions, "projects", "editSettings")) {
    redirect(`/projects/${projectId}`);
  }

  const [project, projectStatuses, templates] = await Promise.all([
    getProjectMeta(projectId),
    getProjectStatuses(),
    getChecklistTemplates(),
  ]);

  if (!project) notFound();

  return (
    <>
      <AppHeader
        backHref={`/projects/${projectId}`}
        title="Project Settings"
        leading={
          <ProjectPhotoButton
            projectId={project.id}
            name={project.name}
            thumbnailId={project.thumbnailId ?? null}
          />
        }
      />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <ProjectSettingsClient
          projectId={project.id}
          currentStatusId={project.statusId}
          description={project.description ?? ""}
          requirePublishing={project.requirePublishing}
          templateIds={project.projectTemplates.map((pt) => pt.templateId)}
          projectStatuses={projectStatuses.map((s) => ({
            id: s.id,
            name: s.name,
            color: s.color,
          }))}
          templates={templates.map((t) => ({
            id: t.id,
            name: t.name,
            itemCount: t.items.length,
          }))}
        />
      </main>
    </>
  );
}
