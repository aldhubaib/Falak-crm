"use server";

import { auth, currentUser, clerkClient } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { requireWorkspace, requireWorkspaceWithMember, requireProjectAssign, requireProjectSettings, requireProjectWork, getProjectAccess } from "@/lib/workspace";
import { canEdit, canDeleteTaskAt } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { revalidatePath } from "next/cache";
import { safeAction, type ActionResult } from "@/lib/action";
import { deleteObject, uploadBytes, generateR2Key } from "@/lib/storage";
import { sendNotification } from "@/lib/push";
import { publishTaskEvent } from "@/lib/realtime";
import { invalidateCache, claimThrottle } from "@/lib/cache";

export async function getProjects() {
  const { workspace, member } = await requireWorkspaceWithMember();
  const isOwner = member.type === "OWNER";
  return db.project.findMany({
    where: {
      workspaceId: workspace.id,
      deletedAt: null,
      ...(isOwner
        ? {}
        : {
            OR: [
              { ownerId: member.userId },
              { members: { some: { memberId: member.id } } },
            ],
          }),
    },
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

// Lightweight project metadata for pages that don't render the task graph
// (assets, settings, headers). Never include tasks/checklists here — that's
// what made the old monolithic getProject slow on every navigation.
export async function getProjectMeta(id: string) {
  const workspace = await requireWorkspace();
  return db.project.findFirst({
    where: { id, workspaceId: workspace.id },
    select: {
      id: true,
      name: true,
      description: true,
      thumbnailId: true,
      statusId: true,
      requirePublishing: true,
      workspaceId: true,
      dealId: true,
      companyId: true,
      projectTemplates: { select: { templateId: true } },
    },
  });
}

// New-task page: project name plus attached checklist templates with items.
export async function getProjectTaskTemplates(id: string) {
  const workspace = await requireWorkspace();
  return db.project.findFirst({
    where: { id, workspaceId: workspace.id },
    select: {
      id: true,
      name: true,
      projectTemplates: {
        select: {
          template: {
            select: {
              id: true,
              name: true,
              items: { orderBy: { order: "asc" } },
            },
          },
        },
      },
    },
  });
}

// Dashboard page: only the per-task fields needed to compute KPIs and team
// performance — no checklist items, invoices, or template graphs.
export async function getProjectDashboard(id: string) {
  const workspace = await requireWorkspace();
  return db.project.findFirst({
    where: { id, workspaceId: workspace.id },
    select: {
      id: true,
      name: true,
      workspaceId: true,
      tasks: {
        where: { deletedAt: null },
        select: {
          id: true,
          statusId: true,
          assigneeId: true,
          stageTimings: true,
          assignmentHistory: true,
          stageEnteredAt: true,
          rejectionCount: true,
          completedAt: true,
          status: { select: { id: true, name: true } },
          assignee: { select: { id: true, name: true } },
        },
        orderBy: { order: "asc" },
      },
    },
  });
}

// ─── Project Team ──────────────────────────────────────────────────────────────

export async function getProjectTeam(projectId: string) {
  const access = await getProjectAccess(projectId);
  if (!access.hasAccess) throw new Error("Permission denied");
  const workspace = access.workspace;

  const [members, allMembers, roles] = await Promise.all([
    db.projectMember.findMany({
      where: { projectId, project: { workspaceId: workspace.id } },
      select: {
        id: true,
        memberId: true,
        roleId: true,
        addedAt: true,
        member: { select: { id: true, userId: true, name: true, email: true, imageUrl: true, type: true } },
        role: { select: { id: true, name: true } },
      },
      orderBy: { addedAt: "asc" },
    }),
    db.workspaceMember.findMany({
      where: { workspaceId: workspace.id },
      select: { id: true, userId: true, name: true, email: true, imageUrl: true, type: true },
      orderBy: [{ name: "asc" }, { email: "asc" }],
    }),
    db.role.findMany({
      where: { workspaceId: workspace.id },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  // Backfill missing Google/Clerk photos for members who haven't loaded the
  // dashboard since we started caching avatars. One bulk Clerk lookup,
  // best-effort, throttled to once per hour per workspace so page loads don't
  // repeatedly hit the Clerk API for members who simply have no photo.
  const missing = allMembers.filter(
    (m) => !m.imageUrl && !m.userId.startsWith("pending_"),
  );
  if (missing.length > 0 && (await claimThrottle(`clerk-backfill:${workspace.id}`, 3600))) {
    try {
      const client = await clerkClient();
      const { data } = await client.users.getUserList({
        userId: missing.map((m) => m.userId),
        limit: missing.length,
      });
      const imageByUserId = new Map(data.map((u) => [u.id, u.imageUrl]));
      const updates: { memberId: string; imageUrl: string }[] = [];
      for (const m of missing) {
        const url = imageByUserId.get(m.userId);
        if (url) {
          m.imageUrl = url;
          updates.push({ memberId: m.id, imageUrl: url });
          const pm = members.find((x) => x.member.id === m.id);
          if (pm) pm.member.imageUrl = url;
        }
      }
      await Promise.all(
        updates.map((u) =>
          db.workspaceMember.update({
            where: { id: u.memberId },
            data: { imageUrl: u.imageUrl },
          }),
        ),
      );
    } catch {
      // ignore — avatars gracefully fall back to initials
    }
  }

  return { members, allMembers, roles };
}

export async function addProjectMember(projectId: string, memberId: string, roleId?: string | null) {
  const { workspace } = await requireProjectAssign(projectId);

  // Ensure member (and role, if any) belong to this workspace.
  const [target, role] = await Promise.all([
    db.workspaceMember.findFirst({ where: { id: memberId, workspaceId: workspace.id }, select: { id: true } }),
    roleId ? db.role.findFirst({ where: { id: roleId, workspaceId: workspace.id }, select: { id: true } }) : Promise.resolve(null),
  ]);
  if (!target) throw new Error("Not found");
  const resolvedRoleId = roleId && role ? roleId : null;

  await db.projectMember.upsert({
    where: { projectId_memberId: { projectId, memberId } },
    create: { projectId, memberId, roleId: resolvedRoleId },
    update: { roleId: resolvedRoleId },
  });

  await invalidateCache(`perms:${memberId}`);
  revalidatePath(`/projects/${projectId}`);
}

export async function setProjectMemberRole(projectId: string, memberId: string, roleId: string | null) {
  const { workspace } = await requireProjectAssign(projectId);

  if (roleId) {
    const role = await db.role.findFirst({ where: { id: roleId, workspaceId: workspace.id }, select: { id: true } });
    if (!role) throw new Error("Role not found");
  }

  await db.projectMember.updateMany({
    where: { projectId, memberId },
    data: { roleId },
  });

  await invalidateCache(`perms:${memberId}`);
  revalidatePath(`/projects/${projectId}`);
}

export async function removeProjectMember(projectId: string, memberId: string) {
  await requireProjectAssign(projectId);

  await db.projectMember.deleteMany({ where: { projectId, memberId } });

  await invalidateCache(`perms:${memberId}`);
  revalidatePath(`/projects/${projectId}`);
}

export async function updateProjectStatus(id: string, statusId: string, dealId?: string) {
  const { workspace } = await requireProjectSettings(id);

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
}): Promise<
  ActionResult<{
    id: string;
    items: { id: string; templateItemId: string | null }[];
  }>
> {
  return safeAction("Create Task", async () => {
    const { member } = await requireProjectWork(data.projectId);

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

    const initialStatus = await db.taskStatus.findUnique({
      where: { id: data.statusId },
      select: { name: true },
    });

    const task = await db.task.create({
      data: {
        projectId: data.projectId,
        taskNumber: (lastNumber?.taskNumber ?? 0) + 1,
        title: data.title,
        statusId: data.statusId,
        priority: data.priority,
        assigneeId: member.id,
        order: (lastTask?.order ?? 0) + 1,
        stageEnteredAt: new Date(),
        statusChanges: {
          create: {
            memberId: member.id,
            action: "created",
            toStatusId: data.statusId,
            toStatusName: initialStatus?.name ?? null,
          },
        },
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
              lockedFromStageId: item.lockedFromStageId,
              neverLock: item.neverLock,
              order: item.order,
              textValue: hasAnswer ? answer : null,
              completed: hasAnswer,
              completedAt: hasAnswer ? new Date() : null,
            };
          }),
        });
      }
    }

    const createdItems = await db.taskChecklistItem.findMany({
      where: { taskId: task.id },
      select: { id: true, templateItemId: true },
    });

    revalidatePath(`/projects/${data.projectId}`);
    publishTaskEvent(data.projectId, { type: "task.created", taskId: task.id });
    return { id: task.id, items: createdItems };
  });
}

export async function createTask(projectId: string, formData: FormData, dealId?: string) {
  await requireProjectWork(projectId);

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

  publishTaskEvent(projectId, { type: "task.created", taskId: task.id });

  revalidatePath(`/projects/${projectId}`);
  if (dealId) revalidatePath(`/deals/${dealId}`);
}

export async function updateTaskStatus(
  taskId: string,
  statusId: string,
  projectId: string,
  dealId?: string,
  actorClientId?: string | null,
) {
  const { workspace, member } = await requireProjectWork(projectId);

  // Independent reads run concurrently to shave latency off the drag response.
  const [blockers, task, targetStatus, allStatuses] = await Promise.all([
    getStageGateBlockers(taskId, statusId),
    db.task.findUnique({
      where: { id: taskId },
      include: {
        status: true,
        checklistItems: { select: { name: true, phase: true, mandatory: true, completed: true } },
      },
    }),
    db.taskStatus.findUnique({ where: { id: statusId } }),
    db.taskStatus.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { order: "asc" },
    }),
  ]);

  if (blockers.length > 0) {
    const names = blockers.map((b) => `"${b.itemName}"`).join(", ");
    throw new Error(`Complete these checklist items first: ${names}`);
  }

  const fromOrder = task?.status ? allStatuses.find((s) => s.id === task.status!.id)?.order ?? 0 : 0;
  const toOrder = allStatuses.find((s) => s.id === statusId)?.order ?? 0;
  const isForward = toOrder > fromOrder;

  // Block submission for Internal Review if mandatory delivery items are still
  // incomplete. Delivery items only need to be done at this gate — earlier
  // forward moves (e.g. Todo → In Progress) must not be blocked.
  if (task && isForward && targetStatus?.name?.toLowerCase() === "internal review") {
    const incomplete = task.checklistItems.filter(
      (ci) => ci.phase === "delivery" && ci.mandatory && !ci.completed,
    );
    if (incomplete.length > 0) {
      const names = incomplete.map((i) => `"${i.name}"`).join(", ");
      throw new Error(`Complete delivery items first: ${names}`);
    }
  }

  const history: Record<string, string> = (task?.assignmentHistory as Record<string, string>) ?? {};

  let newAssigneeId: string = member.id;

  if (isForward) {
    if (task?.statusId && task.assigneeId) {
      history[task.statusId] = task.assigneeId;
    }

    const projectMembers = await db.projectMember.findMany({
      where: { projectId },
      include: { role: true },
      orderBy: { addedAt: "asc" },
    });

    const autoAssignMember = projectMembers.find((pm) => {
      const perms = (pm.role?.permissions as Record<string, unknown>) ?? {};
      const tp = (perms.taskPermissions as { stages: Record<string, { autoAssign?: boolean }> }) ?? { stages: {} };
      return tp.stages?.[statusId]?.autoAssign === true;
    });

    if (autoAssignMember) {
      newAssigneeId = autoAssignMember.memberId;
    }
  } else {
    const previousAssignee = history[statusId];
    if (previousAssignee) {
      newAssigneeId = previousAssignee;
    }
  }

  const timings: Record<string, number> = (task?.stageTimings as Record<string, number>) ?? {};
  const now = new Date();
  if (task?.statusId && task.stageEnteredAt) {
    const elapsed = now.getTime() - new Date(task.stageEnteredAt).getTime();
    timings[task.statusId] = (timings[task.statusId] ?? 0) + elapsed;
  }

  const durationMs =
    task?.statusId && task.stageEnteredAt
      ? now.getTime() - new Date(task.stageEnteredAt).getTime()
      : null;

  await db.$transaction([
    db.task.update({
      where: { id: taskId },
      data: {
        statusId,
        assigneeId: newAssigneeId,
        assignmentHistory: history,
        stageTimings: timings,
        stageEnteredAt: now,
        rejectionCount: !isForward ? { increment: 1 } : undefined,
        completedAt: targetStatus?.name === "Completed" || targetStatus?.name === "Published" ? now : null,
      },
    }),
    db.taskStatusChange.create({
      data: {
        taskId,
        memberId: member.id,
        action: "status_change",
        fromStatusId: task?.statusId ?? null,
        fromStatusName: task?.status?.name ?? null,
        toStatusId: statusId,
        toStatusName: targetStatus?.name ?? null,
        durationMs: durationMs != null ? Math.max(0, Math.round(durationMs)) : null,
      },
    }),
  ]);

  // Broadcast to other connected board clients immediately after the commit.
  publishTaskEvent(projectId, { type: "task.moved", taskId, actorClientId: actorClientId ?? null });

  // Activity log is non-critical to the move response — fire and forget.
  void logActivity({
    entityType: "task",
    entityId: taskId,
    entityName: task?.title ?? undefined,
    action: "updated",
    changes: { status: { from: task?.status?.name, to: targetStatus?.name } },
    metadata: { projectId },
  }).catch(() => {});

  if (newAssigneeId !== member.id) {
    // Rejections are notified once via the decline comment (sendMessage with
    // kind "rejection" @mentions the person who moved the task forward), so we
    // only fire an assignment notification on forward auto-assignment here.
    if (isForward) {
      sendNotification({
        recipientId: newAssigneeId,
        type: "assignment",
        title: `You've been assigned "${task?.title}"`,
        body: `Task moved to ${targetStatus?.name}`,
        url: `/projects/${projectId}/tasks/${taskId}`,
        tag: `assign-${taskId}`,
      }).catch(() => {});
    }
  }

  revalidatePath(`/projects/${projectId}`);
  if (dealId) revalidatePath(`/deals/${dealId}`);

  // Return the resolved assignee so the board can patch its cache immediately
  // (self-assign on forward moves, previous owner on rollbacks, auto-assign).
  const newAssignee = await db.workspaceMember.findUnique({
    where: { id: newAssigneeId },
    select: { id: true, name: true, email: true, imageUrl: true },
  });

  return {
    taskId,
    statusId,
    assignee: newAssignee
      ? {
          id: newAssignee.id,
          name: newAssignee.name ?? newAssignee.email,
          imageUrl: newAssignee.imageUrl ?? null,
        }
      : null,
  };
}

export async function assignTaskToMe(taskId: string, projectId: string) {
  const { member } = await requireProjectWork(projectId);

  const task = await db.task.findUnique({ where: { id: taskId } });
  if (!task) throw new Error("Task not found");

  const history: Record<string, string> = (task.assignmentHistory as Record<string, string>) ?? {};
  if (task.statusId) {
    history[task.statusId] = member.id;
  }

  await db.task.update({
    where: { id: taskId },
    data: { assigneeId: member.id, assignmentHistory: history },
  });

  revalidatePath(`/projects/${projectId}`);
}

export async function deleteTask(taskId: string, projectId: string, dealId?: string) {
  const access = await requireProjectWork(projectId);

  const task = await db.task.findFirst({
    where: { id: taskId, projectId },
    select: { statusId: true },
  });
  if (!task) throw new Error("Task not found");
  // Full project rights delete anywhere; otherwise the role's stage-level
  // "Delete" flag must be on for the task's current stage.
  if (!canDeleteTaskAt(access.permissions, task.statusId)) {
    throw new Error("You don't have permission to delete this task");
  }

  await db.task.update({
    where: { id: taskId },
    data: { deletedAt: new Date(), deletedBy: access.member.id },
  });

  publishTaskEvent(projectId, { type: "task.deleted", taskId });

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

// Trashed tasks are still returned so the task page can render them read-only
// with a trash banner (Settings → Trash preview); callers that must exclude
// them check task.deletedAt.
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
  estimateMin?: number | null;
}) {
  await requireWorkspaceWithMember();

  const task = await db.task.findUnique({ where: { id: taskId }, include: { project: true } });
  if (!task) throw new Error("Task not found");

  await requireProjectWork(task.projectId);

  await db.task.update({ where: { id: taskId }, data });

  revalidatePath(`/projects/${task.projectId}`);
  revalidatePath(`/projects/${task.projectId}/tasks/${taskId}`);
}

// ─── Checklist Items ──────────────────────────────────────────────────────────

export async function toggleChecklistItem(itemId: string, completed: boolean, projectId: string) {
  await requireProjectWork(projectId);

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
  await requireProjectWork(projectId);

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
  await requireProjectWork(projectId);

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
  await requireProjectWork(projectId);

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
  const { workspace } = await requireProjectSettings(projectId);
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
  const { workspace } = await requireProjectSettings(projectId);

  await db.project.update({
    where: { id: projectId, workspaceId: workspace.id },
    data: { requirePublishing },
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/settings`);
}

export async function updateProjectDescription(projectId: string, description: string) {
  const { workspace } = await requireProjectSettings(projectId);

  await db.project.update({
    where: { id: projectId, workspaceId: workspace.id },
    data: { description: description.trim() || null },
  });

  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/settings`);
}

export async function updateProjectThumbnail(projectId: string, thumbnailId: string | null) {
  const { workspace } = await requireProjectSettings(projectId);

  await db.project.update({
    where: { id: projectId, workspaceId: workspace.id },
    data: { thumbnailId },
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/settings`);
}

// Upload a project photo directly (small image) and set it as the project
// thumbnail. Stores the file as an Attachment so it's served through the
// existing /api/files/[id]/download-url endpoint like other thumbnails.
export async function uploadProjectThumbnail(formData: FormData): Promise<void> {
  const projectId = String(formData.get("projectId") ?? "");
  if (!projectId) throw new Error("Missing project");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("No file provided");
  }
  if (!(file.type || "").startsWith("image/")) {
    throw new Error("Only image files are allowed");
  }
  const MAX_BYTES = 10 * 1024 * 1024;
  if (file.size > MAX_BYTES) {
    throw new Error("Image must be 10MB or smaller");
  }

  const { workspace } = await requireProjectSettings(projectId);

  const key = generateR2Key("project_thumbnail", file.name || "photo.jpg");
  const bytes = Buffer.from(await file.arrayBuffer());
  await uploadBytes(bytes, key, file.type || "application/octet-stream");

  const attachment = await db.attachment.create({
    data: {
      workspaceId: workspace.id,
      entityType: "project_thumbnail",
      entityId: projectId,
      name: file.name || "photo.jpg",
      sizeBytes: file.size,
      contentType: file.type || null,
      r2Key: key,
      status: "uploaded",
    },
  });

  const prev = await db.project.findFirst({
    where: { id: projectId, workspaceId: workspace.id },
    select: { thumbnailId: true },
  });

  await db.project.update({
    where: { id: projectId, workspaceId: workspace.id },
    data: { thumbnailId: attachment.id },
  });

  // Best-effort cleanup of the previous thumbnail's object + record.
  if (prev?.thumbnailId) {
    const old = await db.attachment.findUnique({
      where: { id: prev.thumbnailId },
      select: { r2Key: true },
    });
    if (old?.r2Key) await deleteObject(old.r2Key).catch(() => {});
    await db.attachment.delete({ where: { id: prev.thumbnailId } }).catch(() => {});
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/settings`);
}

export async function updateProjectTemplates(projectId: string, templateIds: string[]) {
  await requireProjectSettings(projectId);

  await db.projectTemplate.deleteMany({ where: { projectId } });

  if (templateIds.length > 0) {
    await db.projectTemplate.createMany({
      data: templateIds.map((tid) => ({ projectId, templateId: tid })),
    });
  }

  revalidatePath(`/projects/${projectId}`);
}

export async function syncTaskTemplates(taskId: string, templateIds: string[], projectId: string) {
  await requireProjectWork(projectId);

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
        lockedFromStageId: item.lockedFromStageId,
        neverLock: item.neverLock,
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
    let isComplete = ci.completed;
    if (!isComplete && (ci.type === "mention" || ci.type === "copyright")) {
      const parsed = (() => { try { return JSON.parse(ci.textValue || "{}"); } catch { return {}; } })();
      isComplete = parsed.enabled === true ? !!parsed.text : true;
    }
    if (isComplete) continue;

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

export async function getTaskHistory(taskId: string) {
  const workspace = await requireWorkspace();
  return db.activityLog.findMany({
    where: { workspaceId: workspace.id, entityType: "task", entityId: taskId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}
