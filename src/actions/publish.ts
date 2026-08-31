"use server";

import { db } from "@/lib/db";
import { requireWorkspaceWithMember, getAccessibleProjectScope, getProjectAccess } from "@/lib/workspace";
import { canEdit } from "@/lib/permissions";
import { TERMINAL_STATUS_NAMES, isTerminalStatusName } from "@/lib/task-status";
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

  // Only finished columns count as publishable. This used to match status names
  // by substring, which quietly included every mid-pipeline review stage
  // ("Raw Footage Review", "Review"), so work still in production showed up as
  // ready to publish.
  const statuses = await db.taskStatus.findMany({
    where: {
      workspaceId: scope.workspace.id,
      name: { in: [...TERMINAL_STATUS_NAMES] },
    },
    select: { id: true },
  });
  const completedIds = statuses.map((s) => s.id);

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
      OR: [
        {
          // Finished and ready to schedule. The task-level `publish` flag comes
          // from the task type; project-level requirePublishing is checked above.
          publish: true,
          statusId: { in: completedIds },
          checklistItems: {
            some: {
              phase: "delivery",
              hidden: false,
              OR: [
                { type: "file_upload", attachmentId: { not: null } },
                { type: "text_area", textValue: { not: null } },
              ],
            },
          },
        },
        // Already went out. It stays on the calendar as a record of what was
        // published even if the task was later pulled back for rework, which
        // would otherwise erase it from the only place that history is visible.
        { publishItem: { published: true } },
      ],
    },
    include: {
      project: { select: { id: true, name: true, thumbnailId: true } },
      checklistItems: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          name: true,
          type: true,
          phase: true,
          attachmentId: true,
          textValue: true,
          allowedFormats: true,
          publishCard: true,
          hidden: true,
          order: true,
          // Live template config — card labels/placement follow Settings →
          // Task Types; the per-task copy is only a fallback.
          templateItem: {
            select: {
              name: true,
              type: true,
              phase: true,
              allowedFormats: true,
              publishCard: true,
              hidden: true,
              order: true,
              template: { select: { name: true, icon: true, color: true } },
            },
          },
        },
      },
      publishItem: true,
    },
    // Newest 200 deliverables; the queue was unbounded and grew with every
    // completed task ever made. Fetch newest-first, then restore the
    // presentation order.
    orderBy: { taskNumber: "desc" },
    take: 200,
  }).then((tasks) => tasks.reverse());
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
            where: { phase: "delivery", hidden: false },
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

  // Re-check the column server-side. The queue only offers finished tasks, but
  // a tab left open while someone rolled the task back would otherwise still
  // be able to book it a slot.
  const task = await db.task.findFirst({
    where: { id: data.taskId, projectId: data.projectId, deletedAt: null },
    select: { status: { select: { name: true } } },
  });
  if (!task) throw new Error("Task not found");
  if (!isTerminalStatusName(task.status?.name)) {
    throw new Error(
      `Only completed tasks can be scheduled — this one is in ${task.status?.name ?? "no column"}.`,
    );
  }

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
            where: { phase: "delivery", hidden: false },
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
          where: { phase: "delivery" as const, hidden: false },
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
