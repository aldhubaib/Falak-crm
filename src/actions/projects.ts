"use server";

import { auth, currentUser, clerkClient } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { requireWorkspace, requireWorkspaceWithMember, requireProjectAssign, requireProjectSettings, requireProjectWork, getProjectAccess } from "@/lib/workspace";
import { canEdit, canDeleteTaskAt, canMoveTaskFrom } from "@/lib/permissions";
import { isTerminalStatusName } from "@/lib/task-status";
import {
  autoLockOrder,
  fieldAppliesForGate,
  isDeliveryGateStage,
  isFieldVisible,
  fieldConfig,
  isFieldLocked,
  isGateComplete,
  isReviewStageName,
  parseYesNoValue,
  titleLockConfig,
} from "@/lib/checklist-config";
import { missingDataMessage } from "@/components/board/confirm-messages";
import { pickReturnWorker } from "@/lib/assignment";
import { logActivity } from "@/lib/activity";
import { revalidatePath } from "next/cache";
import { safeAction, type ActionResult } from "@/lib/action";
import { createPresignedGet, deleteObject, uploadBytes, generateR2Key } from "@/lib/storage";
import { sendNotification } from "@/lib/push";
import { publishTaskEvent, type BoardWeeklyDelta } from "@/lib/realtime";
import type { BoardTask } from "@/actions/board";
import { invalidateCache, claimThrottle } from "@/lib/cache";
import { planningWeekStartOf, weekDueDate, weekStartOf } from "@/lib/week";
import { getWorkspaceTimezone } from "@/lib/project-timezone";
import {
  materialiseWeekSlots,
  nextActiveWeekStart,
  nextWeekStartOf,
  planActiveForWeek,
} from "@/lib/weekly-slots";
import {
  lockChecklistItemEffort,
  lockManyChecklistItemEffort,
  clearChecklistItemEffortLock,
  lockTaskEffortLocks,
  clearTaskEffortLocks,
} from "@/lib/effort-lock";

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
              sections: {
                orderBy: { order: "asc" },
                select: { id: true, name: true, phase: true, order: true },
              },
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
  /** Planned video length in minutes — drives effort predictions (null = 2-min baseline). */
  plannedMinutes?: number | null;
}): Promise<
  ActionResult<{
    id: string;
    items: { id: string; templateItemId: string | null }[];
    boardTask: BoardTask;
  }>
> {
  return safeAction("Create Task", async () => {
    const access = await requireProjectWork(data.projectId);
    const { member, workspace } = access;

    // The Create stage flag gates task creation: the member needs it on the
    // stage the task starts in (full project access always qualifies).
    const canCreate =
      access.permissions.projects === "full" ||
      access.permissions.taskPermissions?.stages?.[data.statusId]?.create ===
        true;
    if (!canCreate) {
      throw new Error(
        "You don't have permission to create tasks in this stage",
      );
    }

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
      if (item.phase === "delivery" || item.type === "file_upload" || item.type === "multi_file") continue;
      if (!isFieldVisible(item, startOrder ?? null, stageOrderById)) continue;
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
        // Task type stored directly — templates with zero fields leave no
        // checklist items to infer it from.
        templateId: templates[0]?.id ?? null,
        plannedMinutes:
          data.plannedMinutes != null && data.plannedMinutes > 0
            ? data.plannedMinutes
            : null,
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
              effortUnit: item.effortUnit,
              order: item.order,
              textValue: hasAnswer ? answer : null,
              completed,
              completedAt: completed ? new Date() : null,
              completedBy: completed ? member.id : null,
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
      templateName: templates[0]?.name ?? null,
      templateIcon: templates[0]?.icon ?? null,
      templateColor: templates[0]?.color ?? null,
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

type GateChecklistItem = {
  id: string;
  name: string;
  type: string | null;
  role: string | null;
  phase: string | null;
  mandatory: boolean;
  completed: boolean;
  hidden: boolean;
  textValue: string | null;
  attachmentId: string | null;
  visibleFromStageId: string | null;
  requiredBeforeStageId: string | null;
  templateItem: {
    name: string;
    type: string | null;
    role: string | null;
    phase: string | null;
    mandatory: boolean;
    hidden: boolean;
    visibleFromStageId: string | null;
    requiredBeforeStageId: string | null;
  } | null;
};

/**
 * Field names blocking a move to `targetStatus`: incomplete "Required Before"
 * fields plus — at a delivery-gate stage on a forward move — incomplete
 * mandatory delivery items. Shared by the real move and the board's dry-run
 * (which runs BEFORE the confirm dialog).
 */
function taskMoveGateMissing(
  task: {
    status: { order: number } | null;
    checklistItems: GateChecklistItem[];
  },
  targetStatus: { name: string; order: number },
  stageOrderById: Map<string, number>,
  itemsWithFiles: ReadonlySet<string>,
): string[] {
  const taskCurrentOrder = task.status?.order ?? null;
  // Visibility for GATING is judged at the furthest stage the move touches —
  // a field that appears between here and the target still gates the move.
  // Judging at the current stage let a multi-stage drag jump right past
  // fields it never showed (e.g. Raw Footage Review → Review skipping the
  // Post Production uploads).
  const gateVisibilityOrder = Math.max(
    taskCurrentOrder ?? 0,
    targetStatus.order,
  );
  const isForward = targetStatus.order > (taskCurrentOrder ?? 0);

  // Gates only guard FORWARD progress. Rolling a task back (e.g. Completed →
  // In Review) is how work gets sent back for fixing — blocking it on fields
  // that gate earlier stages would trap the task in place.
  if (!isForward) return [];

  const missing: string[] = [];
  for (const ci of task.checklistItems) {
    const cfg = fieldConfig(ci);
    if (cfg.hidden) continue;
    if (!isFieldVisible(cfg, gateVisibilityOrder, stageOrderById)) continue;
    if (!fieldAppliesForGate(ci, task.checklistItems)) continue;
    if (isGateComplete(ci, { type: cfg.type ?? undefined })) continue;
    // Multi-file fields are judged by their actual stored files, not the
    // completed flag alone: an upload that finishes after the field locked
    // (e.g. the task moved stages mid-upload) stores and lists the file but
    // is rejected by the lock when flipping `completed` — without this the
    // gate would demand a field whose files are visibly there.
    if (cfg.type === "multi_file" && itemsWithFiles.has(ci.id)) continue;

    // "Required Before" fields must be complete at or before their gate stage.
    const gateStageId = cfg.requiredBeforeStageId;
    const gateOrder = gateStageId ? stageOrderById.get(gateStageId) : null;
    if (gateOrder != null && gateOrder <= targetStatus.order) {
      missing.push(cfg.name);
      continue;
    }
    // Mandatory delivery items block submission at the delivery-gate stage.
    if (
      isDeliveryGateStage(targetStatus.name) &&
      cfg.phase === "delivery" &&
      cfg.mandatory
    ) {
      missing.push(cfg.name);
    }
  }
  return missing;
}

/**
 * Ids of the given multi-file fields that have at least one stored file —
 * the gate treats those as complete even when the `completed` flag is stale.
 */
async function multiFileItemsWithUploads(
  items: GateChecklistItem[],
): Promise<Set<string>> {
  const candidateIds = items
    .filter((ci) => !ci.completed && fieldConfig(ci).type === "multi_file")
    .map((ci) => ci.id);
  if (candidateIds.length === 0) return new Set();

  const rows = await db.attachment.groupBy({
    by: ["entityId"],
    where: {
      entityType: "checklist_item",
      entityId: { in: candidateIds },
      status: "uploaded",
    },
  });
  return new Set(rows.map((r) => r.entityId));
}

/**
 * Dry-run of updateTaskStatus's stage-gate checks against fresh data. The
 * board calls this BEFORE showing any confirm dialog, so "missing data"
 * surfaces first instead of after the user already confirmed.
 */
export async function checkTaskMoveGates(
  taskId: string,
  statusId: string,
  projectId: string,
): Promise<{ ok: true } | { ok: false; missing: string[] }> {
  const { workspace } = await requireProjectWork(projectId);
  const [task, allStatuses] = await Promise.all([
    db.task.findFirst({
      where: { id: taskId, projectId },
      select: {
        status: { select: { order: true } },
        checklistItems: {
          select: {
            id: true,
            name: true,
            type: true,
            role: true,
            phase: true,
            mandatory: true,
            completed: true,
            hidden: true,
            textValue: true,
            attachmentId: true,
            visibleFromStageId: true,
            requiredBeforeStageId: true,
            templateItem: {
              select: {
                name: true,
                type: true,
                role: true,
                phase: true,
                mandatory: true,
                hidden: true,
                visibleFromStageId: true,
                requiredBeforeStageId: true,
              },
            },
          },
        },
      },
    }),
    db.taskStatus.findMany({
      where: { workspaceId: workspace.id },
      select: { id: true, name: true, order: true },
    }),
  ]);
  const targetStatus = allStatuses.find((s) => s.id === statusId) ?? null;
  // Missing task/stage isn't the dry-run's problem — the real move reports it.
  if (!task || !targetStatus) return { ok: true };

  const missing = taskMoveGateMissing(
    task,
    targetStatus,
    new Map(allStatuses.map((s) => [s.id, s.order])),
    await multiFileItemsWithUploads(task.checklistItems),
  );
  return missing.length > 0 ? { ok: false, missing } : { ok: true };
}

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
            id: true,
            name: true,
            type: true,
            role: true,
            phase: true,
            mandatory: true,
            completed: true,
            hidden: true,
            textValue: true,
            attachmentId: true,
            visibleFromStageId: true,
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
                visibleFromStageId: true,
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

  // Stage-gate check: incomplete "Required Before" fields and — when
  // submitting to a delivery-gate stage — mandatory delivery items block the
  // move. Rules come from the live template config; detached fields fall back
  // to their own snapshot. Same helper the board's pre-drag dry-run uses.
  if (task && targetStatus) {
    const missing = taskMoveGateMissing(
      task,
      targetStatus,
      stageOrderById,
      await multiFileItemsWithUploads(task.checklistItems),
    );
    if (missing.length > 0) {
      return { ok: false, error: missingDataMessage(missing) };
    }
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

  // Forward moves are the assignee's to make: a non-assignee — even with the
  // Forward right — sees the task read-only until they take ownership. The
  // same Forward right lets them self-assign (avatar / ownership banner), and
  // then they can move it. Workspace owners bypass, and unassigned tasks are
  // claimed by the move itself. Same rule as assertChecklistItemWritable.
  if (
    isForward &&
    member.type !== "OWNER" &&
    task?.assigneeId != null &&
    task.assigneeId !== member.id
  ) {
    return {
      ok: false,
      error:
        "This task is assigned to someone else. Assign it to yourself first, then move it forward.",
    };
  }

  // Weekly Plan gate: moving forward INTO Todo consumes one of this week's
  // slots, and only a slot of the task's OWN type. No plan for the type (or
  // no type at all) blocks the move — Todo only holds planned work. Claiming
  // a slot stamps the task's due date: Thursday 23:59 of the slot's week on
  // the unified calendar (Fri/Sat additions book straight into next week).
  // When this week's plan for the type is FULL the task overflows into next
  // week instead of being blocked: it books an extra bound slot with next
  // week's weekStart, and next week's plan placeholders materialise so the
  // board can show the whole next plan under "Next week".
  let claimSlotId: string | null = null;
  let createExtraSlot = false;
  let overflowToNextWeek = false;
  let planningWeekStart: Date | null = null;
  let slotDueDate: Date | null = null;
  // Stored type first; checklist inference is the fallback for legacy tasks
  // created before Task.templateId existed.
  const taskTemplateId =
    task?.templateId ??
    task?.checklistItems.find((ci) => ci.templateItem?.templateId)
      ?.templateItem?.templateId ??
    null;
  if (task && isForward && targetStatus?.name === "Todo") {
    const alreadyBound = await db.weeklySlot.findUnique({
      where: { taskId },
      select: { id: true },
    });
    if (!alreadyBound) {
      if (!taskTemplateId) {
        return {
          ok: false,
          error:
            "There are no planned items this task can fill — it has no task type. Todo only takes tasks from the weekly plan.",
        };
      }
      const weekStart = planningWeekStartOf();
      planningWeekStart = weekStart;
      const [target, freeSlot, weekRows, tpl] = await Promise.all([
        db.projectWeeklyTarget.findUnique({
          where: {
            projectId_templateId: { projectId, templateId: taskTemplateId },
          },
        }),
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
        db.checklistTemplate.findUnique({
          where: { id: taskTemplateId },
          select: { name: true },
        }),
      ]);
      const typeName = tpl ? `"${tpl.name}"` : "this task type";
      if (!target || target.perWeek <= 0) {
        return {
          ok: false,
          error: `There are no planned items for ${typeName}, so the task can't move to Todo. Add a weekly plan for it in Project Settings → Planning.`,
        };
      }
      // The plan only takes work on its active weeks (its start week, then
      // every intervalWeeks). This week inactive = the task books into the
      // plan's next active week — unless the plan hasn't started at all and
      // its first week is beyond next week, which blocks the move outright.
      const activeThisWeek = planActiveForWeek(
        target.startsOn,
        weekStart,
        target.intervalWeeks,
      );
      const notStartedYet =
        weekStartOf(target.startsOn).getTime() > weekStart.getTime();
      if (
        !activeThisWeek &&
        notStartedYet &&
        weekStartOf(target.startsOn).getTime() >
          nextWeekStartOf(weekStart).getTime()
      ) {
        const startFmt = new Intl.DateTimeFormat("en-US", {
          timeZone: getWorkspaceTimezone(),
          month: "short",
          day: "numeric",
        }).format(target.startsOn);
        return {
          ok: false,
          error: `The ${typeName} plan starts the week of ${startFmt} — tasks can't move to Todo before then.`,
        };
      }
      // A force-added slot carries its own deadline — it beats the week due.
      let claimedSlotDueDate: Date | null = null;
      if (activeThisWeek && freeSlot) {
        claimSlotId = freeSlot.id;
        claimedSlotDueDate = freeSlot.dueDate;
      } else if (activeThisWeek && weekRows < target.perWeek) {
        // This week's slots weren't materialised yet (board not opened since
        // the week rolled over) — the move itself creates the missing slot.
        createExtraSlot = true;
      } else {
        // Plan full this week, or this is an off-week / pre-start week — book
        // into the plan's next active week. That week's placeholders
        // materialise so the board can show them, and the task claims a free
        // one. Only when that week is full too does the task ride on top as
        // an extra bound slot.
        overflowToNextWeek = true;
        planningWeekStart = nextActiveWeekStart(
          target.startsOn,
          target.intervalWeeks,
          nextWeekStartOf(weekStart),
        );
        await materialiseWeekSlots(projectId, planningWeekStart);
        const nextWeekFreeSlot = await db.weeklySlot.findFirst({
          where: {
            projectId,
            templateId: taskTemplateId,
            weekStart: planningWeekStart,
            taskId: null,
            removedAt: null,
          },
          orderBy: { createdAt: "asc" },
        });
        if (nextWeekFreeSlot) {
          claimSlotId = nextWeekFreeSlot.id;
          claimedSlotDueDate = nextWeekFreeSlot.dueDate;
        } else {
          createExtraSlot = true;
        }
      }
      // The slot's deadline: Thursday 23:59 of the week it books into (same
      // date the board shows as "due <date>" on the placeholder). An overflow
      // task adopts NEXT week's Thursday.
      slotDueDate = claimedSlotDueDate ?? weekDueDate(planningWeekStart);
    }
  }
  // Rolling back OUT of Todo frees the task's slot for someone else this week.
  const releaseSlot = !isForward && task?.status?.name === "Todo";
  // Resolve which slot gets freed BEFORE the transaction clears it, so the
  // broadcast can tell boards exactly which placeholder to restore.
  const releasedSlot = releaseSlot
    ? await db.weeklySlot.findUnique({
        where: { taskId },
        select: {
          id: true,
          templateId: true,
          weekStart: true,
          assignee: {
            select: { id: true, name: true, email: true, imageUrl: true },
          },
        },
      })
    : null;
  // An overflow slot (booked beyond its week's plan capacity) is deleted on
  // rollback rather than freed — freeing it would leave a phantom extra
  // placeholder on top of the plan.
  let deleteReleasedSlot = false;
  if (releasedSlot) {
    const [slotWeekRows, releasedTarget] = await Promise.all([
      db.weeklySlot.count({
        where: {
          projectId,
          templateId: releasedSlot.templateId,
          weekStart: releasedSlot.weekStart,
        },
      }),
      db.projectWeeklyTarget.findUnique({
        where: {
          projectId_templateId: {
            projectId,
            templateId: releasedSlot.templateId,
          },
        },
        select: { perWeek: true, startsOn: true, intervalWeeks: true },
      }),
    ]);
    // The plan's capacity for the slot's week: perWeek on active weeks, zero
    // on off-weeks of an every-N-weeks plan (any slot there is overflow).
    const weekCapacity =
      releasedTarget &&
      planActiveForWeek(
        releasedTarget.startsOn,
        releasedSlot.weekStart,
        releasedTarget.intervalWeeks,
      )
        ? releasedTarget.perWeek
        : 0;
    deleteReleasedSlot = slotWeekRows > weekCapacity;
  }

  const history: Record<string, string> = (task?.assignmentHistory as Record<string, string>) ?? {};

  let newAssigneeId: string = member.id;
  const fillsWeeklySlot = !!(claimSlotId || createExtraSlot);

  if (isForward) {
    if (task?.statusId && task.assigneeId) {
      history[task.statusId] = task.assigneeId;
    }

    if (fillsWeeklySlot) {
      // Claiming a weekly plan slot assigns the task to whoever filled it.
      newAssigneeId = member.id;
    } else {
      const projectMembers = await db.projectMember.findMany({
        where: { projectId },
        include: { role: true, member: { select: { type: true } } },
        orderBy: { addedAt: "asc" },
      });

      const autoAssignMember = projectMembers.find((pm) => {
        const perms = (pm.role?.permissions as Record<string, unknown>) ?? {};
        const tp = (perms.taskPermissions as { stages: Record<string, { autoAssign?: boolean }> }) ?? { stages: {} };
        return tp.stages?.[statusId]?.autoAssign === true;
      });

      if (autoAssignMember) {
        newAssigneeId = autoAssignMember.memberId;
      } else if (isReviewStageName(task?.status?.name)) {
        // Reviewers borrow, workers own: approving a task forward out of a
        // review stage hands it back to the last worker recorded in the
        // assignment history — not the reviewer who clicked the button.
        const worker = pickReturnWorker({
          history,
          statuses: allStatuses,
          fromStatusId: task?.statusId ?? null,
          targetStatusId: statusId,
          projectMembers: projectMembers.map((pm) => ({
            memberId: pm.memberId,
            memberType: pm.member.type,
            rolePermissions: pm.role?.permissions ?? null,
          })),
        });
        if (worker) newAssigneeId = worker;
      }
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
        completedAt: isTerminalStatusName(targetStatus?.name) ? now : null,
        // Claiming a plan slot adopts the plan cycle's deadline.
        ...(slotDueDate ? { dueDate: slotDueDate } : {}),
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
    ...(createExtraSlot && taskTemplateId && planningWeekStart
      ? [
          db.weeklySlot.create({
            data: {
              projectId,
              templateId: taskTemplateId,
              weekStart: planningWeekStart,
              taskId,
              assigneeId: member.id,
            },
          }),
        ]
      : []),
    ...(releaseSlot
      ? [
          deleteReleasedSlot
            ? db.weeklySlot.deleteMany({ where: { taskId } })
            : db.weeklySlot.updateMany({
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
  const completedAt = isTerminalStatusName(targetStatus?.name) ? now.toISOString() : null;

  // Weekly Plan slot change, if any — carried on the broadcast patch and the
  // action result so every board (the mover's included) can patch its slot
  // placeholders in memory instead of refetching the whole board.
  const weeklyDelta: BoardWeeklyDelta | null = overflowToNextWeek && taskTemplateId
    ? { templateId: taskTemplateId, overflow: true }
    : claimSlotId && taskTemplateId
    ? { templateId: taskTemplateId, claimedSlotId: claimSlotId }
    : createExtraSlot && taskTemplateId
      ? { templateId: taskTemplateId, createdExtra: true }
      : releasedSlot && deleteReleasedSlot
        ? { templateId: releasedSlot.templateId, overflow: true }
        : releasedSlot
        ? {
            templateId: releasedSlot.templateId,
            releasedSlot: {
              id: releasedSlot.id,
              assigneeId: releasedSlot.assignee?.id ?? null,
              assigneeName: releasedSlot.assignee
                ? (releasedSlot.assignee.name ?? releasedSlot.assignee.email)
                : null,
              assigneeAvatar: releasedSlot.assignee?.imageUrl ?? null,
            },
          }
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
  // The task DETAIL page must revalidate though — its field visibility
  // (Visible From / gates) is computed server-side from the stage, and the
  // router cache would otherwise serve the old stage's fields.
  revalidatePath(`/projects/${projectId}/tasks/${taskId}`);
  if (dealId) revalidatePath(`/deals/${dealId}`);
  if (weeklyDelta) revalidatePath("/dashboard");

  // Keyed off the columns the task moved between, not off completedAt: a task
  // that reached Completed before that stamp existed would otherwise look like
  // it had never finished, and keep its calendar slot through a rollback.
  const wasTerminal = isTerminalStatusName(task?.status?.name);
  const isTerminal = isTerminalStatusName(targetStatus?.name);
  const becameCompleted = isTerminal && !wasTerminal;
  const leftCompleted = wasTerminal && !isTerminal;
  if (becameCompleted) {
    await lockTaskEffortLocks(taskId);
    // It just entered the publish queue, so the calendar's cached pool is stale.
    revalidatePath("/publish");
  } else if (leftCompleted) {
    await clearTaskEffortLocks(taskId);
    // Pulled back for rework — it's no longer ready to publish, so its
    // scheduled calendar slot is dropped and the date must be set again once
    // the task completes. Already-published entries stay: they're history.
    const unscheduled = await db.publishItem.deleteMany({
      where: { taskId, published: false },
    });
    if (unscheduled.count > 0) revalidatePath("/publish");
  }

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

// Read-only preview of who would own the task after a forward move — the
// confirm dialog shows the hand-off before the user commits. Mirrors the
// assignee decision in updateTaskStatus (slot claim → auto-assign → return
// worker → mover) without touching anything.
export async function previewForwardOwnership(
  taskId: string,
  targetStatusId: string,
  projectId: string,
): Promise<{ id: string; name: string; avatar: string | null; isMe: boolean } | null> {
  const access = await requireProjectWork(projectId);
  const { member } = access;

  const [task, allStatuses] = await Promise.all([
    db.task.findFirst({
      where: { id: taskId, projectId },
      select: {
        statusId: true,
        status: { select: { name: true, order: true } },
        assignmentHistory: true,
        assigneeId: true,
      },
    }),
    db.taskStatus.findMany({
      where: { workspaceId: access.workspace.id },
      select: { id: true, name: true, order: true },
    }),
  ]);
  const target = allStatuses.find((s) => s.id === targetStatusId);
  if (!task || !target) return null;
  const isForward = target.order > (task.status?.order ?? -1);
  if (!isForward) return null;

  let ownerId: string = member.id;
  if (target.name !== "Todo") {
    // Todo moves claim a weekly slot → always the mover. Everything else
    // follows the same priority chain as the real move.
    const projectMembers = await db.projectMember.findMany({
      where: { projectId },
      include: { role: true, member: { select: { type: true } } },
      orderBy: { addedAt: "asc" },
    });
    const autoAssignMember = projectMembers.find((pm) => {
      const perms = (pm.role?.permissions as Record<string, unknown>) ?? {};
      const tp = (perms.taskPermissions as { stages: Record<string, { autoAssign?: boolean }> }) ?? { stages: {} };
      return tp.stages?.[targetStatusId]?.autoAssign === true;
    });
    if (autoAssignMember) {
      ownerId = autoAssignMember.memberId;
    } else if (isReviewStageName(task.status?.name)) {
      const history: Record<string, string> =
        (task.assignmentHistory as Record<string, string>) ?? {};
      // The real move records the current stage's owner before deciding.
      if (task.statusId && task.assigneeId) history[task.statusId] = task.assigneeId;
      const worker = pickReturnWorker({
        history,
        statuses: allStatuses,
        fromStatusId: task.statusId,
        targetStatusId,
        projectMembers: projectMembers.map((pm) => ({
          memberId: pm.memberId,
          memberType: pm.member.type,
          rolePermissions: pm.role?.permissions ?? null,
        })),
      });
      if (worker) ownerId = worker;
    }
  }

  const owner = await db.workspaceMember.findUnique({
    where: { id: ownerId },
    select: { id: true, name: true, email: true, imageUrl: true },
  });
  if (!owner) return null;
  return {
    id: owner.id,
    name: owner.name ?? owner.email,
    avatar: owner.imageUrl ?? null,
    isMe: owner.id === member.id,
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

  // Taking ownership requires the Forward right on the task's CURRENT stage —
  // only someone who could carry the task onward may claim its work (full
  // project access always qualifies).
  if (!canMoveTaskFrom(access.permissions, task.statusId, "forward")) {
    throw new Error(
      "You can't take ownership here — it needs permission to move tasks forward from this stage",
    );
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

  const weekStart = planningWeekStartOf();

  await db.task.update({
    where: { id: taskId },
    data: { deletedAt: new Date(), deletedBy: access.member.id },
  });

  // Free the task's Weekly Plan slot for this week — a trashed task won't
  // deliver, so the capacity goes back to the team.
  await db.weeklySlot.updateMany({
    where: { taskId, weekStart },
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
  const fetchTask = () =>
    db.task.findFirst({
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
  let task = await fetchTask();

  // Fields added to a task type AFTER this task was created have no per-task
  // row yet, so they'd never render. Materialise the missing rows here so new
  // template fields appear on existing tasks (visibility rules still apply).
  if (task && !task.deletedAt) {
    // Stored type included: a task created while its template had zero fields
    // has no checklist links to infer the template from, yet fields added to
    // the template later must still materialise here.
    const templateIds = [
      ...new Set(
        [
          task.templateId,
          ...task.checklistItems.map((it) => it.templateItem?.templateId),
        ].filter((id): id is string => !!id),
      ),
    ];
    if (templateIds.length > 0) {
      const templateItems = await db.checklistTemplateItem.findMany({
        where: { templateId: { in: templateIds }, hidden: false },
      });
      const linked = new Set(
        task.checklistItems
          .map((it) => it.templateItemId)
          .filter((id): id is string => !!id),
      );
      const missing = templateItems.filter((item) => !linked.has(item.id));
      if (missing.length > 0) {
        await db.taskChecklistItem.createMany({
          data: missing.map((item) => ({
            taskId: task!.id,
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
            order: item.order,
          })),
          // Concurrent loads of the same task race here; the unique index on
          // (taskId, templateItemId) makes the second writer a no-op.
          skipDuplicates: true,
        });
        task = await fetchTask();
      }
    }
  }

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

// Change a task's deadline from the detail page's ⋮ menu. Same Modify-right
// gate as updateTask; the new date can't be in the past (the client sends
// end-of-day in the project's timezone, so "today" is still valid).
export async function updateTaskDueDate(taskId: string, dueDate: Date) {
  await requireWorkspaceWithMember();

  const task = await db.task.findUnique({
    where: { id: taskId },
    select: { projectId: true, statusId: true, deletedAt: true },
  });
  if (!task) throw new Error("Task not found");
  if (task.deletedAt) throw new Error("Task is in the trash");

  const access = await requireProjectWork(task.projectId);
  const canModify =
    access.permissions.projects === "full" ||
    (task.statusId
      ? access.permissions.taskPermissions?.stages?.[task.statusId]?.modify === true
      : false);
  if (!canModify) {
    throw new Error("You don't have permission to modify tasks at this stage");
  }

  const due = new Date(dueDate);
  if (isNaN(due.getTime())) throw new Error("Pick a valid due date");
  if (due.getTime() < Date.now()) {
    throw new Error("The due date can't be in the past");
  }

  await db.task.update({ where: { id: taskId }, data: { dueDate: due } });

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
          id: true,
          deletedAt: true,
          statusId: true,
          status: { select: { order: true } },
          projectId: true,
          assigneeId: true,
          assignmentHistory: true,
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

  // A field that hasn't reached its "Visible From" stage isn't part of the
  // work yet — the UI never renders it, and writes are rejected here too.
  if (!isFieldVisible(cfg, currentOrder, orderById)) {
    throw new Error(`"${cfg.name}" isn't available at this stage yet`);
  }

  if (isFieldLocked(cfg, currentOrder, orderById, todoOrder)) {
    throw new Error(`"${cfg.name}" is locked at this stage`);
  }

  const access = await getProjectAccess(item.task.projectId);
  // Filling fields IS the stage's work: whoever may move the task onward
  // (Forward right) gets open fields, same as the broader Modify right.
  // Stage visibility/locks above and the assignee rule below still apply.
  const stageFlags = item.task.statusId
    ? access.permissions.taskPermissions?.stages?.[item.task.statusId]
    : undefined;
  const canWork =
    access.permissions.projects === "full" ||
    stageFlags?.modify === true ||
    stageFlags?.forward === true;
  if (!canWork) {
    throw new Error("You don't have permission to edit fields at this stage");
  }

  // Work product belongs to the task's assignee: fields and uploads are theirs
  // alone, so effort credit always matches the visible owner. Others must take
  // ownership first (assignee chip / avatar). Workspace owners bypass.
  if (access.member.type !== "OWNER") {
    if (item.task.assigneeId == null) {
      // Unassigned work: the first editor claims the task, no friction.
      const history: Record<string, string> =
        (item.task.assignmentHistory as Record<string, string>) ?? {};
      if (item.task.statusId) history[item.task.statusId] = access.member.id;
      await db.task.update({
        where: { id: item.task.id },
        data: { assigneeId: access.member.id, assignmentHistory: history },
      });
      const me = await db.workspaceMember.findUnique({
        where: { id: access.member.id },
        select: { id: true, name: true, email: true, imageUrl: true },
      });
      if (me) {
        publishTaskEvent(item.task.projectId, {
          type: "task.updated",
          taskId: item.task.id,
          assignee: { id: me.id, name: me.name ?? me.email, avatar: me.imageUrl ?? null },
        });
      }
    } else if (item.task.assigneeId !== access.member.id) {
      throw new Error(
        "Only the assignee can edit this task — take ownership first",
      );
    }
  }
}

async function syncChecklistItemEffortLock(itemId: string, completed: boolean) {
  const item = await db.taskChecklistItem.findUnique({
    where: { id: itemId },
    select: { task: { select: { completedAt: true } } },
  });
  const taskComplete = item?.task.completedAt != null;
  if (taskComplete && completed) {
    await lockChecklistItemEffort(itemId);
  } else {
    await clearChecklistItemEffortLock(itemId);
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

  await syncChecklistItemEffortLock(itemId, completed);

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
      select: {
        taskId: true,
        task: {
          select: {
            status: { select: { order: true } },
            project: { select: { workspaceId: true } },
          },
        },
      },
    });
    if (!item) return;
    const [rows, statuses] = await Promise.all([
      db.taskChecklistItem.findMany({
        where: { taskId: item.taskId },
        select: {
          name: true,
          type: true,
          phase: true,
          mandatory: true,
          completed: true,
          hidden: true,
          textValue: true,
          attachmentId: true,
          visibleFromStageId: true,
          templateItem: {
            select: {
              name: true,
              type: true,
              phase: true,
              mandatory: true,
              hidden: true,
              visibleFromStageId: true,
            },
          },
        },
      }),
      db.taskStatus.findMany({
        where: { workspaceId: item.task.project.workspaceId },
        select: { id: true, order: true },
      }),
    ]);
    // Same rules as the board query and the server gates: fields not yet
    // visible at the task's current stage don't count, and Yes/No kinds use
    // gate-complete semantics (a "No" or a satisfied "Yes" doesn't block).
    const orderById = new Map(statuses.map((s) => [s.id, s.order]));
    const currentOrder = item.task.status?.order ?? null;
    const checklistItems = rows
      .map((r) => ({ cfg: fieldConfig(r), row: r }))
      .filter(
        (r) => !r.cfg.hidden && isFieldVisible(r.cfg, currentOrder, orderById),
      );
    publishTaskEvent(projectId, {
      type: "task.updated",
      taskId: item.taskId,
      checklist: {
        checklistTotal: checklistItems.length,
        checklistDone: checklistItems.filter((i) => i.row.completed).length,
        deliveryIncomplete: checklistItems
          .filter(
            (i) =>
              i.cfg.phase === "delivery" &&
              i.cfg.mandatory &&
              !isGateComplete(i.row, i.cfg),
          )
          .map((i) => i.cfg.name),
      },
    });
  } catch {
    // Best-effort only.
  }
}

export async function saveChecklistItemText(itemId: string, textValue: string, projectId: string) {
  const { member } = await requireProjectWork(projectId);
  await assertChecklistItemWritable(itemId);

  // Copyright answered "Yes" is only complete once its file is attached —
  // the file upload is the mandatory part of a Yes answer.
  const item = await db.taskChecklistItem.findUnique({
    where: { id: itemId },
    select: {
      taskId: true,
      type: true,
      attachmentId: true,
      templateItem: { select: { type: true } },
    },
  });
  const kind = item?.templateItem?.type ?? item?.type;
  const parsed = parseYesNoValue(textValue);
  const answeredYes = parsed.value === "yes";
  const completed =
    parsed.value !== null &&
    !(kind === "copyright" && answeredYes && !item?.attachmentId);

  const clearAttachment =
    kind === "copyright" && parsed.value === "no" && !!item?.attachmentId;

  await db.taskChecklistItem.update({
    where: { id: itemId },
    data: {
      textValue,
      completed,
      completedAt: completed ? new Date() : null,
      completedBy: completed ? member.id : null,
      ...(clearAttachment ? { attachmentId: null } : {}),
    },
  });

  // Copyright "No" waives separate follow-up rows (e.g. a "Comment" field).
  if (kind === "copyright" && parsed.value === "no" && item?.taskId) {
    const siblings = await db.taskChecklistItem.findMany({
      where: { taskId: item.taskId },
      select: {
        id: true,
        name: true,
        type: true,
        role: true,
        textValue: true,
        templateItem: {
          select: { name: true, type: true, role: true },
        },
      },
    });
    const waivedIds = siblings
      .filter((row) => !fieldAppliesForGate(row, siblings, "no"))
      .map((row) => row.id);
    if (waivedIds.length > 0) {
      await db.taskChecklistItem.updateMany({
        where: { id: { in: waivedIds } },
        data: { completed: true, completedAt: new Date() },
      });
      // All waived rows belong to this task — one completedAt check, one batch.
      const task = await db.task.findUnique({
        where: { id: item.taskId },
        select: { completedAt: true },
      });
      if (task?.completedAt) {
        await lockManyChecklistItemEffort(waivedIds);
      }
    }
  }

  await syncChecklistItemEffortLock(itemId, completed);

  await publishChecklistProgress(itemId, projectId);
  revalidatePath(`/projects/${projectId}`);

  // Callers patch their local state from this — no full page refresh needed.
  return { completed };
}

export async function setChecklistItemAttachment(itemId: string, attachmentId: string, projectId: string) {
  const { member } = await requireProjectWork(projectId);
  await assertChecklistItemWritable(itemId);

  // Multi-file fields don't use the single attachmentId pointer — their files
  // are the Attachment rows bound to the item (entityType "checklist_item").
  // The upload just marks the field complete.
  const item = await db.taskChecklistItem.findUnique({
    where: { id: itemId },
    select: { type: true, templateItem: { select: { type: true } } },
  });
  const kind = item?.templateItem?.type ?? item?.type;

  await db.taskChecklistItem.update({
    where: { id: itemId },
    data: {
      ...(kind === "multi_file" ? {} : { attachmentId }),
      completed: true,
      completedAt: new Date(),
      completedBy: member.id,
    },
  });

  await syncChecklistItemEffortLock(itemId, true);

  await publishChecklistProgress(itemId, projectId);
  revalidatePath(`/projects/${projectId}`);
}

// One uploaded file of a multi-file field. The list is derived from the
// Attachment rows created by the upload pipeline for this checklist item.
export type ChecklistItemFile = {
  id: string;
  name: string;
  contentType: string | null;
  url: string | null;
  durationSec: number | null;
};

async function listChecklistItemFiles(itemId: string): Promise<ChecklistItemFile[]> {
  const rows = await db.attachment.findMany({
    where: { entityType: "checklist_item", entityId: itemId, status: "uploaded" },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, contentType: true, r2Key: true, durationSec: true },
  });
  return Promise.all(
    rows.map(async (a) => ({
      id: a.id,
      name: a.name,
      contentType: a.contentType,
      url: a.r2Key ? await createPresignedGet(a.r2Key) : null,
      durationSec: a.durationSec,
    })),
  );
}

// Remove ONE file from a multi-file field. Deletes the stored object and the
// attachment row; the field stays complete while at least one file remains.
export async function removeChecklistItemFile(
  itemId: string,
  attachmentId: string,
  projectId: string,
) {
  await requireProjectWork(projectId);
  await assertChecklistItemWritable(itemId);

  const attachment = await db.attachment.findFirst({
    where: { id: attachmentId, entityType: "checklist_item", entityId: itemId },
    select: { id: true, r2Key: true },
  });
  if (!attachment) throw new Error("File not found");

  if (attachment.r2Key) await deleteObject(attachment.r2Key).catch(() => {});
  await db.attachment.delete({ where: { id: attachment.id } });

  const remaining = await db.attachment.count({
    where: { entityType: "checklist_item", entityId: itemId, status: "uploaded" },
  });
  if (remaining === 0) {
    await db.taskChecklistItem.update({
      where: { id: itemId },
      data: { completed: false, completedAt: null, completedBy: null },
    });
    await clearChecklistItemEffortLock(itemId);
  } else {
    await syncChecklistItemEffortLock(itemId, true);
  }

  await publishChecklistProgress(itemId, projectId);
  revalidatePath(`/projects/${projectId}`);
  return { completed: remaining > 0 };
}

export async function removeChecklistItemAttachment(itemId: string, projectId: string) {
  await requireProjectWork(projectId);
  await assertChecklistItemWritable(itemId);

  const item = await db.taskChecklistItem.findUnique({
    where: { id: itemId },
    select: {
      textValue: true,
      type: true,
      templateItem: { select: { type: true } },
    },
  });
  const kind = item?.templateItem?.type ?? item?.type;
  const copyrightNo =
    kind === "copyright" && parseYesNoValue(item?.textValue).value === "no";
  const completed = copyrightNo;

  await db.taskChecklistItem.update({
    where: { id: itemId },
    data: {
      attachmentId: null,
      completed,
      completedAt: completed ? new Date() : null,
      ...(completed ? {} : { completedBy: null }),
    },
  });

  await syncChecklistItemEffortLock(itemId, completed);

  await publishChecklistProgress(itemId, projectId);
  revalidatePath(`/projects/${projectId}`);
}

// Older uploads may lack durationSec — the browser can read it from metadata
// after the fact; persist it so effort can use the real audio/video length.
export async function backfillAttachmentDuration(
  attachmentId: string,
  durationSec: number,
  projectId: string,
): Promise<{ updated: boolean }> {
  const access = await getProjectAccess(projectId);
  if (!access.hasAccess) throw new Error("Permission denied");
  if (!(durationSec > 0) || !Number.isFinite(durationSec)) {
    return { updated: false };
  }

  const attachment = await db.attachment.findUnique({
    where: { id: attachmentId },
    select: { id: true, durationSec: true, entityType: true, entityId: true },
  });
  if (!attachment) throw new Error("Attachment not found");
  if (attachment.durationSec != null && attachment.durationSec > 0) {
    return { updated: false };
  }

  const item = await db.taskChecklistItem.findFirst({
    where: {
      task: { projectId },
      OR: [
        { attachmentId: attachment.id },
        ...(attachment.entityType === "checklist_item"
          ? [{ id: attachment.entityId }]
          : []),
      ],
    },
    select: { id: true, completed: true, task: { select: { completedAt: true } } },
  });
  if (!item) throw new Error("Not found");

  await db.attachment.update({
    where: { id: attachmentId },
    data: { durationSec },
  });

  if (item.completed && item.task.completedAt) {
    await lockChecklistItemEffort(item.id);
  }

  return { updated: true };
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
      type: true,
      templateItem: { select: { type: true } },
      task: { select: { projectId: true } },
    },
  });
  if (!item || item.task.projectId !== projectId) throw new Error("Not found");

  const kind = item.templateItem?.type ?? item.type;

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
    attachments:
      kind === "multi_file" ? await listChecklistItemFiles(itemId) : [],
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

  // Keep the task's stored type in sync with its template set.
  await db.task.update({
    where: { id: taskId },
    data: { templateId: templateIds[0] ?? null },
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
        effortUnit: item.effortUnit,
        order: nextOrder++,
      })),
      // Racing with getTask materialisation is a no-op, not a crash.
      skipDuplicates: true,
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
