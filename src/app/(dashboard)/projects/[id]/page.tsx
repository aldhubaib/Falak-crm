import { getProject } from "@/actions/projects";
import { getTaskStatuses } from "@/actions/settings";
import { notFound } from "next/navigation";
import { ProjectDetailClient } from "./project-detail-client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProjectDetailPage({ params }: Props) {
  const { id } = await params;

  const [project, taskStatuses] = await Promise.all([
    getProject(id),
    getTaskStatuses(),
  ]);

  if (!project) notFound();

  const safe = <T,>(obj: T): T => JSON.parse(JSON.stringify(obj));
  return (
    <ProjectDetailClient
      project={safe(project)}
      taskStatuses={safe(taskStatuses)}
    />
  );
}
