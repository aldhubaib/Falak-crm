"use server";

import { db } from "@/lib/db";
import { requireWorkspace, requireWorkspaceWithMember } from "@/lib/workspace";
import { canEdit, ROLE_PRESETS } from "@/lib/permissions";
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

  revalidatePath("/settings/pipelines");
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

  revalidatePath("/settings/pipelines");
}

export async function updateStage(id: string, formData: FormData) {
  const name = formData.get("name") as string;
  const color = (formData.get("color") as string) || "#3b82f6";
  const type = (formData.get("type") as StageType) || "OPEN";

  await db.pipelineStage.update({
    where: { id },
    data: { name, color, type },
  });

  revalidatePath("/settings/pipelines");
}

export async function deleteStage(id: string) {
  await db.pipelineStage.delete({ where: { id } });
  revalidatePath("/settings/pipelines");
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

  revalidatePath("/settings/pipelines");
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

  revalidatePath("/settings/statuses");
}

export async function deleteProjectStatus(id: string) {
  await db.projectStatus.delete({ where: { id } });
  revalidatePath("/settings/statuses");
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

  revalidatePath("/settings/statuses");
}

export async function deleteTaskStatus(id: string) {
  await db.taskStatus.delete({ where: { id } });
  revalidatePath("/settings/statuses");
}

// ─── Checklist Templates ────────────────────────────────────────────────────────

export async function getChecklistTemplates() {
  const workspace = await requireWorkspace();
  return db.checklistTemplate.findMany({
    where: { workspaceId: workspace.id },
    include: {
      items: {
        orderBy: { order: "asc" },
        include: { visibleFromStage: true, requiredBeforeStage: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createChecklistTemplate(formData: FormData) {
  const { workspace, member } = await requireWorkspaceWithMember();
  if (!canEdit(member, "projects")) throw new Error("Permission denied");

  const name = formData.get("name") as string;
  if (!name?.trim()) throw new Error("Template name is required");
  const description = (formData.get("description") as string) || undefined;

  await db.checklistTemplate.create({
    data: {
      workspaceId: workspace.id,
      name: name.trim(),
      description,
    },
  });

  revalidatePath("/settings/checklists");
}

export async function updateChecklistTemplate(id: string, data: { name?: string; icon?: string | null; color?: string | null }) {
  const { member } = await requireWorkspaceWithMember();
  if (!canEdit(member, "projects")) throw new Error("Permission denied");
  await db.checklistTemplate.update({ where: { id }, data });
  revalidatePath("/settings/checklists");
}

export async function deleteChecklistTemplate(id: string) {
  await db.checklistTemplate.delete({ where: { id } });
  revalidatePath("/settings/checklists");
}

export async function addChecklistTemplateItem(templateId: string, formData: FormData) {
  const { member } = await requireWorkspaceWithMember();
  if (!canEdit(member, "projects")) throw new Error("Permission denied");

  const name = formData.get("name") as string;
  if (!name?.trim()) throw new Error("Item name is required");

  const type = (formData.get("type") as string) || "text";
  const role = (formData.get("role") as string) || "any";
  const allowedFileTypes = (formData.get("allowedFileTypes") as string)?.trim() || null;
  const allowedFormats = (formData.get("allowedFormats") as string)?.trim() || null;
  const aspectRatio = (formData.get("aspectRatio") as string)?.trim() || null;
  const visibleFromStageId = (formData.get("visibleFromStageId") as string) || null;
  const requiredBeforeStageId = (formData.get("requiredBeforeStageId") as string) || null;
  const mandatory = formData.get("mandatory") === "true";
  const phase = (formData.get("phase") as string) || "create";
  const options = (formData.get("options") as string)?.trim() || null;

  const last = await db.checklistTemplateItem.findFirst({
    where: { templateId },
    orderBy: { order: "desc" },
  });

  await db.checklistTemplateItem.create({
    data: {
      templateId,
      name: name.trim(),
      type,
      role,
      options,
      allowedFileTypes,
      allowedFormats,
      aspectRatio,
      mandatory,
      phase,
      visibleFromStageId,
      requiredBeforeStageId,
      order: (last?.order ?? 0) + 1,
    },
  });

  revalidatePath("/settings/checklists");
}

export async function deleteChecklistTemplateItem(id: string) {
  await db.checklistTemplateItem.delete({ where: { id } });
  revalidatePath("/settings/checklists");
}

export async function updateChecklistTemplateItem(
  id: string,
  data: { name?: string; type?: string; role?: string; options?: string | null; allowedFileTypes?: string | null; allowedFormats?: string | null; aspectRatio?: string | null; mandatory?: boolean; phase?: string; visibleFromStageId?: string | null; requiredBeforeStageId?: string | null }
) {
  const { member } = await requireWorkspaceWithMember();
  if (!canEdit(member, "projects")) throw new Error("Permission denied");

  const { visibleFromStageId, requiredBeforeStageId, ...rest } = data;

  const prismaData: Record<string, unknown> = { ...rest };

  if (visibleFromStageId !== undefined) {
    prismaData.visibleFromStage = visibleFromStageId
      ? { connect: { id: visibleFromStageId } }
      : { disconnect: true };
  }
  if (requiredBeforeStageId !== undefined) {
    prismaData.requiredBeforeStage = requiredBeforeStageId
      ? { connect: { id: requiredBeforeStageId } }
      : { disconnect: true };
  }

  await db.checklistTemplateItem.update({ where: { id }, data: prismaData });

  const syncFields: Record<string, unknown> = {};
  if (data.name !== undefined) syncFields.name = data.name;
  if (data.type !== undefined) syncFields.type = data.type;
  if (data.options !== undefined) syncFields.options = data.options;
  if (data.allowedFileTypes !== undefined) syncFields.allowedFileTypes = data.allowedFileTypes;
  if (data.allowedFormats !== undefined) syncFields.allowedFormats = data.allowedFormats;
  if (data.aspectRatio !== undefined) syncFields.aspectRatio = data.aspectRatio;
  if (data.mandatory !== undefined) syncFields.mandatory = data.mandatory;
  if (data.phase !== undefined) syncFields.phase = data.phase;
  if (visibleFromStageId !== undefined) syncFields.visibleFromStageId = visibleFromStageId;
  if (requiredBeforeStageId !== undefined) syncFields.requiredBeforeStageId = requiredBeforeStageId;

  if (Object.keys(syncFields).length > 0) {
    await db.taskChecklistItem.updateMany({
      where: { templateItemId: id },
      data: syncFields,
    });
  }

  revalidatePath("/settings/checklists");
  revalidatePath("/settings/task-types");
}

// Reorder + move items across sections (phase) in one transaction.
export async function reorderChecklistItems(
  _templateId: string,
  items: { id: string; phase: string; order: number }[],
) {
  const { member } = await requireWorkspaceWithMember();
  if (!canEdit(member, "projects")) throw new Error("Permission denied");

  await db.$transaction(
    items.map((it) =>
      db.checklistTemplateItem.update({
        where: { id: it.id },
        data: { phase: it.phase, order: it.order },
      }),
    ),
  );

  revalidatePath("/settings/task-types");
}

// ─── Roles ────────────────────────────────────────────────────────────────────

export async function seedDefaultRoles() {
  const { workspace, member } = await requireWorkspaceWithMember();
  if (!canEdit(member, "team")) throw new Error("Permission denied");

  const existingRoles = await db.role.findMany({
    where: { workspaceId: workspace.id },
  });

  const existingNames = new Set(existingRoles.map((r) => r.name));
  const toCreate = Object.values(ROLE_PRESETS).filter(
    (preset) => !existingNames.has(preset.name)
  );

  if (toCreate.length === 0) return;

  await db.role.createMany({
    data: toCreate.map((preset) => ({
      workspaceId: workspace.id,
      name: preset.name,
      permissions: JSON.parse(JSON.stringify(preset.permissions)),
    })),
  });

  revalidatePath("/settings/team");
}
