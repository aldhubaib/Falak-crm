import { getProject } from "@/actions/projects";
import { notFound, redirect } from "next/navigation";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProjectDetailPage({ params }: Props) {
  const { id } = await params;
  const project = await getProject(id);

  if (!project) notFound();

  if (project.deal) {
    redirect(`/dashboard/deals/${project.deal.id}?tab=project`);
  }

  redirect("/dashboard/projects");
}
