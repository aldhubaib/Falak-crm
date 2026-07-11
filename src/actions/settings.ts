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
      sections: { orderBy: { order: "asc" } },
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
      // Every template starts with the two classic sections; both can be
      // renamed or removed and more can be added later.
      sections: {
        create: [
          { name: "Requirements", phase: "create", order: 0 },
          { name: "Delivery", phase: "delivery", order: 1 },
        ],
      },
    },
  });

  revalidatePath("/settings/checklists");
  revalidatePath("/settings/task-types");
}
// Sections group a task type's fields ("Requirements", "Delivery", or any
// custom group). Each carries a phase that drives the existing behavior:
// "create" fields belong to the new-task form and lock after Todo; "delivery"
// fields are filled during work. Items always mirror their section's phase.

export async function createChecklistSection(
  templateId: string,
  name: string,
  phase: "create" | "delivery",
) {
  const { workspace, member } = await requireWorkspaceWithMember();
  if (!canEdit(member, "projects")) throw new Error("Permission denied");
  if (!name.trim()) throw new Error("Section name is required");

  const template = await db.checklistTemplate.findFirst({
    where: { id: templateId, workspaceId: workspace.id },
    select: { id: true },
  });
  if (!template) throw new Error("Task type not found");

  const last = await db.checklistSection.findFirst({
    where: { templateId },
    orderBy: { order: "desc" },
  });
  await db.checklistSection.create({
    data: {
      templateId,
      name: name.trim(),
      phase,
      order: (last?.order ?? -1) + 1,
    },
  });

  revalidatePath("/settings/task-types");
}

export async function updateChecklistSection(
  id: string,
  data: { name?: string; phase?: "create" | "delivery" },
) {
  const { workspace, member } = await requireWorkspaceWithMember();
  if (!canEdit(member, "projects")) throw new Error("Permission denied");
  if (data.name !== undefined && !data.name.trim())
    throw new Error("Section name is required");

  const updated = await db.checklistSection.updateMany({
    where: { id, template: { workspaceId: workspace.id } },
    data: {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.phase !== undefined ? { phase: data.phase } : {}),
    },
  });
  if (updated.count === 0) throw new Error("Section not found");

  // Changing a section's behavior re-phases every field in it — template
  // items and their copies on existing tasks alike.
  if (data.phase !== undefined) {
    const items = await db.checklistTemplateItem.findMany({
      where: { sectionId: id },
      select: { id: true },
    });
    if (items.length > 0) {
      const ids = items.map((i) => i.id);
      await db.$transaction([
        db.checklistTemplateItem.updateMany({
          where: { id: { in: ids } },
          data: { phase: data.phase },
        }),
        db.taskChecklistItem.updateMany({
          where: { templateItemId: { in: ids } },
          data: { phase: data.phase },
        }),
      ]);
    }
  }

  revalidatePath("/settings/task-types");
}

export async function reorderChecklistSections(
  templateId: string,
  orderedIds: string[],
) {
  const { workspace, member } = await requireWorkspaceWithMember();
  if (!canEdit(member, "projects")) throw new Error("Permission denied");

  const sections = await db.checklistSection.findMany({
    where: { templateId, template: { workspaceId: workspace.id } },
    select: { id: true },
  });
  const known = new Set(sections.map((s) => s.id));
  if (
    orderedIds.length !== sections.length ||
    orderedIds.some((id) => !known.has(id))
  ) {
    throw new Error("Section list is out of date — refresh and try again");
  }

  // Renumber every field globally in the new section order (keeping each
  // section's internal order) so downstream sorts that use the flat item
  // order (publish card, effort breakdown, task page) follow the sections.
  const items = await db.checklistTemplateItem.findMany({
    where: { templateId },
    select: { id: true, sectionId: true, order: true },
    orderBy: { order: "asc" },
  });
  const rank = new Map(orderedIds.map((id, i) => [id, i]));
  const sorted = [...items].sort(
    (a, b) =>
      (rank.get(a.sectionId ?? "") ?? -1) -
        (rank.get(b.sectionId ?? "") ?? -1) || a.order - b.order,
  );

  await db.$transaction([
    ...orderedIds.map((id, i) =>
      db.checklistSection.update({ where: { id }, data: { order: i } }),
    ),
    ...sorted.flatMap((it, i) => [
      db.checklistTemplateItem.update({
        where: { id: it.id },
        data: { order: i },
      }),
      db.taskChecklistItem.updateMany({
        where: { templateItemId: it.id },
        data: { order: i },
      }),
    ]),
  ]);

  revalidatePath("/settings/task-types");
}

export async function deleteChecklistSection(id: string) {
  const { workspace, member } = await requireWorkspaceWithMember();
  if (!canEdit(member, "projects")) throw new Error("Permission denied");

  const itemCount = await db.checklistTemplateItem.count({
    where: { sectionId: id },
  });
  if (itemCount > 0) {
    throw new Error(
      "This section still has fields. Move or delete them first.",
    );
  }
  await db.checklistSection.deleteMany({
    where: { id, template: { workspaceId: workspace.id } },
  });

  revalidatePath("/settings/task-types");
}

export async function updateChecklistTemplate(id: string, data: { name?: string; icon?: string | null; color?: string | null; publishToCalendar?: boolean; titleLockedFromStageId?: string | null; titleNeverLock?: boolean; titleLabel?: string | null; titleHelp?: string | null }) {
  const { workspace, member } = await requireWorkspaceWithMember();
  if (!canEdit(member, "projects")) throw new Error("Permission denied");
  await db.checklistTemplate.update({
    where: { id, workspaceId: workspace.id },
    data,
  });

  // The type-level Publish toggle is retroactive, matching the rest of this
  // settings page ("changes here affect every project immediately"): existing
  // tasks created from this type follow the new value.
  if (data.publishToCalendar !== undefined) {
    await db.task.updateMany({
      where: {
        OR: [
          { templateId: id },
          { checklistItems: { some: { templateItem: { templateId: id } } } },
        ],
      },
      data: { publish: data.publishToCalendar },
    });
    revalidatePath("/publish");
  }

  revalidatePath("/settings/checklists");
  revalidatePath("/settings/task-types");
}

export async function deleteChecklistTemplate(id: string) {
  const { workspace, member } = await requireWorkspaceWithMember();
  if (!canEdit(member, "projects")) throw new Error("Permission denied");
  await db.checklistTemplate.delete({
    where: { id, workspaceId: workspace.id },
  });
  revalidatePath("/settings/checklists");
  revalidatePath("/settings/task-types");
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
  const lockedFromStageId = (formData.get("lockedFromStageId") as string) || null;
  const neverLock = formData.get("neverLock") === "true";
  const mandatory = formData.get("mandatory") === "true";
  // New fields land in a section; the phase (behavior) comes from it. A bare
  // phase value is kept as fallback for legacy callers.
  const sectionId = (formData.get("sectionId") as string) || null;
  let phase = (formData.get("phase") as string) || "create";
  if (sectionId) {
    const section = await db.checklistSection.findFirst({
      where: { id: sectionId, templateId },
      select: { phase: true },
    });
    if (!section) throw new Error("Section not found");
    phase = section.phase;
  }
  const options = (formData.get("options") as string)?.trim() || null;
  const publishCard = (formData.get("publishCard") as string) || "hidden";
  const effortUnit = (formData.get("effortUnit") as string)?.trim() || null;
  const qtyRaw = Number.parseFloat((formData.get("qtyPerVideoMinute") as string) ?? "");
  const qtyPerVideoMinute = Number.isFinite(qtyRaw) && qtyRaw > 0 ? qtyRaw : null;

  const last = await db.checklistTemplateItem.findFirst({
    where: { templateId },
    orderBy: { order: "desc" },
  });

  const item = await db.checklistTemplateItem.create({
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
      sectionId,
      visibleFromStageId,
      requiredBeforeStageId,
      lockedFromStageId,
      neverLock,
      publishCard,
      effortUnit,
      qtyPerVideoMinute,
      order: (last?.order ?? 0) + 1,
    },
  });

  // "Changes here affect every project immediately" — backfill the new field
  // onto every existing task built from this template, same as field edits
  // already sync. Without this, only tasks created afterwards would have it.
  const existingTasks = await db.taskChecklistItem.findMany({
    where: { templateItem: { templateId } },
    select: { taskId: true },
    distinct: ["taskId"],
  });
  if (existingTasks.length > 0) {
    await db.taskChecklistItem.createMany({
      data: existingTasks.map(({ taskId }) => ({
        taskId,
        templateItemId: item.id,
        name: item.name,
        type: item.type,
        role: item.role,
        options: item.options,
        allowedFileTypes: item.allowedFileTypes,
        allowedFormats: item.allowedFormats,
        aspectRatio: item.aspectRatio,
        mandatory: item.mandatory,
        phase: item.phase,
        visibleFromStageId: item.visibleFromStageId,
        requiredBeforeStageId: item.requiredBeforeStageId,
        lockedFromStageId: item.lockedFromStageId,
        neverLock: item.neverLock,
        publishCard: item.publishCard,
        effortUnit: item.effortUnit,
        qtyPerVideoMinute: item.qtyPerVideoMinute,
        order: item.order,
      })),
    });
  }

  revalidatePath("/settings/checklists");
  revalidatePath("/settings/task-types");
  revalidatePath("/publish");
}
// field. Drives the delete guard: fields with data can't be deleted.
export async function getChecklistTemplateItemUsage(id: string) {
  await requireWorkspaceWithMember();
  const tasksWithData = await db.taskChecklistItem.count({
    where: {
      templateItemId: id,
      OR: [
        { completed: true },
        { attachmentId: { not: null } },
        { AND: [{ textValue: { not: null } }, { textValue: { not: "" } }] },
      ],
    },
  });
  return { tasksWithData };
}

// Disable/enable a field without deleting it: hidden fields vanish from tasks
// and the publish card but keep every answer already entered, so a field with
// data can be retired safely (and restored later).
export async function setChecklistTemplateItemHidden(id: string, hidden: boolean) {
  const { member } = await requireWorkspaceWithMember();
  if (!canEdit(member, "projects")) throw new Error("Permission denied");

  await db.$transaction([
    db.checklistTemplateItem.update({ where: { id }, data: { hidden } }),
    db.taskChecklistItem.updateMany({
      where: { templateItemId: id },
      data: { hidden },
    }),
  ]);

  revalidatePath("/settings/task-types");
  revalidatePath("/publish");
}

export async function deleteChecklistTemplateItem(id: string) {
  const { member } = await requireWorkspaceWithMember();
  if (!canEdit(member, "projects")) throw new Error("Permission denied");

  const { tasksWithData } = await getChecklistTemplateItemUsage(id);
  if (tasksWithData > 0) {
    throw new Error(
      `This field has data on ${tasksWithData} task(s) and can't be deleted`,
    );
  }

  // Also remove the (empty) copies on existing tasks. The FK is SetNull, so
  // without this the tasks would keep orphaned ghost fields forever.
  await db.$transaction([
    db.taskChecklistItem.deleteMany({ where: { templateItemId: id } }),
    db.checklistTemplateItem.delete({ where: { id } }),
  ]);

  revalidatePath("/settings/checklists");
  revalidatePath("/settings/task-types");
}

export async function updateChecklistTemplateItem(
  id: string,
  data: { name?: string; type?: string; role?: string; options?: string | null; allowedFileTypes?: string | null; allowedFormats?: string | null; aspectRatio?: string | null; mandatory?: boolean; phase?: string; visibleFromStageId?: string | null; requiredBeforeStageId?: string | null; lockedFromStageId?: string | null; neverLock?: boolean; publishCard?: string; effortUnit?: string | null; qtyPerVideoMinute?: number | null }
) {
  const { member } = await requireWorkspaceWithMember();
  if (!canEdit(member, "projects")) throw new Error("Permission denied");

  const { visibleFromStageId, requiredBeforeStageId, lockedFromStageId, ...rest } = data;

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
  if (lockedFromStageId !== undefined) {
    prismaData.lockedFromStage = lockedFromStageId
      ? { connect: { id: lockedFromStageId } }
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
  if (lockedFromStageId !== undefined) syncFields.lockedFromStageId = lockedFromStageId;
  if (data.neverLock !== undefined) syncFields.neverLock = data.neverLock;
  if (data.publishCard !== undefined) syncFields.publishCard = data.publishCard;
  if (data.effortUnit !== undefined) syncFields.effortUnit = data.effortUnit;
  if (data.qtyPerVideoMinute !== undefined) syncFields.qtyPerVideoMinute = data.qtyPerVideoMinute;

  if (Object.keys(syncFields).length > 0) {
    await db.taskChecklistItem.updateMany({
      where: { templateItemId: id },
      data: syncFields,
    });
  }

  if (data.publishCard !== undefined) revalidatePath("/publish");
  revalidatePath("/settings/checklists");
  revalidatePath("/settings/task-types");
}

// Reorder + move items across sections in one transaction. The phase is
// resolved from the target section so behavior always follows placement.
export async function reorderChecklistItems(
  templateId: string,
  items: { id: string; sectionId: string; order: number }[],
) {
  const { member } = await requireWorkspaceWithMember();
  if (!canEdit(member, "projects")) throw new Error("Permission denied");

  const sections = await db.checklistSection.findMany({
    where: { templateId },
    select: { id: true, phase: true },
  });
  const phaseBySection = new Map(sections.map((s) => [s.id, s.phase]));

  // Task checklist rows carry their own copy of order/phase (snapshotted at
  // creation), so the new arrangement must be synced to existing tasks too —
  // otherwise only future tasks pick it up.
  await db.$transaction(
    items.flatMap((it) => {
      const phase = phaseBySection.get(it.sectionId);
      if (!phase) throw new Error("Section not found");
      return [
        db.checklistTemplateItem.update({
          where: { id: it.id },
          data: { phase, sectionId: it.sectionId, order: it.order },
        }),
        db.taskChecklistItem.updateMany({
          where: { templateItemId: it.id },
          data: { phase, order: it.order },
        }),
      ];
    }),
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
