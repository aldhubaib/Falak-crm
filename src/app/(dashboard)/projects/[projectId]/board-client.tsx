"use client";

import { memo, useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragCancelEvent,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Clock, Eye, EyeOff, Plus, RotateCcw, Timer } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PriorityBadge } from "@/components/priority-badge";
import { TaskTypeIcon } from "@/components/task-type-chip";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmStatusDialog } from "@/components/board/confirm-status-dialog";
import { DeclineDialog } from "@/components/board/decline-dialog";
import { CONFIRM_MESSAGES } from "@/components/board/confirm-messages";
import { cn } from "@/lib/utils";
import { updateTaskStatus } from "@/actions/projects";
import { addTaskComment } from "@/actions/comments";
import { uploadManager } from "@/lib/upload-manager";
import type { BoardData, BoardStatus, BoardTask } from "@/actions/board";
import {
  boardQueryKey,
  useBoardData,
  useBoardStream,
  type RemoteDrags,
} from "./use-board";

// Completed tasks auto-archive after this many days; archived tasks are hidden
// in their column until the eye toggle reveals them.
const ARCHIVE_AFTER_DAYS = 10;

type PendingMove = { taskId: string; toStatusId: string } | null;

type Column = BoardStatus & {
  tasks: BoardTask[];
  total: number;
  archivedCount: number;
};

function formatDuration(ms: number): string {
  if (ms < 0) return "0s";
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

function formatSince(iso: string) {
  return formatDuration(Date.now() - new Date(iso).getTime());
}

// ─── Card ────────────────────────────────────────────────────────────────────

function CardBody({ task }: { task: BoardTask }) {
  return (
    <div className="min-w-0">
      <span className="text-[10px] font-mono text-muted-foreground/60">
        T-{String(task.taskNumber).padStart(3, "0")}
      </span>
      <p className="text-[13px] font-medium leading-snug text-foreground">
        {task.title || "Untitled"}
      </p>

      <div className="mt-2 flex items-center gap-1.5">
        {task.serviceName && <TaskTypeIcon name={task.serviceName} />}
        <PriorityBadge value={task.priority} />
        {task.rejectionCount > 0 && (
          <span
            className="inline-flex items-center gap-1 rounded-md bg-destructive/15 px-1.5 py-0.5 text-[10px] font-semibold text-destructive"
            title={`Rejected ${task.rejectionCount} time${task.rejectionCount > 1 ? "s" : ""}`}
          >
            <RotateCcw className="h-3 w-3" />
            {task.rejectionCount}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Avatar className="h-5 w-5">
                <AvatarImage
                  src={task.assigneeAvatar ?? undefined}
                  alt={task.assigneeName ?? "Unassigned"}
                />
                <AvatarFallback className="bg-muted text-[9px] font-semibold text-muted-foreground">
                  {(task.assigneeName ?? "?").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent>{task.assigneeName ?? "Unassigned"}</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {(task.totalTimeMs > 0 || task.stageEnteredAt) && (
        <div className="mt-2 flex items-center gap-3 text-[10px] font-mono tabular-nums text-muted-foreground/60">
          {task.totalTimeMs > 0 && (
            <span className="flex items-center gap-1" title="Total time">
              <Clock className="h-3 w-3" />
              {formatDuration(task.totalTimeMs)}
            </span>
          )}
          {task.stageEnteredAt && (
            <span className="flex items-center gap-1" title="Time in current stage">
              <Timer className="h-3 w-3" />
              {formatSince(task.stageEnteredAt)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

const BoardCard = memo(function BoardCard({
  task,
  onOpen,
  remoteDragger,
}: {
  task: BoardTask;
  onOpen: (taskId: string) => void;
  /** Name of another user currently dragging this card, if any. */
  remoteDragger: string | null;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    data: { statusId: task.statusId },
    disabled: remoteDragger != null,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => onOpen(task.id)}
      style={{ opacity: isDragging ? 0.4 : 1 }}
      className={cn(
        "group/card relative block cursor-grab touch-none select-none rounded-lg border border-border/60 bg-background p-3 text-left transition-colors hover:border-muted-foreground/20 active:cursor-grabbing",
        remoteDragger && "border-primary/60 ring-1 ring-primary/40",
      )}
    >
      {remoteDragger && (
        <span className="absolute -top-2 right-2 z-10 rounded-full bg-primary px-2 py-0.5 text-[9px] font-semibold text-primary-foreground shadow-sm">
          {remoteDragger} is moving…
        </span>
      )}
      <CardBody task={task} />
    </div>
  );
});

// ─── Column ──────────────────────────────────────────────────────────────────

const BoardColumn = memo(function BoardColumn({
  col,
  projectId,
  isFirst,
  showArchived,
  onToggleArchived,
  onOpen,
  highlight,
  remoteDrags,
}: {
  col: Column;
  projectId: string;
  isFirst: boolean;
  showArchived: boolean;
  onToggleArchived: () => void;
  onOpen: (taskId: string) => void;
  highlight: boolean;
  remoteDrags: RemoteDrags;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });

  return (
    <div className="flex min-w-0 flex-col">
      <div className="mb-3 flex h-6 items-center gap-2 whitespace-nowrap text-xs font-semibold uppercase tracking-[0.14em]">
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: col.color }}
        />
        <span className="text-foreground">{col.name}</span>
        <span className="text-muted-foreground">
          {col.archivedCount > 0 && !showArchived
            ? `${col.tasks.length} of ${col.total}`
            : col.tasks.length}
        </span>
        {isFirst && (
          <Button
            asChild
            size="icon"
            className="ml-auto h-6 w-6 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
            aria-label="New task"
          >
            <Link href={`/projects/${projectId}/tasks/new`}>
              <Plus className="h-3.5 w-3.5" />
            </Link>
          </Button>
        )}
        {col.archivedCount > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto h-6 w-6 rounded-full text-muted-foreground hover:text-foreground"
            onClick={onToggleArchived}
            aria-label={
              showArchived
                ? `Hide ${col.archivedCount} archived`
                : `Show ${col.archivedCount} archived`
            }
            title={
              showArchived
                ? `Hide archived (${col.archivedCount})`
                : `Show archived (${col.archivedCount})`
            }
          >
            {showArchived ? (
              <Eye className="h-3.5 w-3.5" />
            ) : (
              <EyeOff className="h-3.5 w-3.5" />
            )}
          </Button>
        )}
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 space-y-2 rounded-lg border border-dotted p-2 min-h-24 transition-colors",
          highlight ? "border-primary/40 bg-primary/5" : "border-transparent",
          isOver && "border-primary bg-primary/10",
        )}
      >
        {col.tasks.length === 0 ? (
          <div className="grid h-24 place-items-center text-xs text-muted-foreground">
            No tasks
          </div>
        ) : (
          col.tasks.map((task) => (
            <BoardCard
              key={task.id}
              task={task}
              onOpen={onOpen}
              remoteDragger={remoteDrags[task.id]?.name ?? null}
            />
          ))
        )}
      </div>
    </div>
  );
});

// ─── Board ───────────────────────────────────────────────────────────────────

// Per-stage move rights computed server-side from the member's project role.
export type BoardMovePerms = {
  full: boolean;
  stages: Record<string, { forward: boolean; rollback: boolean }>;
};

export function ProjectBoardClient({
  projectId,
  initialData,
  movePerms,
  currentMemberName,
}: {
  projectId: string;
  initialData: BoardData;
  movePerms: BoardMovePerms;
  currentMemberName?: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Stable per-tab id so this client can ignore the SSE echo of its own moves.
  const [clientId] = useState(() =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2),
  );

  const { data } = useBoardData(projectId, initialData);
  const { remoteDrags, publishDrag } = useBoardStream(
    projectId,
    clientId,
    currentMemberName,
  );

  const tasks = data.tasks;
  const statuses = data.statuses;

  const [activeId, setActiveId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [confirmMove, setConfirmMove] = useState<PendingMove>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [declineMove, setDeclineMove] = useState<{
    taskId: string;
    toStatusId: string;
    fromName: string;
    toName: string;
    mentionId: string | null;
    mentionName: string | null;
  } | null>(null);

  // Suppress the synthetic click that fires right after a drag so a drop
  // doesn't also navigate into the task.
  const justDraggedRef = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const moveMutation = useMutation({
    mutationFn: (vars: { taskId: string; statusId: string }) =>
      updateTaskStatus(vars.taskId, vars.statusId, projectId, undefined, clientId),
    onMutate: async (vars) => {
      const key = boardQueryKey(projectId);
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<BoardData>(key);
      queryClient.setQueryData<BoardData>(key, (old) => {
        if (!old) return old;
        const target = old.statuses.find((s) => s.id === vars.statusId);
        return {
          ...old,
          tasks: old.tasks.map((t) =>
            t.id === vars.taskId
              ? {
                  ...t,
                  statusId: vars.statusId,
                  statusName: target?.name ?? t.statusName,
                  statusColor: target?.color ?? t.statusColor,
                  stageEnteredAt: new Date().toISOString(),
                }
              : t,
          ),
        };
      });
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(boardQueryKey(projectId), ctx.prev);
      setMoveError(err instanceof Error ? err.message : "Failed to move task");
    },
    // The server resolves who owns the task after a move (self-assign going
    // forward, auto-assign stages, previous owner on rejection). Patch the
    // card immediately instead of waiting for the background refetch.
    onSuccess: (result, vars) => {
      queryClient.setQueryData<BoardData>(boardQueryKey(projectId), (old) => {
        if (!old) return old;
        return {
          ...old,
          tasks: old.tasks.map((t) =>
            t.id === vars.taskId
              ? {
                  ...t,
                  assigneeId: result.assignee?.id ?? null,
                  assigneeName: result.assignee?.name ?? null,
                  assigneeAvatar: result.assignee?.imageUrl ?? null,
                }
              : t,
          ),
        };
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: boardQueryKey(projectId) });
    },
  });

  const moveTask = useCallback(
    (taskId: string, statusId: string) => {
      moveMutation.mutate({ taskId, statusId });
    },
    [moveMutation],
  );

  // Decline a task backward: record the reason as a comment that @mentions the
  // person who submitted it (locked in the dialog), then move it back. The move
  // fires immediately; an attached file uploads in the background and the
  // comment posts once its bytes are up so the attachment is never dropped.
  const declineTask = useCallback(
    async (
      taskId: string,
      statusId: string,
      reason: string,
      mention: { id: string | null; name: string | null },
      file: File | null,
    ) => {
      moveMutation.mutate({ taskId, statusId });

      const prefix =
        mention.id && mention.name ? `@[${mention.name}](${mention.id}) ` : "";
      const body = `${prefix}${reason}`.trim();
      if (!body && !file) return;
      try {
        let attachmentIds: string[] = [];
        if (file) {
          const ids = uploadManager.enqueueMessage([file]);
          const items = await uploadManager.waitForCompletion(ids);
          attachmentIds = items
            .filter((i) => i.status === "done" && i.attachmentId)
            .map((i) => i.attachmentId!);
          uploadManager.removeItems(ids);
        }
        await addTaskComment(taskId, body, projectId, "rejection", attachmentIds);
      } catch {
        // Comment failure shouldn't block the move.
      }
    },
    [moveMutation, projectId],
  );

  const archiveCutoff = Date.now() - ARCHIVE_AFTER_DAYS * 24 * 60 * 60 * 1000;
  const isArchived = useCallback(
    (t: BoardTask) =>
      t.completedAt != null && new Date(t.completedAt).getTime() < archiveCutoff,
    [archiveCutoff],
  );

  const grouped: Column[] = useMemo(() => {
    const groupTasks = (all: BoardTask[]) => {
      const archivedCount = all.filter(isArchived).length;
      const visible = showArchived ? all : all.filter((t) => !isArchived(t));
      return { tasks: visible, total: all.length, archivedCount };
    };

    const cols: Column[] = statuses.map((s) => ({
      ...s,
      ...groupTasks(tasks.filter((t) => t.statusId === s.id)),
    }));

    const unassigned = tasks.filter(
      (t) => !statuses.some((s) => s.id === t.statusId),
    );
    if (unassigned.length > 0) {
      cols.unshift({
        id: "unassigned",
        name: "Unassigned",
        color: "#6b7280",
        order: -1,
        ...groupTasks(unassigned),
      });
    }
    return cols;
  }, [statuses, tasks, showArchived, isArchived]);

  const statusOrderMap = useMemo(
    () => new Map(statuses.map((s) => [s.id, s.order])),
    [statuses],
  );

  const handleDrop = useCallback(
    (taskId: string, targetStatusId: string) => {
      if (targetStatusId === "unassigned") return;

      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;
      if (task.statusId === targetStatusId) return;

      const fromOrder = task.statusId
        ? (statusOrderMap.get(task.statusId) ?? -1)
        : -1;
      const toOrder = statusOrderMap.get(targetStatusId) ?? -1;
      const targetStatus = statuses.find((s) => s.id === targetStatusId);
      const targetName = targetStatus?.name ?? "";

      // Stage-level move rights (mirrors the server check in updateTaskStatus):
      // the role's Forward/Rollback flag on the task's CURRENT stage decides.
      if (!movePerms.full && task.statusId) {
        const stage = movePerms.stages[task.statusId];
        const allowed = toOrder > fromOrder ? stage?.forward : stage?.rollback;
        if (!allowed) {
          const fromName =
            statuses.find((s) => s.id === task.statusId)?.name ?? "this stage";
          setMoveError(
            `You don't have permission to move tasks ${
              toOrder > fromOrder ? "forward" : "back"
            } from ${fromName}`,
          );
          return;
        }
      }

      if (toOrder > fromOrder) {
        const proceedForward = () => {
          const msg = CONFIRM_MESSAGES[targetName];
          if (msg) {
            setConfirmMove({ taskId, toStatusId: targetStatusId });
          } else {
            moveTask(taskId, targetStatusId);
          }
        };

        // Delivery items are produced during In Progress and only need to be
        // complete when submitting for Internal Review — not on earlier forward
        // moves like Todo → In Progress.
        if (
          targetName.toLowerCase() === "internal review" &&
          task.deliveryIncomplete.length > 0
        ) {
          // The cache may be stale (e.g. an upload finished moments ago and
          // the broadcast was missed) — never block on cached data alone.
          // Refetch, re-check against fresh data, and only then show the error.
          void (async () => {
            await queryClient.refetchQueries({
              queryKey: boardQueryKey(projectId),
            });
            const fresh = queryClient.getQueryData<BoardData>(
              boardQueryKey(projectId),
            );
            const freshTask = fresh?.tasks.find((t) => t.id === taskId);
            const incomplete =
              freshTask?.deliveryIncomplete ?? task.deliveryIncomplete;
            if (incomplete.length > 0) {
              const names = incomplete.map((n) => `"${n}"`).join(", ");
              setMoveError(`Complete delivery items first: ${names}`);
              return;
            }
            proceedForward();
          })();
          return;
        }
        proceedForward();
      } else if (toOrder < fromOrder) {
        const fromStatus = task.statusId
          ? statuses.find((s) => s.id === task.statusId)
          : null;
        setDeclineMove({
          taskId,
          toStatusId: targetStatusId,
          fromName: fromStatus?.name ?? "Unknown",
          toName: targetName,
          mentionId: task.submittedById,
          mentionName: task.submittedByName,
        });
      }
    },
    [tasks, statuses, statusOrderMap, moveTask, movePerms, queryClient, projectId],
  );

  const openTask = useCallback(
    (taskId: string) => {
      if (justDraggedRef.current) return;
      router.push(`/projects/${projectId}/tasks/${taskId}`);
    },
    [router, projectId],
  );

  const onDragStart = useCallback(
    (e: DragStartEvent) => {
      const taskId = String(e.active.id);
      setActiveId(taskId);
      // Tell every other open board that this card is being dragged.
      publishDrag(taskId, true);
    },
    [publishDrag],
  );

  const onDragEnd = useCallback(
    (e: DragEndEvent) => {
      justDraggedRef.current = true;
      setTimeout(() => {
        justDraggedRef.current = false;
      }, 0);
      const overId = e.over ? String(e.over.id) : null;
      const taskId = String(e.active.id);
      setActiveId(null);
      publishDrag(taskId, false);
      if (overId) handleDrop(taskId, overId);
    },
    [handleDrop, publishDrag],
  );

  const onDragCancel = useCallback(
    (e: DragCancelEvent) => {
      setActiveId(null);
      publishDrag(String(e.active.id), false);
    },
    [publishDrag],
  );

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) ?? null : null;
  const activeSourceCol = activeTask?.statusId ?? "unassigned";

  const confirmTarget = confirmMove
    ? statuses.find((s) => s.id === confirmMove.toStatusId)
    : null;
  const confirmMsg = confirmTarget
    ? (CONFIRM_MESSAGES[confirmTarget.name] ?? {
        title: `Move to ${confirmTarget.name}`,
        description: `Are you sure you want to move this task to ${confirmTarget.name}?`,
      })
    : null;

  return (
    <TooltipProvider delayDuration={150}>
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
        <div
          className={cn(
            "grid min-h-[calc(100vh-3.5rem)] gap-4 p-5",
            grouped.length <= 3
              ? "grid-cols-1 sm:grid-cols-3"
              : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5",
          )}
        >
          {grouped.map((col, i) => (
            <BoardColumn
              key={col.id}
              col={col}
              projectId={projectId}
              isFirst={i === 0}
              showArchived={showArchived}
              onToggleArchived={() => setShowArchived((v) => !v)}
              onOpen={openTask}
              highlight={activeId != null && activeSourceCol !== col.id}
              remoteDrags={remoteDrags}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask ? (
            <div className="w-full cursor-grabbing rounded-lg border border-primary/40 bg-background p-3 shadow-lg">
              <CardBody task={activeTask} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Forward move confirmation */}
      <ConfirmStatusDialog
        open={confirmMove !== null}
        onClose={() => setConfirmMove(null)}
        onConfirm={() => {
          if (confirmMove) moveTask(confirmMove.taskId, confirmMove.toStatusId);
          setConfirmMove(null);
        }}
        title={confirmMsg?.title ?? ""}
        description={confirmMsg?.description ?? ""}
        confirmLabel={confirmMsg?.confirmLabel}
      />

      {/* Backward move decline */}
      <DeclineDialog
        open={declineMove !== null}
        fromLabel={declineMove?.fromName ?? ""}
        toLabel={declineMove?.toName ?? ""}
        mentionName={declineMove?.mentionName ?? null}
        onClose={() => setDeclineMove(null)}
        onConfirm={(reason, file) => {
          if (declineMove)
            declineTask(
              declineMove.taskId,
              declineMove.toStatusId,
              reason,
              { id: declineMove.mentionId, name: declineMove.mentionName },
              file,
            );
          setDeclineMove(null);
        }}
      />

      {/* Move error dialog */}
      <Dialog open={!!moveError} onOpenChange={(o) => !o && setMoveError(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Cannot move task
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{moveError}</p>
          <DialogFooter>
            <Button onClick={() => setMoveError(null)}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
