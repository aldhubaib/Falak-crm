"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { requireWorkspace, requireWorkspaceWithMember } from "@/lib/workspace";
import { canEdit } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { revalidatePath } from "next/cache";
import { safeAction, type ActionResult } from "@/lib/action";
import { deleteObject } from "@/lib/storage";

export async function getProjects() {
  const workspace = await requireWorkspace();
  return db.project.findMany({
    where: { workspaceId: workspace.id, deletedAt: null },
    select: {
      id: true,
      name: true,
      description: true,
      thumbnailId: true,
      createdAt: true,
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
        include: {
          status: true,
          service: true,
          assignee: true,
          checklistItems: {
            orderBy: { order: "asc" },
            select: {
              id: true, name: true, type: true, role: true, completed: true,
              attachmentId: true, order: true,
              templateItem: {
                select: { template: { select: { id: true, name: true, icon: true, color: true } } },
              },
            },
          },
        },
        orderBy: { order: "asc" },
      },
      invoices: {
        select: { id: true, number: true, status: true, total: true, currency: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
      collaborators: true,
      projectTemplates: {
        include: {
          template: {
            include: { items: { orderBy: { order: "asc" } } },
          },
        },
      },
    },
  });
}

export async function updateProjectStatus(id: string, statusId: string, dealId?: string) {
  const { workspace, member } = await requireWorkspaceWithMember();
  if (!canEdit(member, "projects")) throw new Error("Permission denied");

  await db.project.update({
    where: { id, workspaceId: workspace.id },
    data: { statusId },
  });
  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  if (dealId) revalidatePath(`/deals/${dealId}`);
}

export async function createFullTask(data: {
  projectId: string;
  title: string;
  statusId: string;
  priority: number | null;
  templateIds: string[];
  answers?: Record<string, string>;
}): Promise<ActionResult<{ id: string }>> {
  return safeAction("Create Task", async () => {
    const { member } = await requireWorkspaceWithMember();
    if (!canEdit(member, "projects")) throw new Error("Permission denied");

    const [lastTask, lastNumber] = await Promise.all([
      db.task.findFirst({
        where: { projectId: data.projectId },
        orderBy: { order: "desc" },
      }),
      db.task.findFirst({
        where: { projectId: data.projectId },
        orderBy: { taskNumber: "desc" },
        select: { taskNumber: true },
      }),
    ]);

    const task = await db.task.create({
      data: {
        projectId: data.projectId,
        taskNumber: (lastNumber?.taskNumber ?? 0) + 1,
        title: data.title,
        statusId: data.statusId,
        priority: data.priority,
        assigneeId: member.id,
        order: (lastTask?.order ?? 0) + 1,
      },
    });

    if (data.templateIds.length > 0) {
      const templates = await db.checklistTemplate.findMany({
        where: { id: { in: data.templateIds } },
        include: { items: { orderBy: { order: "asc" } } },
      });

      const allItems = templates.flatMap((t) => t.items);
      if (allItems.length > 0) {
        await db.taskChecklistItem.createMany({
          data: allItems.map((item) => {
            const answer = data.answers?.[item.id] ?? null;
            const hasAnswer = !!answer?.trim();
            return {
              taskId: task.id,
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
              order: item.order,
              textValue: hasAnswer ? answer : null,
              completed: hasAnswer,
              completedAt: hasAnswer ? new Date() : null,
            };
          }),
        });
      }
    }

    revalidatePath(`/projects/${data.projectId}`);
    return { id: task.id };
  });
}

export async function createTask(projectId: string, formData: FormData, dealId?: string) {
  const { member } = await requireWorkspaceWithMember();
  if (!canEdit(member, "projects")) throw new Error("Permission denied");

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

  const task = await db.task.create({
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

  const projectTemplates = await db.projectTemplate.findMany({
    where: { projectId },
    include: { template: { include: { items: { orderBy: { order: "asc" } } } } },
  });

  const allItems = projectTemplates.flatMap((pt) => pt.template.items);
  if (allItems.length > 0) {
    await db.taskChecklistItem.createMany({
      data: allItems.map((item) => ({
        taskId: task.id,
        templateItemId: item.id,
        name: item.name,
        type: item.type,
        role: item.role,
        order: item.order,
      })),
    });
  }

  revalidatePath(`/projects/${projectId}`);
  if (dealId) revalidatePath(`/deals/${dealId}`);
}

export async function updateTaskStatus(taskId: string, statusId: string, projectId: string, dealId?: string) {
  const { member } = await requireWorkspaceWithMember();
  if (!canEdit(member, "projects")) throw new Error("Permission denied");

  const blockers = await getStageGateBlockers(taskId, statusId);
  if (blockers.length > 0) {
    const names = blockers.map((b) => `"${b.itemName}"`).join(", ");
    throw new Error(`Complete these checklist items first: ${names}`);
  }

  const task = await db.task.findUnique({ where: { id: taskId }, include: { status: true } });
  const status = await db.taskStatus.findUnique({ where: { id: statusId } });

  await db.task.update({
    where: { id: taskId },
    data: {
      statusId,
      assigneeId: member.id,
      completedAt: status?.name === "Completed" || status?.name === "Published" ? new Date() : null,
    },
  });

  await logActivity({
    entityType: "task",
    entityId: taskId,
    entityName: task?.title ?? undefined,
    action: "updated",
    changes: { status: { from: task?.status?.name, to: status?.name } },
    metadata: { projectId },
  });

  revalidatePath(`/projects/${projectId}`);
  if (dealId) revalidatePath(`/deals/${dealId}`);
}

export async function deleteTask(taskId: string, projectId: string, dealId?: string) {
  const { member } = await requireWorkspaceWithMember();
  if (!canEdit(member, "projects")) throw new Error("Permission denied");

  const checklistItems = await db.taskChecklistItem.findMany({
    where: { taskId },
    select: { attachmentId: true },
  });

  const attachmentIds = checklistItems
    .map((ci) => ci.attachmentId)
    .filter((id): id is string => !!id);

  if (attachmentIds.length > 0) {
    const attachments = await db.attachment.findMany({
      where: { id: { in: attachmentIds } },
      select: { id: true, r2Key: true },
    });

    await Promise.all(attachments.filter((a) => a.r2Key).map((a) => deleteObject(a.r2Key!)));
    await db.attachment.deleteMany({ where: { id: { in: attachmentIds } } });
  }

  await db.task.delete({ where: { id: taskId } });
  revalidatePath(`/projects/${projectId}`);
  if (dealId) revalidatePath(`/deals/${dealId}`);
}

export async function createProject(formData: FormData): Promise<ActionResult<{ id: string }>> {
  return safeAction("Create Project", async () => {
    const { workspace, member } = await requireWorkspaceWithMember();
    if (!canEdit(member, "projects")) throw new Error("Permission denied");
    const { userId } = await auth();
    const user = await currentUser();

    const name = formData.get("name") as string;
    if (!name?.trim()) throw new Error("Project name is required");

    const description = (formData.get("description") as string) || undefined;
    const type = (formData.get("type") as string) || "fixed";
    const companyId = (formData.get("companyId") as string) || undefined;
    const dealId = (formData.get("dealId") as string) || undefined;
    const templateIds = formData.getAll("templateIds") as string[];

    const firstStatus = await db.projectStatus.findFirst({
      where: { workspaceId: workspace.id },
      orderBy: { order: "asc" },
    });

    const project = await db.project.create({
      data: {
        workspaceId: workspace.id,
        name: name.trim(),
        type,
        description,
        companyId: companyId || null,
        dealId: dealId || null,
        contactId: null,
        ownerId: userId,
        ownerName: user?.fullName || user?.firstName || undefined,
        statusId: firstStatus?.id,
        projectTemplates: templateIds.length
          ? { create: templateIds.map((tid) => ({ templateId: tid })) }
          : undefined,
      },
    });

    await logActivity({
      entityType: "project",
      entityId: project.id,
      entityName: name,
      action: "created",
    });

    revalidatePath("/projects");
    return { id: project.id };
  }, { formFields: Object.fromEntries(formData) });
}

export async function getTask(taskId: string) {
  const workspace = await requireWorkspace();
  const task = await db.task.findFirst({
    where: { id: taskId, project: { workspaceId: workspace.id } },
    include: {
      status: true,
      service: true,
      assignee: true,
      project: { select: { id: true, name: true, dealId: true } },
      checklistItems: {
        orderBy: { order: "asc" },
        include: {
          templateItem: {
            include: { template: { select: { id: true, name: true, icon: true, color: true } } },
          },
        },
      },
    },
  });
  return task;
}

export async function updateTask(taskId: string, data: {
  title?: string;
  description?: string | null;
  assigneeId?: string | null;
  priority?: number | null;
}) {
  const { member } = await requireWorkspaceWithMember();
  if (!canEdit(member, "projects")) throw new Error("Permission denied");

  const task = await db.task.findUnique({ where: { id: taskId }, include: { project: true } });
  if (!task) throw new Error("Task not found");

  await db.task.update({ where: { id: taskId }, data });

  revalidatePath(`/projects/${task.projectId}`);
  revalidatePath(`/projects/${task.projectId}/tasks/${taskId}`);
}

// ─── Checklist Items ──────────────────────────────────────────────────────────

export async function toggleChecklistItem(itemId: string, completed: boolean, projectId: string) {
  const { member } = await requireWorkspaceWithMember();
  if (!canEdit(member, "projects")) throw new Error("Permission denied");

  await db.taskChecklistItem.update({
    where: { id: itemId },
    data: {
      completed,
      completedAt: completed ? new Date() : null,
    },
  });

  revalidatePath(`/projects/${projectId}`);
}

export async function saveChecklistItemText(itemId: string, textValue: string, projectId: string) {
  const { member } = await requireWorkspaceWithMember();
  if (!canEdit(member, "projects")) throw new Error("Permission denied");

  await db.taskChecklistItem.update({
    where: { id: itemId },
    data: {
      textValue,
      completed: !!textValue.trim(),
      completedAt: textValue.trim() ? new Date() : null,
    },
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects`);
}

export async function setChecklistItemAttachment(itemId: string, attachmentId: string, projectId: string) {
  const { member } = await requireWorkspaceWithMember();
  if (!canEdit(member, "projects")) throw new Error("Permission denied");

  await db.taskChecklistItem.update({
    where: { id: itemId },
    data: {
      attachmentId,
      completed: true,
      completedAt: new Date(),
    },
  });

  revalidatePath(`/projects/${projectId}`);
}

export async function removeChecklistItemAttachment(itemId: string, projectId: string) {
  const { member } = await requireWorkspaceWithMember();
  if (!canEdit(member, "projects")) throw new Error("Permission denied");

  await db.taskChecklistItem.update({
    where: { id: itemId },
    data: {
      attachmentId: null,
      completed: false,
      completedAt: null,
    },
  });

  revalidatePath(`/projects/${projectId}`);
}

export async function updateProjectName(projectId: string, name: string) {
  const { workspace, member } = await requireWorkspaceWithMember();
  if (!canEdit(member, "projects")) throw new Error("Permission denied");
  if (!name.trim()) throw new Error("Name is required");

  await db.project.update({
    where: { id: projectId, workspaceId: workspace.id },
    data: { name: name.trim() },
  });

  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/settings`);
}

export async function updateProjectRequirePublishing(projectId: string, requirePublishing: boolean) {
  const { workspace, member } = await requireWorkspaceWithMember();
  if (!canEdit(member, "projects")) throw new Error("Permission denied");

  await db.project.update({
    where: { id: projectId, workspaceId: workspace.id },
    data: { requirePublishing },
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/settings`);
}

export async function updateProjectDescription(projectId: string, description: string) {
  const { workspace, member } = await requireWorkspaceWithMember();
  if (!canEdit(member, "projects")) throw new Error("Permission denied");

  await db.project.update({
    where: { id: projectId, workspaceId: workspace.id },
    data: { description: description.trim() || null },
  });

  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/settings`);
}

export async function updateProjectThumbnail(projectId: string, thumbnailId: string | null) {
  const { workspace, member } = await requireWorkspaceWithMember();
  if (!canEdit(member, "projects")) throw new Error("Permission denied");

  await db.project.update({
    where: { id: projectId, workspaceId: workspace.id },
    data: { thumbnailId },
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/settings`);
}

export async function updateProjectTemplates(projectId: string, templateIds: string[]) {
  const { workspace, member } = await requireWorkspaceWithMember();
  if (!canEdit(member, "projects")) throw new Error("Permission denied");

  await db.projectTemplate.deleteMany({ where: { projectId } });

  if (templateIds.length > 0) {
    await db.projectTemplate.createMany({
      data: templateIds.map((tid) => ({ projectId, templateId: tid })),
    });
  }

  revalidatePath(`/projects/${projectId}`);
}

export async function syncTaskTemplates(taskId: string, templateIds: string[], projectId: string) {
  const { member } = await requireWorkspaceWithMember();
  if (!canEdit(member, "projects")) throw new Error("Permission denied");

  const currentItems = await db.taskChecklistItem.findMany({
    where: { taskId },
    select: { id: true, templateItemId: true, attachmentId: true },
  });

  const templates = await db.checklistTemplate.findMany({
    where: { id: { in: templateIds } },
    include: { items: { orderBy: { order: "asc" } } },
  });

  const wantedTemplateItemIds = new Set(
    templates.flatMap((t) => t.items.map((i) => i.id))
  );

  const toRemove = currentItems.filter(
    (ci) => ci.templateItemId && !wantedTemplateItemIds.has(ci.templateItemId)
  );

  if (toRemove.length > 0) {
    const attachmentIds = toRemove
      .map((ci) => ci.attachmentId)
      .filter((id): id is string => !!id);
    if (attachmentIds.length > 0) {
      const attachments = await db.attachment.findMany({
        where: { id: { in: attachmentIds } },
        select: { id: true, r2Key: true },
      });
      await Promise.all(attachments.filter((a) => a.r2Key).map((a) => deleteObject(a.r2Key!)));
      await db.attachment.deleteMany({ where: { id: { in: attachmentIds } } });
    }
    await db.taskChecklistItem.deleteMany({
      where: { id: { in: toRemove.map((ci) => ci.id) } },
    });
  }

  const existingTemplateItemIds = new Set(
    currentItems.filter((ci) => ci.templateItemId).map((ci) => ci.templateItemId)
  );

  const lastItem = await db.taskChecklistItem.findFirst({
    where: { taskId },
    orderBy: { order: "desc" },
  });
  let nextOrder = (lastItem?.order ?? 0) + 1;

  const toAdd = templates.flatMap((t) =>
    t.items.filter((i) => !existingTemplateItemIds.has(i.id))
  );

  if (toAdd.length > 0) {
    await db.taskChecklistItem.createMany({
      data: toAdd.map((item) => ({
        taskId,
        templateItemId: item.id,
        name: item.name,
        type: item.type,
        role: item.role,
        options: item.options,
        allowedFileTypes: item.allowedFileTypes,
        mandatory: item.mandatory,
        phase: item.phase,
        visibleFromStageId: item.visibleFromStageId,
        requiredBeforeStageId: item.requiredBeforeStageId,
        order: nextOrder++,
      })),
    });
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/tasks/${taskId}`);
}

export async function getStageGateBlockers(taskId: string, targetStatusId: string) {
  const task = await db.task.findUnique({
    where: { id: taskId },
    include: {
      checklistItems: {
        include: { templateItem: { include: { requiredBeforeStage: true } } },
      },
      project: {
        include: {
          projectTemplates: {
            include: {
              template: {
                include: { items: { include: { requiredBeforeStage: true } } },
              },
            },
          },
        },
      },
    },
  });

  if (!task) return [];

  const targetStatus = await db.taskStatus.findUnique({ where: { id: targetStatusId } });
  if (!targetStatus) return [];

  const blockers: { itemName: string; role: string }[] = [];

  for (const ci of task.checklistItems) {
    if (ci.completed) continue;

    const gateStageId = ci.templateItem?.requiredBeforeStageId;
    if (!gateStageId) continue;

    const gateStage = ci.templateItem?.requiredBeforeStage;
    if (!gateStage) continue;

    if (gateStage.order <= targetStatus.order) {
      blockers.push({ itemName: ci.name, role: ci.role });
    }
  }

  return blockers;
}
