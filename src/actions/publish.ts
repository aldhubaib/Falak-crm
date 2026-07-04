"use server";

import { db } from "@/lib/db";
import { requireWorkspaceWithMember, getAccessibleProjectScope, getProjectAccess } from "@/lib/workspace";
import { canEdit } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

// Publish mutations need module-level edit rights on top of project access —
// "view" members can browse the calendar but not change the schedule.
async function requirePublishEdit() {
  const { member } = await requireWorkspaceWithMember();
  if (!canEdit(member, "publish")) throw new Error("Permission denied");
}

export async function getPublishableProjects() {
  const scope = await getAccessibleProjectScope();

  return db.project.findMany({
    where: {
      workspaceId: scope.workspace.id,
      requirePublishing: true,
      deletedAt: null,
      ...(scope.all ? {} : { id: { in: scope.projectIds } }),
    },
    select: {
      id: true,
      name: true,
      thumbnailId: true,
    },
    orderBy: { name: "asc" },
  });
}

export async function getDeliveryTasks(projectId: string | null) {
  const scope = await getAccessibleProjectScope();

  if (projectId) {
    const project = await db.project.findFirst({
      where: {
        id: projectId,
        workspaceId: scope.workspace.id,
        requirePublishing: true,
        ...(scope.all ? {} : { id: { in: scope.projectIds } }),
      },
    });
    if (!project) throw new Error("Project not found or publishing not required");
  }

  const statuses = await db.taskStatus.findMany({
    where: { workspaceId: scope.workspace.id },
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
      ...(projectId
        ? { projectId }
        : {
            project: {
              workspaceId: scope.workspace.id,
              requirePublishing: true,
              ...(scope.all ? {} : { id: { in: scope.projectIds } }),
            },
          }),
      deletedAt: null,
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
      project: { select: { id: true, name: true, thumbnailId: true } },
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
  const scope = await getAccessibleProjectScope();

  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0, 23, 59, 59);

  return db.publishItem.findMany({
    where: {
      workspaceId: scope.workspace.id,
      ...(projectId ? { projectId } : {}),
      ...(scope.all ? {} : { projectId: { in: scope.projectIds } }),
      scheduledDate: { gte: startDate, lte: endDate },
    },
    include: {
      project: { select: { id: true, name: true, thumbnailId: true } },
      task: {
        select: {
          id: true,
          title: true,
          taskNumber: true,
          completedAt: true,
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
  await requirePublishEdit();
  const access = await getProjectAccess(data.projectId);
  if (!access.hasAccess) throw new Error("Permission denied");

  await db.publishItem.upsert({
    where: { taskId: data.taskId },
    create: {
      workspaceId: access.workspace.id,
      projectId: data.projectId,
      taskId: data.taskId,
      scheduledDate: new Date(data.scheduledDate),
      scheduledBy: access.member.id,
      notes: data.notes,
    },
    update: {
      scheduledDate: new Date(data.scheduledDate),
      notes: data.notes,
    },
  });

  revalidatePath("/publish");
}

async function requirePublishItemAccess(publishItemId: string) {
  await requirePublishEdit();
  const { workspace } = await requireWorkspaceWithMember();
  const item = await db.publishItem.findFirst({
    where: { id: publishItemId, workspaceId: workspace.id },
    select: { projectId: true },
  });
  if (!item) throw new Error("Not found");
  const access = await getProjectAccess(item.projectId);
  if (!access.hasAccess) throw new Error("Permission denied");
  return { workspace };
}

export async function unscheduleTask(publishItemId: string) {
  const { workspace } = await requirePublishItemAccess(publishItemId);

  await db.publishItem.delete({
    where: { id: publishItemId, workspaceId: workspace.id },
  });

  revalidatePath("/publish");
}

export async function markPublished(publishItemId: string) {
  const { workspace } = await requirePublishItemAccess(publishItemId);

  await db.publishItem.update({
    where: { id: publishItemId, workspaceId: workspace.id },
    data: { published: true, publishedAt: new Date() },
  });

  revalidatePath("/publish");
}

export async function markUnpublished(publishItemId: string) {
  const { workspace } = await requirePublishItemAccess(publishItemId);

  await db.publishItem.update({
    where: { id: publishItemId, workspaceId: workspace.id },
    data: { published: false, publishedAt: null },
  });

  revalidatePath("/publish");
}

export async function getAllScheduledItems(projectId: string | null) {
  const scope = await getAccessibleProjectScope();

  return db.publishItem.findMany({
    where: {
      workspaceId: scope.workspace.id,
      ...(projectId ? { projectId } : {}),
      ...(scope.all ? {} : { projectId: { in: scope.projectIds } }),
    },
    include: {
      project: { select: { id: true, name: true, thumbnailId: true } },
      task: {
        select: {
          id: true,
          title: true,
          taskNumber: true,
          completedAt: true,
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
  const scope = await getAccessibleProjectScope();

  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0, 23, 59, 59);

  const scheduleInclude = {
    project: { select: { id: true, name: true, thumbnailId: true } },
    task: {
      select: {
        id: true,
        title: true,
        taskNumber: true,
        completedAt: true,
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

  const scopeFilter = scope.all ? {} : { projectId: { in: scope.projectIds } };

  const [schedule, allItems] = await Promise.all([
    db.publishItem.findMany({
      where: {
        workspaceId: scope.workspace.id,
        ...(projectId ? { projectId } : {}),
        ...scopeFilter,
        scheduledDate: { gte: startDate, lte: endDate },
      },
      include: scheduleInclude,
      orderBy: { scheduledDate: "asc" },
    }),
    db.publishItem.findMany({
      where: {
        workspaceId: scope.workspace.id,
        ...(projectId ? { projectId } : {}),
        ...scopeFilter,
      },
      include: scheduleInclude,
      orderBy: { scheduledDate: "asc" },
    }),
  ]);

  return { schedule, allItems };
}

export async function rescheduleTask(publishItemId: string, newDate: string) {
  const { workspace } = await requirePublishItemAccess(publishItemId);

  await db.publishItem.update({
    where: { id: publishItemId, workspaceId: workspace.id },
    data: { scheduledDate: new Date(newDate) },
  });

  revalidatePath("/publish");
}
