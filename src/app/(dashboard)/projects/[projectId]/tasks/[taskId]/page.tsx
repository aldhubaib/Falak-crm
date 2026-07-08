import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTask } from "@/actions/projects";
import { getTaskStatuses } from "@/actions/settings";
import { getTaskHistory, getTaskComments } from "@/actions/comments";
import { db } from "@/lib/db";
import { createPresignedGet } from "@/lib/storage";
import { getProjectAccess } from "@/lib/workspace";
import { canDeleteTaskAt } from "@/lib/permissions";
import { autoLockOrder, fieldConfig, isFieldLocked, titleLockConfig } from "@/lib/checklist-config";
import { normalizeFormats } from "@/lib/formats";
import { TaskDetailClient, type ChecklistItem } from "./task-detail-client";

// Browser tab title: "Project Name - Task title" (the route itself is
// auth-gated by middleware, so this leaks nothing to signed-out visitors).
export async function generateMetadata({
  params,
}: {
  params: Promise<{ projectId: string; taskId: string }>;
}): Promise<Metadata> {
  const { projectId, taskId } = await params;
  const task = await db.task.findFirst({
    where: { id: taskId, projectId },
    select: { title: true, project: { select: { name: true } } },
  });
  if (!task) return {};
  return { title: `${task.project.name} - ${task.title}` };
}

function parseArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
}

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; taskId: string }>;
}) {
  const { projectId, taskId } = await params;
  const task = await getTask(taskId);

  if (!task || task.project.id !== projectId) notFound();

  // Resolve attachment metadata (name + presigned preview URL) for any file
  // fields that already have an upload.
  const attachmentIds = task.checklistItems
    .map((it) => it.attachmentId)
    .filter((id): id is string => !!id);

  const attachments = attachmentIds.length
    ? await db.attachment.findMany({
        where: { id: { in: attachmentIds } },
        select: { id: true, name: true, contentType: true, r2Key: true },
      })
    : [];

  const attachmentMap = new Map(
    await Promise.all(
      attachments.map(async (a) => {
        const url = a.r2Key ? await createPresignedGet(a.r2Key) : null;
        return [
          a.id,
          { name: a.name, contentType: a.contentType, url },
        ] as const;
      }),
    ),
  );

  // Resolve stage ordering so each field's lock rule can be evaluated against
  // the task's current stage.
  const statuses = await getTaskStatuses();
  const orderById = new Map(statuses.map((s) => [s.id, s.order]));
  const todoOrder = autoLockOrder(statuses);
  const currentOrder = task.status?.order ?? null;

  const trashed = task.deletedAt !== null;

  const items: ChecklistItem[] = task.checklistItems.map((it) => {
    const att = it.attachmentId ? attachmentMap.get(it.attachmentId) : null;
    // ALL config comes from the LIVE template item when the field is linked
    // to one, so edits in Settings → Task Types (name, type, lock rules,
    // mandatory, options, file constraints, ...) take effect on existing
    // tasks immediately. The per-task copy is only a fallback for detached
    // custom fields.
    const cfg = fieldConfig(it);
    return {
      id: it.id,
      name: cfg.name,
      type: cfg.type,
      phase: cfg.phase,
      completed: it.completed,
      textValue: it.textValue,
      attachmentId: it.attachmentId,
      attachmentName: att?.name ?? null,
      attachmentUrl: att?.url ?? null,
      attachmentContentType: att?.contentType ?? null,
      mandatory: cfg.mandatory,
      options: parseArray(cfg.options),
      allowedFileTypes: cfg.allowedFileTypes,
      allowedFormats: normalizeFormats(parseArray(cfg.allowedFormats)),
      aspectRatio: cfg.aspectRatio,
      // Everything is read-only while the task sits in the trash.
      locked: trashed || isFieldLocked(cfg, currentOrder, orderById, todoOrder),
    };
  });

  const typeName =
    task.service?.name ??
    task.checklistItems.find((it) => it.templateItem?.template?.name)?.templateItem
      ?.template?.name ??
    null;

  const [history, comments, access] = await Promise.all([
    getTaskHistory(taskId),
    getTaskComments(taskId),
    getProjectAccess(projectId),
  ]);

  // Who can be @mentioned in comments: the project's team plus workspace
  // owners (owners see every project but aren't project members).
  const [projectMembers, owners, selfMember] = await Promise.all([
    db.projectMember.findMany({
      where: { projectId },
      select: { member: { select: { id: true, name: true, email: true } } },
    }),
    db.workspaceMember.findMany({
      where: { workspaceId: access.workspace.id, type: "OWNER" },
      select: { id: true, name: true, email: true },
    }),
    // Display identity for the move dialogs' ownership chips ("→ me").
    db.workspaceMember.findUnique({
      where: { id: access.member.id },
      select: { name: true, email: true, imageUrl: true },
    }),
  ]);
  const mentionableMap = new Map<string, { id: string; name: string }>();
  for (const m of [...projectMembers.map((pm) => pm.member), ...owners]) {
    mentionableMap.set(m.id, { id: m.id, name: m.name ?? m.email });
  }
  // "@all" notifies the whole thread audience — expanded server-side.
  const mentionables = [
    { id: "all", name: "all" },
    ...[...mentionableMap.values()].sort((a, b) => a.name.localeCompare(b.name)),
  ];
  const canDelete = canDeleteTaskAt(access.permissions, task.statusId);

  // Title (and other task fields) are editable with the "Modify" right for
  // the task's current stage; full project access always qualifies.
  const canModify =
    access.permissions.projects === "full" ||
    (task.statusId
      ? access.permissions.taskPermissions?.stages?.[task.statusId]?.modify ===
        true
      : false);

  // Stage lock for the built-in Title, configured on the task's type in
  // Settings → Task Types (Auto = locks once the task leaves Todo).
  const taskTemplate =
    task.checklistItems.find((it) => it.templateItem?.template)?.templateItem
      ?.template ?? null;
  const titleLocked = isFieldLocked(
    titleLockConfig(taskTemplate),
    currentOrder,
    orderById,
    todoOrder,
  );

  // Per-stage move rights for the status bar's Back/Next controls (the server
  // enforces the same rule in updateTaskStatus).
  const movePerms = {
    full: access.permissions.projects === "full",
    stages: Object.fromEntries(
      Object.entries(access.permissions.taskPermissions?.stages ?? {}).map(
        ([stageId, sp]) => [
          stageId,
          { forward: sp.forward === true, rollback: sp.rollback === true },
        ],
      ),
    ),
  };

  // Who to @mention when declining: the person who last moved the task INTO
  // its current stage (falls back to the assignee) — same rule as the board.
  const submitted = history.find(
    (h) => h.action === "status_change" && h.toStatusId === task.statusId,
  );
  const submittedBy = submitted?.member
    ? {
        id: submitted.member.id,
        name: submitted.member.name ?? submitted.member.email,
        avatar: submitted.member.imageUrl ?? null,
      }
    : task.assignee
      ? {
          id: task.assignee.id,
          name: task.assignee.name ?? task.assignee.email,
          avatar: task.assignee.imageUrl ?? null,
        }
      : { id: null, name: null, avatar: null };

  let deletedByName: string | null = null;
  if (trashed && task.deletedBy) {
    const deleter = await db.workspaceMember.findUnique({
      where: { id: task.deletedBy },
      select: { name: true, email: true },
    });
    deletedByName = deleter ? deleter.name || deleter.email : null;
  }

  return (
    <TaskDetailClient
      projectId={projectId}
      taskId={taskId}
      canDelete={!trashed && canDelete}
      canEditTitle={!trashed && canModify && !titleLocked}
      trashed={
        trashed
          ? { deletedAt: task.deletedAt!.toISOString(), deletedByName }
          : null
      }
      title={task.title}
      projectName={task.project.name}
      taskNumber={task.taskNumber}
      typeName={typeName}
      priority={task.priority}
      statusName={task.status?.name ?? null}
      statusColor={task.status?.color ?? "#3b82f6"}
      move={{
        statuses: statuses
          .filter((s) => s.name !== "Published")
          .map((s) => ({ id: s.id, name: s.name, color: s.color, order: s.order })),
        statusId: task.statusId,
        perms: movePerms,
        submittedBy,
        assignee: task.assignee
          ? {
              name: task.assignee.name ?? task.assignee.email,
              avatar: task.assignee.imageUrl ?? null,
            }
          : null,
        me: selfMember
          ? {
              name: selfMember.name ?? selfMember.email,
              avatar: selfMember.imageUrl ?? null,
            }
          : null,
      }}
      mentionables={mentionables}
      stageEnteredAt={task.stageEnteredAt?.toISOString() ?? null}
      createdAt={task.createdAt.toISOString()}
      items={items}
      comments={comments.map((c) => ({
        id: c.id,
        body: c.body,
        authorName: c.author?.name ?? c.author?.email ?? "Unknown",
        createdAt: c.createdAt.toISOString(),
        attachments: c.attachments,
      }))}
      history={history.map((h) => ({
        id: h.id,
        action: h.action,
        fromStatusName: h.fromStatusName,
        toStatusName: h.toStatusName,
        durationMs: h.durationMs,
        memberName: h.member?.name ?? h.member?.email ?? null,
        createdAt: h.createdAt.toISOString(),
      }))}
      totalTimeMs={
        Object.values((task.stageTimings as Record<string, number>) ?? {}).reduce(
          (sum, v) => sum + v,
          0,
        ) + (task.stageEnteredAt ? Date.now() - task.stageEnteredAt.getTime() : 0)
      }
    />
  );
}
