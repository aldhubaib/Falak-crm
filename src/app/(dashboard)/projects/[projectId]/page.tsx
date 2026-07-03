import { notFound } from "next/navigation";
import { getBoardData } from "@/actions/board";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/workspace";
import { AppHeader } from "@/components/app-header";
import { ProjectViewMenu } from "@/components/projects/project-view-menu";
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

  const initialData = await getBoardData(projectId);

  return (
    <>
      <AppHeader
        backHref="/projects"
        title={project.name}
        actions={<ProjectViewMenu projectId={projectId} />}
      />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <ProjectBoardClient projectId={project.id} initialData={initialData} />
      </main>
    </>
  );
}
