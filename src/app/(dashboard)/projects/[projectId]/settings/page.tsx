import { notFound, redirect } from "next/navigation";
import { getProjectMeta } from "@/actions/projects";
import {
  getWeeklyTargets,
  getPlanningEligibleMembers,
  getWeeklyEffortMatrix,
} from "@/actions/weekly-plan";
import { getProjectStatuses, getChecklistTemplates } from "@/actions/settings";
import { getProjectAccess } from "@/lib/workspace";
import { hasCap } from "@/lib/permissions";
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
  if (
    !access.hasAccess ||
    !hasCap(access.permissions, "projects", "editSettings")
  ) {
    redirect(`/projects/${projectId}`);
  }

  const [project, projectStatuses, templates, weeklyTargets, eligibleMembers, effortMatrix] =
    await Promise.all([
      getProjectMeta(projectId),
      getProjectStatuses(),
      getChecklistTemplates(),
      getWeeklyTargets(projectId),
      getPlanningEligibleMembers(projectId),
      getWeeklyEffortMatrix(projectId),
    ]);

  if (!project) notFound();

  return (
    <ProjectSettingsClient
      projectId={project.id}
      projectName={project.name}
      thumbnailId={project.thumbnailId ?? null}
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
      weeklyTargets={weeklyTargets}
      eligibleMembers={eligibleMembers}
      effortMatrix={effortMatrix}
      isOwner={access.member.type === "OWNER" || access.permissions.projects === "full"}
    />
  );
}
