import { getProject } from "@/actions/projects";
import { getTaskStatuses, getProjectStatuses } from "@/actions/settings";
import { getServices } from "@/actions/services";
import { notFound } from "next/navigation";
import { ProjectDetailClient } from "./project-detail-client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProjectDetailPage({ params }: Props) {
  const { id } = await params;
  const [project, taskStatuses, projectStatuses, services] = await Promise.all([
    getProject(id),
    getTaskStatuses(),
    getProjectStatuses(),
    getServices(),
  ]);

  if (!project) notFound();

  return (
    <ProjectDetailClient
      project={project}
      taskStatuses={taskStatuses}
      projectStatuses={projectStatuses}
      services={services.map((s) => ({ id: s.id, name: s.name, unitPrice: Number(s.unitPrice) }))}
    />
  );
}
