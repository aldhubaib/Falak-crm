import { getProject } from "@/actions/projects";
import { getTaskStatuses } from "@/actions/settings";
import { getProjectAccess } from "@/lib/workspace";
import { notFound } from "next/navigation";
import { PermissionsProvider } from "@/components/permissions-provider";
import { ProjectDetailClient } from "./project-detail-client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProjectDetailPage({ params }: Props) {
  const { id } = await params;

  const access = await getProjectAccess(id);
  if (!access.hasAccess) notFound();

  const [project, taskStatuses] = await Promise.all([
    getProject(id),
    getTaskStatuses(),
  ]);

  if (!project) notFound();

  const safe = <T,>(obj: T): T => JSON.parse(JSON.stringify(obj));
  return (
    <PermissionsProvider permissions={safe(access.permissions)}>
      <ProjectDetailClient
        project={safe(project)}
        taskStatuses={safe(taskStatuses)}
      />
    </PermissionsProvider>
  );
}
