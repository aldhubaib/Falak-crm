"use server";

import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/workspace";
import { revalidatePath } from "next/cache";

export async function getProjects() {
  const workspace = await requireWorkspace();
  return db.project.findMany({
    where: { workspaceId: workspace.id },
    include: {
      company: { select: { id: true, name: true } },
      status: true,
      _count: { select: { tasks: true, invoices: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getProject(id: string) {
  const workspace = await requireWorkspace();
  return db.project.findFirst({
    where: { id, workspaceId: workspace.id },
    include: {
      company: true,
      status: true,
      deal: true,
      tasks: {
        include: { status: true, service: true, assignee: true },
        orderBy: { order: "asc" },
      },
      invoices: { orderBy: { createdAt: "desc" } },
      collaborators: true,
    },
  });
}

export async function updateProjectStatus(id: string, statusId: string) {
  const workspace = await requireWorkspace();
  await db.project.update({
    where: { id, workspaceId: workspace.id },
    data: { statusId },
  });
  revalidatePath("/dashboard/projects");
  revalidatePath(`/dashboard/projects/${id}`);
}

export async function createTask(projectId: string, formData: FormData) {
  const title = formData.get("title") as string;
  const description = (formData.get("description") as string) || undefined;
  const serviceId = (formData.get("serviceId") as string) || undefined;
  const billable = formData.get("billable") === "true";
  const price = formData.get("price") ? parseFloat(formData.get("price") as string) : undefined;
  const statusId = (formData.get("statusId") as string) || undefined;
  const assigneeId = (formData.get("assigneeId") as string) || undefined;

  const lastTask = await db.task.findFirst({
    where: { projectId },
    orderBy: { order: "desc" },
  });

  await db.task.create({
    data: {
      projectId,
      title,
      description,
      serviceId: serviceId || null,
      billable,
      price,
      statusId: statusId || null,
      assigneeId: assigneeId || null,
      order: (lastTask?.order ?? 0) + 1,
    },
  });

  revalidatePath(`/dashboard/projects/${projectId}`);
}

export async function updateTaskStatus(taskId: string, statusId: string, projectId: string) {
  const status = await db.taskStatus.findUnique({ where: { id: statusId } });

  await db.task.update({
    where: { id: taskId },
    data: {
      statusId,
      completedAt: status?.name === "Done" ? new Date() : null,
    },
  });

  revalidatePath(`/dashboard/projects/${projectId}`);
}

export async function deleteTask(taskId: string, projectId: string) {
  await db.task.delete({ where: { id: taskId } });
  revalidatePath(`/dashboard/projects/${projectId}`);
}
