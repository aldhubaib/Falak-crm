"use server";

import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/workspace";
import { revalidatePath } from "next/cache";
import { StageType } from "@/generated/prisma";

// ─── Pipelines & Stages ────────────────────────────────────────────────────────

export async function getPipelines() {
  const workspace = await requireWorkspace();
  return db.pipeline.findMany({
    where: { workspaceId: workspace.id },
    include: { stages: { orderBy: { order: "asc" } } },
  });
}

export async function createPipeline(formData: FormData) {
  const workspace = await requireWorkspace();
  const name = formData.get("name") as string;

  await db.pipeline.create({
    data: {
      workspaceId: workspace.id,
      name,
      stages: {
        create: [
          { name: "New", order: 1, type: "OPEN", color: "#3b82f6" },
          { name: "Won", order: 2, type: "WON", color: "#22c55e" },
          { name: "Lost", order: 3, type: "LOST", color: "#ef4444" },
        ],
      },
    },
  });

  revalidatePath("/dashboard/settings/pipelines");
}

export async function createStage(pipelineId: string, formData: FormData) {
  const name = formData.get("name") as string;
  const color = (formData.get("color") as string) || "#3b82f6";
  const type = (formData.get("type") as StageType) || "OPEN";

  const lastStage = await db.pipelineStage.findFirst({
    where: { pipelineId },
    orderBy: { order: "desc" },
  });

  await db.pipelineStage.create({
    data: {
      pipelineId,
      name,
      color,
      type,
      order: (lastStage?.order ?? 0) + 1,
    },
  });

  revalidatePath("/dashboard/settings/pipelines");
}

export async function updateStage(id: string, formData: FormData) {
  const name = formData.get("name") as string;
  const color = (formData.get("color") as string) || "#3b82f6";
  const type = (formData.get("type") as StageType) || "OPEN";

  await db.pipelineStage.update({
    where: { id },
    data: { name, color, type },
  });

  revalidatePath("/dashboard/settings/pipelines");
}

export async function deleteStage(id: string) {
  await db.pipelineStage.delete({ where: { id } });
  revalidatePath("/dashboard/settings/pipelines");
}

export async function reorderStages(pipelineId: string, stageIds: string[]) {
  await Promise.all(
    stageIds.map((id, index) =>
      db.pipelineStage.update({
        where: { id },
        data: { order: index + 1 },
      })
    )
  );

  revalidatePath("/dashboard/settings/pipelines");
}

// ─── Project Statuses ──────────────────────────────────────────────────────────

export async function getProjectStatuses() {
  const workspace = await requireWorkspace();
  return db.projectStatus.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { order: "asc" },
  });
}

export async function createProjectStatus(formData: FormData) {
  const workspace = await requireWorkspace();
  const name = formData.get("name") as string;
  const color = (formData.get("color") as string) || "#3b82f6";

  const last = await db.projectStatus.findFirst({
    where: { workspaceId: workspace.id },
    orderBy: { order: "desc" },
  });

  await db.projectStatus.create({
    data: { workspaceId: workspace.id, name, color, order: (last?.order ?? 0) + 1 },
  });

  revalidatePath("/dashboard/settings/statuses");
}

export async function deleteProjectStatus(id: string) {
  await db.projectStatus.delete({ where: { id } });
  revalidatePath("/dashboard/settings/statuses");
}

// ─── Task Statuses ─────────────────────────────────────────────────────────────

export async function getTaskStatuses() {
  const workspace = await requireWorkspace();
  return db.taskStatus.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { order: "asc" },
  });
}

export async function createTaskStatus(formData: FormData) {
  const workspace = await requireWorkspace();
  const name = formData.get("name") as string;
  const color = (formData.get("color") as string) || "#3b82f6";

  const last = await db.taskStatus.findFirst({
    where: { workspaceId: workspace.id },
    orderBy: { order: "desc" },
  });

  await db.taskStatus.create({
    data: { workspaceId: workspace.id, name, color, order: (last?.order ?? 0) + 1 },
  });

  revalidatePath("/dashboard/settings/statuses");
}

export async function deleteTaskStatus(id: string) {
  await db.taskStatus.delete({ where: { id } });
  revalidatePath("/dashboard/settings/statuses");
}
