"use server";

import { db } from "@/lib/db";
import { requireWorkspaceWithMember } from "@/lib/workspace";
import { canView, canEdit } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

export async function getPublishableProjects() {
  const { workspace, member } = await requireWorkspaceWithMember();
  if (!canView(member, "publish")) throw new Error("Permission denied");

  return db.project.findMany({
    where: {
      workspaceId: workspace.id,
      requirePublishing: true,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      thumbnailId: true,
    },
    orderBy: { name: "asc" },
  });
}

export async function getDeliveryTasks(projectId: string) {
  const { workspace, member } = await requireWorkspaceWithMember();
  if (!canView(member, "publish")) throw new Error("Permission denied");

  const project = await db.project.findFirst({
    where: { id: projectId, workspaceId: workspace.id, requirePublishing: true },
  });
  if (!project) throw new Error("Project not found or publishing not required");

  const statuses = await db.taskStatus.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { order: "asc" },
  });
  const completedIds = statuses
    .filter((s) => {
      const n = s.name.toLowerCase();
      return n.includes("review") || n.includes("completed");
    })
    .map((s) => s.id);

  return db.task.findMany({
    where: {
      projectId,
      statusId: { in: completedIds },
      checklistItems: {
        some: {
          phase: "delivery",
          OR: [
            { type: "file_upload", attachmentId: { not: null } },
            { type: "text_area", textValue: { not: null } },
          ],
        },
      },
    },
    include: {
      checklistItems: {
        where: { phase: "delivery" },
        orderBy: { order: "asc" },
        select: {
          id: true,
          name: true,
          type: true,
          attachmentId: true,
          textValue: true,
          allowedFormats: true,
          templateItem: {
            select: {
              template: { select: { name: true, icon: true, color: true } },
            },
          },
        },
      },
      publishItem: true,
    },
    orderBy: { taskNumber: "asc" },
  });
}

export async function getPublishSchedule(projectId: string | null, month: number, year: number) {
  const { workspace, member } = await requireWorkspaceWithMember();
  if (!canView(member, "publish")) throw new Error("Permission denied");

  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0, 23, 59, 59);

  return db.publishItem.findMany({
    where: {
      workspaceId: workspace.id,
      ...(projectId ? { projectId } : {}),
      scheduledDate: { gte: startDate, lte: endDate },
    },
    include: {
      project: { select: { id: true, name: true } },
      task: {
        select: {
          id: true,
          title: true,
          taskNumber: true,
          checklistItems: {
            where: { phase: "delivery" },
            orderBy: { order: "asc" },
            select: {
              id: true,
              name: true,
              type: true,
              attachmentId: true,
              textValue: true,
              allowedFormats: true,
              templateItem: {
                select: {
                  template: { select: { name: true, icon: true, color: true } },
                },
              },
            },
          },
        },
      },
      scheduler: { select: { id: true, name: true, email: true } },
    },
    orderBy: { scheduledDate: "asc" },
  });
}

export async function scheduleTask(data: {
  taskId: string;
  projectId: string;
  scheduledDate: string;
  notes?: string;
}) {
  const { workspace, member } = await requireWorkspaceWithMember();
  if (!canEdit(member, "publish")) throw new Error("Permission denied");

  await db.publishItem.upsert({
    where: { taskId: data.taskId },
    create: {
      workspaceId: workspace.id,
      projectId: data.projectId,
      taskId: data.taskId,
      scheduledDate: new Date(data.scheduledDate),
      scheduledBy: member.id,
      notes: data.notes,
    },
    update: {
      scheduledDate: new Date(data.scheduledDate),
      notes: data.notes,
    },
  });

  revalidatePath("/publish");
}

export async function unscheduleTask(publishItemId: string) {
  const { workspace, member } = await requireWorkspaceWithMember();
  if (!canEdit(member, "publish")) throw new Error("Permission denied");

  await db.publishItem.delete({
    where: { id: publishItemId, workspaceId: workspace.id },
  });

  revalidatePath("/publish");
}

export async function markPublished(publishItemId: string) {
  const { workspace, member } = await requireWorkspaceWithMember();
  if (!canEdit(member, "publish")) throw new Error("Permission denied");

  await db.publishItem.update({
    where: { id: publishItemId, workspaceId: workspace.id },
    data: { published: true, publishedAt: new Date() },
  });

  revalidatePath("/publish");
}

export async function markUnpublished(publishItemId: string) {
  const { workspace, member } = await requireWorkspaceWithMember();
  if (!canEdit(member, "publish")) throw new Error("Permission denied");

  await db.publishItem.update({
    where: { id: publishItemId, workspaceId: workspace.id },
    data: { published: false, publishedAt: null },
  });

  revalidatePath("/publish");
}

export async function getAllScheduledItems(projectId: string | null) {
  const { workspace, member } = await requireWorkspaceWithMember();
  if (!canView(member, "publish")) throw new Error("Permission denied");

  return db.publishItem.findMany({
    where: {
      workspaceId: workspace.id,
      ...(projectId ? { projectId } : {}),
    },
    include: {
      project: { select: { id: true, name: true } },
      task: {
        select: {
          id: true,
          title: true,
          taskNumber: true,
          checklistItems: {
            where: { phase: "delivery" },
            orderBy: { order: "asc" },
            select: {
              id: true,
              name: true,
              type: true,
              attachmentId: true,
              textValue: true,
              allowedFormats: true,
              templateItem: {
                select: {
                  template: { select: { name: true, icon: true, color: true } },
                },
              },
            },
          },
        },
      },
      scheduler: { select: { id: true, name: true, email: true } },
    },
    orderBy: { scheduledDate: "asc" },
  });
}

export async function getPublishPageData(projectId: string | null, month: number, year: number) {
  const { workspace, member } = await requireWorkspaceWithMember();
  if (!canView(member, "publish")) throw new Error("Permission denied");

  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0, 23, 59, 59);

  const scheduleInclude = {
    project: { select: { id: true, name: true } },
    task: {
      select: {
        id: true,
        title: true,
        taskNumber: true,
        checklistItems: {
          where: { phase: "delivery" as const },
          orderBy: { order: "asc" as const },
          select: {
            id: true,
            name: true,
            type: true,
            attachmentId: true,
            textValue: true,
            allowedFormats: true,
            templateItem: {
              select: {
                template: { select: { name: true, icon: true, color: true } },
              },
            },
          },
        },
      },
    },
    scheduler: { select: { id: true, name: true, email: true } },
  } as const;

  const [schedule, allItems] = await Promise.all([
    db.publishItem.findMany({
      where: {
        workspaceId: workspace.id,
        ...(projectId ? { projectId } : {}),
        scheduledDate: { gte: startDate, lte: endDate },
      },
      include: scheduleInclude,
      orderBy: { scheduledDate: "asc" },
    }),
    db.publishItem.findMany({
      where: {
        workspaceId: workspace.id,
        ...(projectId ? { projectId } : {}),
      },
      include: scheduleInclude,
      orderBy: { scheduledDate: "asc" },
    }),
  ]);

  return { schedule, allItems };
}

export async function rescheduleTask(publishItemId: string, newDate: string) {
  const { workspace, member } = await requireWorkspaceWithMember();
  if (!canEdit(member, "publish")) throw new Error("Permission denied");

  await db.publishItem.update({
    where: { id: publishItemId, workspaceId: workspace.id },
    data: { scheduledDate: new Date(newDate) },
  });

  revalidatePath("/publish");
}
