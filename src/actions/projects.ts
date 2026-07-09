"use server";

import { auth, currentUser, clerkClient } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { requireWorkspace, requireWorkspaceWithMember, requireProjectAssign, requireProjectSettings, requireProjectWork, getProjectAccess } from "@/lib/workspace";
import { canEdit, canDeleteTaskAt, canMoveTaskFrom } from "@/lib/permissions";
import { autoLockOrder, fieldConfig, isFieldLocked, isGateComplete, titleLockConfig } from "@/lib/checklist-config";
import { logActivity } from "@/lib/activity";
import { revalidatePath } from "next/cache";
import { safeAction, type ActionResult } from "@/lib/action";
import { createPresignedGet, deleteObject, uploadBytes, generateR2Key } from "@/lib/storage";
import { sendNotification } from "@/lib/push";
import { publishTaskEvent, type BoardWeeklyDelta } from "@/lib/realtime";
import type { BoardTask } from "@/actions/board";
import { invalidateCache, claimThrottle } from "@/lib/cache";
import { weekStartOf } from "@/lib/week";

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
              titleLabel: true,
              titleHelp: true,
              items: { where: { hidden: false }, orderBy: { order: "asc" } },
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
    boardTask: BoardTask;
  }>
> {
  return safeAction("Create Task", async () => {
    const { member, workspace } = await requireProjectWork(data.projectId);

    const [lastTask, lastNumber, initialStatus, creator, templates, allStages] = await Promise.all([
      db.task.findFirst({
        where: { projectId: data.projectId },
        orderBy: { order: "desc" },
      }),
      db.task.findFirst({
        where: { projectId: data.projectId },
        orderBy: { taskNumber: "desc" },
        select: { taskNumber: true },
      }),
      db.taskStatus.findUnique({
        where: { id: data.statusId },
        select: { name: true, color: true },
      }),
      db.workspaceMember.findUnique({
        where: { id: member.id },
        select: { name: true, email: true, imageUrl: true },
      }),
      data.templateIds.length > 0
        ? db.checklistTemplate.findMany({
            where: { id: { in: data.templateIds } },
            include: { items: { where: { hidden: false }, orderBy: { order: "asc" } } },
          })
        : Promise.resolve([]),
      db.taskStatus.findMany({
        where: { workspaceId: workspace.id },
        select: { id: true, name: true, order: true },
      }),
    ]);

    // Server-side mirror of the form's required gate: explicitly mandatory
    // fields and fields gated before the first forward move must have an
    // answer, otherwise the task would save but be immediately stuck. File
    // answers upload after creation, so file-only kinds can't be checked here.
    const stageOrderById = new Map(allStages.map((s) => [s.id, s.order]));
    const startOrder = stageOrderById.get(data.statusId);
    const firstMoveOrder =
      startOrder != null
        ? allStages
            .filter((s) => s.order > startOrder)
            .sort((a, b) => a.order - b.order)[0]?.order
        : undefined;
    for (const item of templates.flatMap((t) => t.items)) {
      if (item.phase === "delivery" || item.type === "file_upload") continue;
      const gateOrder = item.requiredBeforeStageId
        ? stageOrderById.get(item.requiredBeforeStageId)
        : undefined;
      const required =
        item.mandatory ||
        (gateOrder != null &&
          firstMoveOrder != null &&
          gateOrder <= firstMoveOrder);
      if (!required) continue;
      if (!(data.answers?.[item.id] ?? "").trim()) {
        throw new Error(`"${item.name}" is required before the task can be created`);
      }
    }

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
        // Type-level publish control: the task goes to the publish calendar
        // (once completed) only if its task type says so.
        publish:
          templates.length > 0
            ? templates.some((t) => t.publishToCalendar)
            : true,
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

    if (templates.length > 0) {
      const allItems = templates.flatMap((t) => t.items);
      if (allItems.length > 0) {
        await db.taskChecklistItem.createMany({
          data: allItems.map((item) => {
            const answer = data.answers?.[item.id] ?? null;
            const hasAnswer = !!answer?.trim();
            // Copyright "Yes" is only complete once its file lands — the
            // upload starts right after creation and completes the item.
            const completed =
              hasAnswer &&
              !(item.type === "copyright" && answer!.trim() !== "no");
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
              publishCard: item.publishCard,
              order: item.order,
              textValue: hasAnswer ? answer : null,
              completed,
              completedAt: completed ? new Date() : null,
            };
          }),
        });
      }
    }

    const createdItems = await db.taskChecklistItem.findMany({
      where: { taskId: task.id },
      select: {
        id: true,
        templateItemId: true,
        name: true,
        phase: true,
        mandatory: true,
        completed: true,
      },
    });

    // Full board-card snapshot: the creator's client seeds its cache with it
    // (task appears instantly on the board) and every subscribed board inserts
    // it from the broadcast without refetching.
    const creatorName = creator ? (creator.name ?? creator.email) : null;
    const boardTask: BoardTask = {
      id: task.id,
      taskNumber: task.taskNumber,
      title: task.title,
      statusId: task.statusId,
      statusName: initialStatus?.name ?? "Unknown",
      statusColor: initialStatus?.color ?? "#3b82f6",
      assigneeId: member.id,
      assigneeName: creatorName,
      assigneeAvatar: creator?.imageUrl ?? null,
      serviceName: null,
      priority: task.priority,
      stageEnteredAt: task.stageEnteredAt?.toISOString() ?? null,
      completedAt: null,
      createdAt: task.createdAt.toISOString(),
      totalTimeMs: 0,
      checklistTotal: createdItems.length,
      checklistDone: createdItems.filter((i) => i.completed).length,
      deliveryIncomplete: createdItems
        .filter((i) => i.phase === "delivery" && i.mandatory && !i.completed)
        .map((i) => i.name),
      submittedById: member.id,
      submittedByName: creatorName,
      rejectionCount: 0,
      templateId: templates[0]?.id ?? null,
    };

    revalidatePath(`/projects/${data.projectId}`);
    publishTaskEvent(data.projectId, {
      type: "task.created",
      taskId: task.id,
      snapshot: boardTask,
    });
    return {
      id: task.id,
      items: createdItems.map((i) => ({
        id: i.id,
        templateItemId: i.templateItemId,
      })),
      boardTask,
    };
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

  const [lastTask, lastNumber, projectTemplates] = await Promise.all([
    db.task.findFirst({
      where: { projectId },
      orderBy: { order: "desc" },
      select: { order: true },
    }),
    db.task.findFirst({
      where: { projectId },
      orderBy: { taskNumber: "desc" },
      select: { taskNumber: true },
    }),
    db.projectTemplate.findMany({
      where: { projectId },
      include: { template: { include: { items: { where: { hidden: false }, orderBy: { order: "asc" } } } } },
    }),
  ]);

  const task = await db.task.create({
    data: {
      projectId,
      taskNumber: (lastNumber?.taskNumber ?? 0) + 1,
      title,
      description,
      serviceId: serviceId || null,
      billable,
      price,
      statusId: statusId || null,
      assigneeId: assigneeId || null,
      publish:
        projectTemplates.length > 0
          ? projectTemplates.some((pt) => pt.template.publishToCalendar)
          : true,
      order: (lastTask?.order ?? 0) + 1,
    },
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
        publishCard: item.publishCard,
        order: item.order,
      })),
    });
  }

  publishTaskEvent(projectId, { type: "task.created", taskId: task.id });

  revalidatePath(`/projects/${projectId}`);
  if (dealId) revalidatePath(`/deals/${dealId}`);
}

export type MoveTaskResult =
  | {
      ok: true;
      taskId: string;
      statusId: string;
      assignee: { id: string; name: string; imageUrl: string | null } | null;
      /** Weekly Plan slot change caused by this move — the mover's board
       * patches its placeholders in place (remote boards get it via the
       * broadcast patch). */
      weekly: BoardWeeklyDelta | null;
    }
  | { ok: false; error: string };

export async function updateTaskStatus(
  taskId: string,
  statusId: string,
  projectId: string,
  dealId?: string,
  actorClientId?: string | null,
): Promise<MoveTaskResult> {
  const access = await requireProjectWork(projectId);
  const { workspace, member } = access;

  // One task fetch serves both the stage-gate check and the move itself —
  // getStageGateBlockers used to re-load the task with a massive duplicate
  // include graph in parallel on every single drag.
  const [task, allStatuses] = await Promise.all([
    db.task.findUnique({
      where: { id: taskId },
      include: {
        status: true,
        checklistItems: {
          select: {
            name: true,
            type: true,
            role: true,
            phase: true,
            mandatory: true,
            completed: true,
            hidden: true,
            textValue: true,
            attachmentId: true,
            requiredBeforeStageId: true,
            templateItem: {
              select: {
                name: true,
                type: true,
                role: true,
                phase: true,
                mandatory: true,
                hidden: true,
                templateId: true,
                requiredBeforeStageId: true,
              },
            },
          },
        },
      },
    }),
    db.taskStatus.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { order: "asc" },
    }),
  ]);

  // Resolving the target from the workspace's status list also scopes it to
  // the caller's workspace (the old findUnique-by-id lookup did not).
  const targetStatus = allStatuses.find((s) => s.id === statusId) ?? null;
  const stageOrderById = new Map(allStatuses.map((s) => [s.id, s.order]));

  // Stage-gate check: fields with a "Required Before" stage at or before the
  // target stage must be complete. Rules come from the live template config;
  // detached fields fall back to their own snapshot.
  const blockers: { itemName: string; role: string }[] = [];
  if (task && targetStatus) {
    for (const ci of task.checklistItems) {
      const cfg = fieldConfig(ci);
      if (cfg.hidden) continue;
      if (isGateComplete(ci, cfg)) continue;
      const gateStageId = cfg.requiredBeforeStageId;
      if (!gateStageId) continue;
      const gateOrder = stageOrderById.get(gateStageId);
      if (gateOrder == null) continue;
      if (gateOrder <= targetStatus.order) {
        blockers.push({ itemName: cfg.name, role: cfg.role });
      }
    }
  }

  if (blockers.length > 0) {
    const names = blockers.map((b) => `"${b.itemName}"`).join(", ");
    return {
      ok: false,
      error: `This task's details aren't complete yet, so it can't be moved right now. Still missing: ${names}. If you believe this is a mistake, please contact the task creator.`,
    };
  }

  const fromOrder = task?.status ? allStatuses.find((s) => s.id === task.status!.id)?.order ?? 0 : 0;
  const toOrder = targetStatus?.order ?? 0;
  const isForward = toOrder > fromOrder;

  // Stage-level move rights: the role's Forward/Rollback flag on the task's
  // CURRENT stage decides whether the member may move it out of that stage.
  if (
    !canMoveTaskFrom(
      access.permissions,
      task?.statusId ?? null,
      isForward ? "forward" : "rollback",
    )
  ) {
    const stageName = task?.status?.name ?? "this stage";
    return {
      ok: false,
      error: `You don't have permission to move tasks ${isForward ? "forward" : "back"} from ${stageName}.`,
    };
  }

  // Block submission for Internal Review if mandatory delivery items are still
  // incomplete. Delivery items only need to be done at this gate — earlier
  // forward moves (e.g. Todo → In Progress) must not be blocked. Rules come
  // from the live template config.
  if (task && isForward && targetStatus?.name?.toLowerCase() === "internal review") {
    const incomplete = task.checklistItems
      .map((ci) => ({ cfg: fieldConfig(ci), completed: ci.completed }))
      .filter(
        (ci) =>
          !ci.cfg.hidden &&
          ci.cfg.phase === "delivery" &&
          ci.cfg.mandatory &&
          !ci.completed,
      );
    if (incomplete.length > 0) {
      const names = incomplete.map((i) => `"${i.cfg.name}"`).join(", ");
      return {
        ok: false,
        error: `This task's delivery items aren't complete yet, so it can't be submitted for review. Still missing: ${names}. If you believe this is a mistake, please contact the task creator.`,
      };
    }
  }

  // Weekly Plan gate: moving forward INTO Todo consumes one of this week's
  // slots for the task's type. With no free slot left the move is blocked for
  // everyone — raising the weekly target in project settings is how an admin
  // makes room (it tops the current week up immediately).
  let claimSlotId: string | null = null;
  let createExtraSlot = false;
  const taskTemplateId =
    task?.checklistItems.find((ci) => ci.templateItem?.templateId)
      ?.templateItem?.templateId ?? null;
  if (task && isForward && targetStatus?.name === "Todo" && taskTemplateId) {
    const weekStart = weekStartOf();
    const [target, alreadyBound, freeSlot, weekRows] = await Promise.all([
      db.projectWeeklyTarget.findUnique({
        where: {
          projectId_templateId: { projectId, templateId: taskTemplateId },
        },
      }),
      db.weeklySlot.findUnique({ where: { taskId } }),
      db.weeklySlot.findFirst({
        where: {
          projectId,
          templateId: taskTemplateId,
          weekStart,
          taskId: null,
          removedAt: null,
        },
        orderBy: { createdAt: "asc" },
      }),
      db.weeklySlot.count({
        where: { projectId, templateId: taskTemplateId, weekStart },
      }),
    ]);
    if (target && target.perWeek > 0 && !alreadyBound) {
      if (freeSlot) {
        claimSlotId = freeSlot.id;
      } else if (weekRows < target.perWeek) {
        // This week's slots weren't materialised yet (board not opened since
        // the week rolled over) — the move itself creates the missing slot.
        createExtraSlot = true;
      } else {
        const tpl = await db.checklistTemplate.findUnique({
          where: { id: taskTemplateId },
          select: { name: true },
        });
        return {
          ok: false,
          error: `This week's plan for ${tpl ? `"${tpl.name}"` : "this task type"} is already full, so the task can't move to Todo right now. New slots open next week — or ask an admin to make room.`,
        };
      }
    }
  }
  // Rolling back OUT of Todo frees the task's slot for someone else this week.
  const releaseSlot = !isForward && task?.status?.name === "Todo";
  // Resolve which slot gets freed BEFORE the transaction clears it, so the
  // broadcast can tell boards exactly which placeholder to restore.
  const releasedSlot = releaseSlot
    ? await db.weeklySlot.findUnique({
        where: { taskId },
        select: { id: true, templateId: true },
      })
    : null;

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
    // Weekly Plan slot bookkeeping (see the gate above). The `taskId: null`
    // guard means a concurrently claimed slot is simply left alone.
    ...(claimSlotId
      ? [
          db.weeklySlot.updateMany({
            where: { id: claimSlotId, taskId: null },
            data: { taskId },
          }),
        ]
      : []),
    ...(createExtraSlot && taskTemplateId
      ? [
          db.weeklySlot.create({
            data: {
              projectId,
              templateId: taskTemplateId,
              weekStart: weekStartOf(),
              taskId,
            },
          }),
        ]
      : []),
    ...(releaseSlot
      ? [
          db.weeklySlot.updateMany({
            where: { taskId },
            data: { taskId: null },
          }),
        ]
      : []),
  ]);

  // Resolve the new assignee and the mover before broadcasting so the event
  // carries everything a remote board needs to patch its cache without
  // refetching (the mover becomes the card's "submitted by" for declines).
  const involved = await db.workspaceMember.findMany({
    where: { id: { in: [...new Set([newAssigneeId, member.id])] } },
    select: { id: true, name: true, email: true, imageUrl: true },
  });
  const newAssignee = involved.find((m) => m.id === newAssigneeId) ?? null;
  const mover = involved.find((m) => m.id === member.id) ?? null;
  const completedAt =
    targetStatus?.name === "Completed" || targetStatus?.name === "Published"
      ? now.toISOString()
      : null;

  // Weekly Plan slot change, if any — carried on the broadcast patch and the
  // action result so every board (the mover's included) can patch its slot
  // placeholders in memory instead of refetching the whole board.
  const weeklyDelta: BoardWeeklyDelta | null = claimSlotId && taskTemplateId
    ? { templateId: taskTemplateId, claimedSlotId: claimSlotId }
    : createExtraSlot && taskTemplateId
      ? { templateId: taskTemplateId, createdExtra: true }
      : releasedSlot
        ? { templateId: releasedSlot.templateId, releasedSlotId: releasedSlot.id }
        : null;

  // Broadcast to other connected board clients immediately after the commit.
  // The patch lets every subscribed board apply the move in memory — no
  // refetch storm when many screens are open.
  publishTaskEvent(projectId, {
    type: "task.moved",
    taskId,
    actorClientId: actorClientId ?? null,
    patch: {
      statusId,
      statusName: targetStatus?.name ?? null,
      statusColor: targetStatus?.color ?? null,
      stageEnteredAt: now.toISOString(),
      completedAt,
      assigneeId: newAssignee?.id ?? null,
      assigneeName: newAssignee ? (newAssignee.name ?? newAssignee.email) : null,
      assigneeAvatar: newAssignee?.imageUrl ?? null,
      submittedById: mover?.id ?? null,
      submittedByName: mover ? (mover.name ?? mover.email) : null,
      rejectionCountDelta: isForward ? 0 : 1,
      weekly: weeklyDelta,
    },
  });

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

  // No revalidatePath for the board here: the mover patches its React Query
  // cache from this result and every other viewer gets the broadcast patch.
  // Invalidating the RSC cache per move caused a server re-render storm.
  if (dealId) revalidatePath(`/deals/${dealId}`);

  // Return the resolved assignee so the board can patch its cache immediately
  // (self-assign on forward moves, previous owner on rollbacks, auto-assign).
  return {
    ok: true,
    taskId,
    statusId,
    assignee: newAssignee
      ? {
          id: newAssignee.id,
          name: newAssignee.name ?? newAssignee.email,
          imageUrl: newAssignee.imageUrl ?? null,
        }
      : null,
    weekly: weeklyDelta,
  };
}

export async function assignTaskToMe(taskId: string, projectId: string) {
  const access = await requireProjectWork(projectId);
  const { member } = access;

  const task = await db.task.findUnique({
    where: { id: taskId },
    include: { assignee: { select: { name: true, email: true } } },
  });
  if (!task) throw new Error("Task not found");
  if (task.deletedAt) throw new Error("Task is in the trash");

  // Self-assign requires the "Modify" right for the task's CURRENT stage —
  // same rule as editing task fields (full project access always qualifies).
  const canModify =
    access.permissions.projects === "full" ||
    (task.statusId
      ? access.permissions.taskPermissions?.stages?.[task.statusId]?.modify ===
        true
      : false);
  if (!canModify) {
    throw new Error("You don't have permission to assign tasks at this stage");
  }

  const history: Record<string, string> = (task.assignmentHistory as Record<string, string>) ?? {};
  if (task.statusId) {
    history[task.statusId] = member.id;
  }

  const [, me] = await Promise.all([
    db.task.update({
      where: { id: taskId },
      data: { assigneeId: member.id, assignmentHistory: history },
    }),
    db.workspaceMember.findUnique({
      where: { id: member.id },
      select: { id: true, name: true, email: true, imageUrl: true },
    }),
  ]);

  // Let every open board patch the card's avatar without a refetch.
  publishTaskEvent(projectId, {
    type: "task.updated",
    taskId,
    assignee: me
      ? {
          id: me.id,
          name: me.name ?? me.email,
          avatar: me.imageUrl ?? null,
        }
      : null,
  });

  void logActivity({
    entityType: "task",
    entityId: taskId,
    entityName: task.title,
    action: "updated",
    changes: {
      assignee: {
        from: task.assignee ? (task.assignee.name ?? task.assignee.email) : null,
        to: me?.name ?? me?.email ?? null,
      },
    },
    metadata: { projectId },
  }).catch(() => {});

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

  // Free the task's Weekly Plan slot for this week — a trashed task won't
  // deliver, so the capacity goes back to the team.
  await db.weeklySlot.updateMany({
    where: { taskId, weekStart: weekStartOf() },
    data: { taskId: null },
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

    // Every project is backed by exactly one deal.
    if (!dealId) throw new Error("A project must be linked to a deal");
    const deal = await db.deal.findFirst({
      where: { id: dealId, workspaceId: workspace.id, deletedAt: null },
      select: { companyId: true, contactId: true, project: { select: { id: true } } },
    });
    if (!deal) throw new Error("Deal not found");
    if (deal.project) throw new Error("This deal is already linked to a project");

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
        companyId: companyId || deal.companyId || null,
        dealId,
        contactId: deal.contactId ?? null,
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
            include: {
              template: {
                select: {
                  id: true,
                  name: true,
                  icon: true,
                  color: true,
                  titleLockedFromStageId: true,
                  titleNeverLock: true,
                },
              },
            },
          },
        },
      },
    },
  });
  if (task) {
    // Fully dynamic config: fields linked to a template follow the template's
    // CURRENT hidden flag and order (the per-task snapshot can be stale on
    // tasks created before a settings change). Unlinked custom fields keep
    // their own values.
    task.checklistItems = task.checklistItems
      .filter((it) => !(it.templateItem?.hidden ?? it.hidden))
      .sort(
        (a, b) =>
          (a.templateItem?.order ?? a.order) - (b.templateItem?.order ?? b.order),
      );
  }
  return task;
}

export async function updateTask(taskId: string, data: {
  title?: string;
  description?: string | null;
  assigneeId?: string | null;
  priority?: number | null;
}) {
  await requireWorkspaceWithMember();

  const task = await db.task.findUnique({ where: { id: taskId }, include: { project: true } });
  if (!task) throw new Error("Task not found");
  if (task.deletedAt) throw new Error("Task is in the trash");

  const access = await requireProjectWork(task.projectId);
  // Editing task fields requires the "Modify" right for the task's current
  // stage (full project access always qualifies) — same rule the permissions
  // table in Settings → Roles describes.
  const canModify =
    access.permissions.projects === "full" ||
    (task.statusId
      ? access.permissions.taskPermissions?.stages?.[task.statusId]?.modify === true
      : false);
  if (!canModify) {
    throw new Error("You don't have permission to modify tasks at this stage");
  }

  if (data.title !== undefined && data.title.trim().length === 0) {
    throw new Error("Task title cannot be empty");
  }
  if (data.title !== undefined) data.title = data.title.trim();

  // Title lock: configured per task type in Settings → Task Types (built-in
  // "Title" row). Same stage semantics as checklist fields; the UI hides the
  // pencil, this is the guarantee.
  if (data.title !== undefined && data.title !== task.title) {
    const templateLink = await db.taskChecklistItem.findFirst({
      where: { taskId, templateItemId: { not: null } },
      select: {
        templateItem: {
          select: {
            template: {
              select: { titleLockedFromStageId: true, titleNeverLock: true },
            },
          },
        },
      },
    });
    const statuses = await db.taskStatus.findMany({
      where: { workspaceId: task.project.workspaceId },
      select: { id: true, name: true, order: true },
    });
    const orderById = new Map(statuses.map((s) => [s.id, s.order]));
    const todoOrder = autoLockOrder(statuses);
    const currentOrder = task.statusId
      ? (orderById.get(task.statusId) ?? null)
      : null;
    const cfg = titleLockConfig(templateLink?.templateItem?.template);
    if (isFieldLocked(cfg, currentOrder, orderById, todoOrder)) {
      throw new Error("The title is locked at this stage");
    }
  }

  await db.task.update({ where: { id: taskId }, data });

  revalidatePath(`/projects/${task.projectId}`);
  revalidatePath(`/projects/${task.projectId}/tasks/${taskId}`);
}

// ─── Checklist Items ──────────────────────────────────────────────────────────

// Server-side write guard: the task page disables locked fields in the UI,
// but this is the guarantee. Lock/hidden rules resolve from the LIVE template
// item (fieldConfig), so a settings change protects every existing task
// immediately.
async function assertChecklistItemWritable(itemId: string) {
  const item = await db.taskChecklistItem.findUnique({
    where: { id: itemId },
    include: {
      templateItem: true,
      task: {
        select: {
          deletedAt: true,
          status: { select: { order: true } },
          project: { select: { workspaceId: true } },
        },
      },
    },
  });
  if (!item) throw new Error("Field not found");
  if (item.task.deletedAt) throw new Error("Task is in the trash");

  const cfg = fieldConfig(item);
  if (cfg.hidden) throw new Error(`"${cfg.name}" is disabled`);

  const statuses = await db.taskStatus.findMany({
    where: { workspaceId: item.task.project.workspaceId },
    select: { id: true, name: true, order: true },
  });
  const orderById = new Map(statuses.map((s) => [s.id, s.order]));
  const todoOrder = autoLockOrder(statuses);
  const currentOrder = item.task.status?.order ?? null;

  if (isFieldLocked(cfg, currentOrder, orderById, todoOrder)) {
    throw new Error(`"${cfg.name}" is locked at this stage`);
  }
}

export async function toggleChecklistItem(itemId: string, completed: boolean, projectId: string) {
  await requireProjectWork(projectId);
  await assertChecklistItemWritable(itemId);

  await db.taskChecklistItem.update({
    where: { id: itemId },
    data: {
      completed,
      completedAt: completed ? new Date() : null,
    },
  });

  revalidatePath(`/projects/${projectId}`);
}

// After a checklist item changes, broadcast the task's fresh checklist
// progress so every open board unlocks/updates its card instantly — the drag
// gate reads deliveryIncomplete from the client cache, and without this event
// a completed upload wouldn't count until a full page refresh.
// Fire-and-forget: a broadcast failure must never break the write.
async function publishChecklistProgress(itemId: string, projectId: string) {
  try {
    const item = await db.taskChecklistItem.findUnique({
      where: { id: itemId },
      select: { taskId: true },
    });
    if (!item) return;
    const rows = await db.taskChecklistItem.findMany({
      where: { taskId: item.taskId },
      select: {
        name: true,
        phase: true,
        mandatory: true,
        completed: true,
        hidden: true,
        templateItem: {
          select: { name: true, phase: true, mandatory: true, hidden: true },
        },
      },
    });
    const checklistItems = rows
      .map((r) => ({ cfg: fieldConfig(r), completed: r.completed }))
      .filter((r) => !r.cfg.hidden);
    publishTaskEvent(projectId, {
      type: "task.updated",
      taskId: item.taskId,
      checklist: {
        checklistTotal: checklistItems.length,
        checklistDone: checklistItems.filter((i) => i.completed).length,
        deliveryIncomplete: checklistItems
          .filter((i) => i.cfg.phase === "delivery" && i.cfg.mandatory && !i.completed)
          .map((i) => i.cfg.name),
      },
    });
  } catch {
    // Best-effort only.
  }
}

export async function saveChecklistItemText(itemId: string, textValue: string, projectId: string) {
  await requireProjectWork(projectId);
  await assertChecklistItemWritable(itemId);

  // Copyright answered "Yes" is only complete once its file is attached —
  // the file upload is the mandatory part of a Yes answer.
  const item = await db.taskChecklistItem.findUnique({
    where: { id: itemId },
    select: {
      type: true,
      attachmentId: true,
      templateItem: { select: { type: true } },
    },
  });
  const kind = item?.templateItem?.type ?? item?.type;
  const answeredYes = !!textValue.trim() && textValue.trim() !== "no";
  const completed =
    !!textValue.trim() &&
    !(kind === "copyright" && answeredYes && !item?.attachmentId);

  await db.taskChecklistItem.update({
    where: { id: itemId },
    data: {
      textValue,
      completed,
      completedAt: completed ? new Date() : null,
    },
  });

  await publishChecklistProgress(itemId, projectId);
  revalidatePath(`/projects/${projectId}`);

  // Callers patch their local state from this — no full page refresh needed.
  return { completed };
}

export async function setChecklistItemAttachment(itemId: string, attachmentId: string, projectId: string) {
  await requireProjectWork(projectId);
  await assertChecklistItemWritable(itemId);

  await db.taskChecklistItem.update({
    where: { id: itemId },
    data: {
      attachmentId,
      completed: true,
      completedAt: new Date(),
    },
  });

  await publishChecklistProgress(itemId, projectId);
  revalidatePath(`/projects/${projectId}`);
}

export async function removeChecklistItemAttachment(itemId: string, projectId: string) {
  await requireProjectWork(projectId);
  await assertChecklistItemWritable(itemId);

  await db.taskChecklistItem.update({
    where: { id: itemId },
    data: {
      attachmentId: null,
      completed: false,
      completedAt: null,
    },
  });

  await publishChecklistProgress(itemId, projectId);
  revalidatePath(`/projects/${projectId}`);
}

// Fresh state of one checklist field (attachment metadata + presigned preview
// URL included). The task page fetches this after an upload completes and
// patches the field in place — no full RSC refresh per finished upload.
export async function getChecklistItemState(itemId: string, projectId: string) {
  const access = await getProjectAccess(projectId);
  if (!access.hasAccess) throw new Error("Permission denied");

  const item = await db.taskChecklistItem.findUnique({
    where: { id: itemId },
    select: {
      completed: true,
      textValue: true,
      attachmentId: true,
      task: { select: { projectId: true } },
    },
  });
  if (!item || item.task.projectId !== projectId) throw new Error("Not found");

  let attachmentName: string | null = null;
  let attachmentUrl: string | null = null;
  let attachmentContentType: string | null = null;
  if (item.attachmentId) {
    const a = await db.attachment.findUnique({
      where: { id: item.attachmentId },
      select: { name: true, contentType: true, r2Key: true },
    });
    if (a) {
      attachmentName = a.name;
      attachmentContentType = a.contentType;
      attachmentUrl = a.r2Key ? await createPresignedGet(a.r2Key) : null;
    }
  }

  return {
    completed: item.completed,
    textValue: item.textValue,
    attachmentId: item.attachmentId,
    attachmentName,
    attachmentUrl,
    attachmentContentType,
  };
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
    include: { items: { where: { hidden: false }, orderBy: { order: "asc" } } },
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
        allowedFormats: item.allowedFormats,
        aspectRatio: item.aspectRatio,
        mandatory: item.mandatory,
        phase: item.phase,
        visibleFromStageId: item.visibleFromStageId,
        requiredBeforeStageId: item.requiredBeforeStageId,
        lockedFromStageId: item.lockedFromStageId,
        neverLock: item.neverLock,
        publishCard: item.publishCard,
        order: nextOrder++,
      })),
    });
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/tasks/${taskId}`);
}

// Stage-gate blocker evaluation now lives inline in updateTaskStatus (its
// only caller) so a drag costs one task fetch instead of two overlapping ones.

export async function getTaskHistory(taskId: string) {
  const workspace = await requireWorkspace();
  return db.activityLog.findMany({
    where: { workspaceId: workspace.id, entityType: "task", entityId: taskId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}
