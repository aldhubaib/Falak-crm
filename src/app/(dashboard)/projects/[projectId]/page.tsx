import { notFound } from "next/navigation";
import { getProject } from "@/actions/projects";
import { getTaskStatuses } from "@/actions/settings";
import { AppHeader } from "@/components/app-header";
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
      <AppHeader title={project.name} />
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
            serviceName: t.service?.name ?? null,
            checklistTotal: t.checklistItems.length,
            checklistDone: t.checklistItems.filter((i) => i.completed).length,
          }))}
          statuses={statuses.map((s) => ({
            id: s.id,
            name: s.name,
            color: s.color,
          }))}
        />
      </main>
    </>
  );
}
