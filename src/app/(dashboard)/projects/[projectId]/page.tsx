import { notFound } from "next/navigation";
import { getProject } from "@/actions/projects";
import { getTaskStatuses } from "@/actions/settings";
import { AppHeader } from "@/components/app-header";
import { ProjectViewMenu } from "@/components/projects/project-view-menu";
import { ProjectBoardClient } from "./board-client";

export default async function ProjectDetailPage({
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

  return (
    <>
      <AppHeader
        backHref="/projects"
        title={project.name}
        actions={<ProjectViewMenu projectId={projectId} />}
      />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <ProjectBoardClient
          projectId={project.id}
          tasks={project.tasks.map((t) => ({
            id: t.id,
            title: t.title,
            statusId: t.statusId,
            statusName: t.status?.name ?? "Unknown",
            statusColor: t.status?.color ?? "#3b82f6",
            assigneeName: t.assignee?.name ?? null,
            assigneeAvatar: null,
            serviceName: t.service?.name ?? null,
            priority: t.priority,
            estimateMin: t.estimateMin,
            stageEnteredAt: t.stageEnteredAt?.toISOString() ?? null,
            createdAt: t.createdAt.toISOString(),
            checklistTotal: t.checklistItems.length,
            checklistDone: t.checklistItems.filter((i) => i.completed).length,
          }))}
          statuses={statuses
            .filter((s) => s.name !== "Published")
            .map((s) => ({
              id: s.id,
              name: s.name,
              color: s.color,
              order: s.order,
            }))}
        />
      </main>
    </>
  );
}
