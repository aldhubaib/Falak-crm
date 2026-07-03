import { notFound } from "next/navigation";
import { MoreVertical } from "lucide-react";
import { getProject } from "@/actions/projects";
import { getTaskStatuses } from "@/actions/settings";
import { AppHeader } from "@/components/app-header";
import { ProjectAvatar } from "@/components/project-avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
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
        leading={<ProjectAvatar name={project.name} size={28} />}
        title={project.name}
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                aria-label="More options"
              >
                <MoreVertical className="size-[18px]" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/projects/${projectId}/settings`}>
                  Settings
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
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
