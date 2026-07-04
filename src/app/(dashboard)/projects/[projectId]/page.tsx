import { notFound } from "next/navigation";
import { getBoardData } from "@/actions/board";
import { getProjectTeam } from "@/actions/projects";
import { db } from "@/lib/db";
import { requireWorkspace, getProjectAccess } from "@/lib/workspace";
import { AppHeader } from "@/components/app-header";
import { ProjectViewMenu } from "@/components/projects/project-view-menu";
import { ProjectTeamStack } from "@/components/projects/project-team-stack";
import { ProjectBoardClient } from "./board-client";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const workspace = await requireWorkspace();
  const project = await db.project.findFirst({
    where: { id: projectId, workspaceId: workspace.id },
    select: { id: true, name: true },
  });
  if (!project) notFound();

  const [initialData, team, access] = await Promise.all([
    getBoardData(projectId),
    getProjectTeam(projectId),
    getProjectAccess(projectId),
  ]);

  const teamMembers = team.members.map((m) => ({
    memberId: m.memberId,
    name: m.member.name ?? m.member.email,
    email: m.member.email,
    imageUrl: m.member.imageUrl ?? null,
    roleId: m.roleId,
    roleName: m.role?.name ?? null,
  }));
  const assignedIds = new Set(team.members.map((m) => m.memberId));
  const candidates = team.allMembers
    .filter((m) => !assignedIds.has(m.id))
    .map((m) => ({
      id: m.id,
      name: m.name ?? m.email,
      email: m.email,
      imageUrl: m.imageUrl ?? null,
    }));
  const canEditTeam =
    access.permissions.projects === "full" || access.permissions.assignMembers === true;

  return (
    <>
      <AppHeader
        backHref="/projects"
        title={project.name}
        beforeNotifications={
          <ProjectTeamStack
            projectId={project.id}
            canEdit={canEditTeam}
            members={teamMembers}
            candidates={candidates}
            roles={team.roles}
          />
        }
        actions={<ProjectViewMenu projectId={projectId} />}
      />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <ProjectBoardClient projectId={project.id} initialData={initialData} />
      </main>
    </>
  );
}
