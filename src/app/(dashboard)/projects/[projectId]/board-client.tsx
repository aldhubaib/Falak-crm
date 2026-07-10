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
import { AlertCircle, Clock, Eye, EyeOff, Plus, RotateCcw, Timer, X } from "lucide-react";
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
import { TypeIcon } from "@/components/task-types/task-type-visuals";
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
import { useIsMobile } from "@/hooks/use-mobile";
import { assignTaskToMe, updateTaskStatus } from "@/actions/projects";
import { assignWeeklySlotToMe, removeWeeklySlot } from "@/actions/weekly-plan";
import { addTaskComment } from "@/actions/comments";
import { uploadManager } from "@/lib/upload-manager";
import type {
  BoardData,
  BoardStatus,
  BoardTask,
  WeeklyEmptySlot,
  WeeklyGroup,
} from "@/actions/board";
import {
  applyWeeklyDelta,
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

function CardBody({
  task,
  onSelfAssign,
}: {
  task: BoardTask;
  /** Present only when the viewer may claim this task at its current stage. */
  onSelfAssign?: () => void;
}) {
  const avatar = (
    <Avatar className="h-5 w-5">
      <AvatarImage
        src={task.assigneeAvatar ?? undefined}
        alt={task.assigneeName ?? "Unassigned"}
      />
      <AvatarFallback className="bg-muted text-[9px] font-semibold text-muted-foreground">
        {(task.assigneeName ?? "?").charAt(0).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );

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
              {onSelfAssign ? (
                <button
                  type="button"
                  aria-label="Assign this task to me"
                  // Stop pointerdown so a tap on the avatar never starts a drag,
                  // and stop click so it doesn't open the task page.
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelfAssign();
                  }}
                  className="cursor-pointer rounded-full transition-shadow hover:ring-2 hover:ring-primary/60"
                >
                  {avatar}
                </button>
              ) : (
                avatar
              )}
            </TooltipTrigger>
            <TooltipContent>
              {task.assigneeName ?? "Unassigned"}
              {onSelfAssign && (
                <span className="block opacity-70">Click to assign to me</span>
              )}
            </TooltipContent>
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

function EmptySlotCard({
  slot,
  templateName,
  slotNumber,
  templateIcon,
  templateColor,
  onSelfAssign,
  canRemove,
  onRemove,
}: {
  slot: WeeklyEmptySlot;
  templateName: string;
  slotNumber: number;
  templateIcon: string | null;
  templateColor: string | null;
  onSelfAssign?: () => void;
  canRemove?: boolean;
  onRemove?: () => void;
}) {
  const avatar = (
    <Avatar className="h-5 w-5">
      <AvatarImage
        src={slot.assigneeAvatar ?? undefined}
        alt={slot.assigneeName ?? "Unassigned"}
      />
      <AvatarFallback className="bg-muted text-[9px] font-semibold text-muted-foreground">
        {(slot.assigneeName ?? "?").charAt(0).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );

  return (
    <div className="group/slot relative rounded-lg border border-dashed border-border/80 bg-surface p-3 text-left">
      <p className="text-[13px] font-medium leading-snug text-muted-foreground/70">
        {templateName}{" "}
        <span className="text-muted-foreground/40">#{slotNumber}</span>
      </p>

      <div className="mt-2 flex items-center gap-1.5">
        <TypeIcon
          name={templateIcon}
          className="h-3.5 w-3.5 shrink-0"
          style={{ color: templateColor ?? "#f59e0b" }}
        />
        <div className="ml-auto flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              {onSelfAssign ? (
                <button
                  type="button"
                  aria-label="Assign this plan slot to me"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelfAssign();
                  }}
                  className="cursor-pointer rounded-full transition-shadow hover:ring-2 hover:ring-primary/60"
                >
                  {avatar}
                </button>
              ) : (
                avatar
              )}
            </TooltipTrigger>
            <TooltipContent>
              {slot.assigneeName ?? "Unassigned"}
              {onSelfAssign && (
                <span className="block opacity-70">Click to assign to me</span>
              )}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {canRemove && onRemove && (
        <button
          type="button"
          aria-label="Remove this slot"
          title="Remove slot (admin)"
          onClick={onRemove}
          className="absolute right-1.5 top-1.5 hidden size-5 place-items-center rounded-full text-muted-foreground/60 transition-colors hover:bg-destructive/15 hover:text-destructive group-hover/slot:grid"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

const BoardCard = memo(function BoardCard({
  task,
  onOpen,
  remoteDragger,
  dragDisabled,
  onSelfAssign,
}: {
  task: BoardTask;
  onOpen: (taskId: string) => void;
  /** Name of another user currently dragging this card, if any. */
  remoteDragger: string | null;
  /** Mobile: dragging is off so touch scrolls the board (move via task page). */
  dragDisabled: boolean;
  onSelfAssign?: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    data: { statusId: task.statusId },
    disabled: dragDisabled || remoteDragger != null,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      data-task-card
      onClick={() => onOpen(task.id)}
      style={{
        opacity: isDragging ? 0.4 : 1,
        // Virtualization: off-screen cards skip layout/paint entirely; the
        // box keeps its last rendered size so column scrolling stays stable.
        contentVisibility: "auto",
        containIntrinsicSize: "auto 120px",
      }}
      className={cn(
        "group/card relative block select-none rounded-lg border border-border/60 bg-surface p-3 text-left transition-colors hover:border-muted-foreground/20",
        // touch-none suppresses native scrolling from a touch on the card, so
        // only apply it when the card is actually draggable.
        !dragDisabled && "cursor-grab touch-none active:cursor-grabbing",
        remoteDragger && "border-primary/60 ring-1 ring-primary/40",
      )}
    >
      {remoteDragger && (
        <span className="absolute -top-2 right-2 z-10 rounded-full bg-primary px-2 py-0.5 text-[9px] font-semibold text-primary-foreground shadow-sm">
          {remoteDragger} is moving…
        </span>
      )}
      <CardBody task={task} onSelfAssign={onSelfAssign} />
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
  dragDisabled,
  canSelfAssign,
  onSelfAssign,
  weekly,
  canAssignSlot,
  onSlotSelfAssign,
  canRemoveSlot,
  onRemoveSlot,
}: {
  col: Column;
  projectId: string;
  isFirst: boolean;
  showArchived: boolean;
  onToggleArchived: () => void;
  onOpen: (taskId: string) => void;
  highlight: boolean;
  remoteDrags: RemoteDrags;
  dragDisabled: boolean;
  canSelfAssign: (task: BoardTask) => boolean;
  onSelfAssign: (task: BoardTask) => void;
  /** Weekly Plan groups — only passed to the Todo column. */
  weekly?: WeeklyGroup[];
  canAssignSlot?: boolean;
  onSlotSelfAssign?: (slot: WeeklyEmptySlot) => void;
  canRemoveSlot?: boolean;
  onRemoveSlot?: (slotId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });

  const renderCard = (task: BoardTask) => (
    <BoardCard
      key={task.id}
      task={task}
      onOpen={onOpen}
      remoteDragger={remoteDrags[task.id]?.name ?? null}
      dragDisabled={dragDisabled}
      onSelfAssign={canSelfAssign(task) ? () => onSelfAssign(task) : undefined}
    />
  );

  // Weekly Plan rendering (Todo only): tasks render as usual, and each open
  // slot for the week shows as a dashed placeholder labelled with its task
  // type and slot number (e.g. "AI VIDEO 9:16 #2").
  const weeklyGroups = weekly && weekly.length > 0 ? weekly : null;

  return (
    <div className="flex min-w-0 flex-col md:w-[312px] md:min-w-[312px] md:shrink-0">
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
        {weeklyGroups ? (
          <>
            {col.tasks.map(renderCard)}
            {weeklyGroups.flatMap((g) => {
              const filled = g.total - g.emptySlots.length;
              return g.emptySlots.map((slot, i) => (
                <EmptySlotCard
                  key={slot.id}
                  slot={slot}
                  templateName={g.templateName}
                  slotNumber={filled + i + 1}
                  templateIcon={g.templateIcon}
                  templateColor={g.templateColor}
                  onSelfAssign={
                    canAssignSlot && onSlotSelfAssign
                      ? () => onSlotSelfAssign(slot)
                      : undefined
                  }
                  canRemove={canRemoveSlot}
                  onRemove={
                    onRemoveSlot ? () => onRemoveSlot(slot.id) : undefined
                  }
                />
              ));
            })}
          </>
        ) : col.tasks.length === 0 ? (
          <div className="grid h-24 place-items-center text-xs text-muted-foreground">
            No tasks
          </div>
        ) : (
          col.tasks.map(renderCard)
        )}
      </div>
    </div>
  );
});

// ─── Board ───────────────────────────────────────────────────────────────────

// Per-stage move rights computed server-side from the member's project role.
export type BoardMovePerms = {
  full: boolean;
  stages: Record<
    string,
    { forward: boolean; rollback: boolean; modify: boolean }
  >;
};

export function ProjectBoardClient({
  projectId,
  initialData,
  movePerms,
  currentMemberId,
  currentMemberName,
  currentMemberAvatar,
}: {
  projectId: string;
  initialData: BoardData;
  movePerms: BoardMovePerms;
  currentMemberId?: string;
  currentMemberName?: string;
  currentMemberAvatar?: string | null;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  // Mobile: the board stacks into one scrollable column — dragging would fight
  // touch scrolling, so it's disabled and tasks move via the task page's
  // status bar instead.
  const isMobile = useIsMobile();

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
  // Task whose avatar was clicked — pending the "assign to me" confirmation.
  const [assignTarget, setAssignTarget] = useState<BoardTask | null>(null);
  const [assignSlotTarget, setAssignSlotTarget] =
    useState<WeeklyEmptySlot | null>(null);
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

  // Drag-to-pan: grabbing empty board space with the mouse scrolls the row
  // sideways. Task cards and interactive elements are excluded so card drags
  // and clicks behave exactly as before.
  const panScrollRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{ startX: number; startScroll: number } | null>(null);
  const onPanPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (isMobile || e.pointerType !== "mouse" || e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (target.closest("[data-task-card],button,a,input,textarea")) return;
      const el = panScrollRef.current;
      if (!el) return;
      panRef.current = { startX: e.clientX, startScroll: el.scrollLeft };
      el.setPointerCapture(e.pointerId);
    },
    [isMobile],
  );
  const onPanPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const pan = panRef.current;
      const el = panScrollRef.current;
      if (!pan || !el) return;
      el.scrollLeft = pan.startScroll - (e.clientX - pan.startX);
    },
    [],
  );
  const onPanPointerEnd = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!panRef.current) return;
      panRef.current = null;
      panScrollRef.current?.releasePointerCapture(e.pointerId);
    },
    [],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const moveMutation = useMutation({
    mutationFn: (vars: { taskId: string; statusId: string }) =>
      updateTaskStatus(
        vars.taskId,
        vars.statusId,
        projectId,
        undefined,
        clientId,
      ).then((result) => {
        // Blocked moves come back as data (not a thrown error) so the message
        // survives production builds — rethrow here to reuse the error path.
        if (!result.ok) throw new Error(result.error);
        return result;
      }),
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
    // forward, auto-assign stages, previous owner on rejection) plus any
    // Weekly Plan slot change. Patch the cache from the result — no
    // invalidate-and-refetch; remote boards sync via the realtime patch.
    onSuccess: (result, vars) => {
      queryClient.setQueryData<BoardData>(boardQueryKey(projectId), (old) => {
        if (!old) return old;
        const withTask = {
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
        return applyWeeklyDelta(withTask, result.weekly);
      });
    },
  });

  const moveTask = useCallback(
    (taskId: string, statusId: string) => {
      moveMutation.mutate({ taskId, statusId });
    },
    [moveMutation],
  );

  // Claim a task by clicking its avatar. Offered only when the viewer holds
  // the "Modify" right for the task's current stage (server re-checks).
  const canSelfAssign = useCallback(
    (task: BoardTask) => {
      if (movePerms.full) return true;
      if (!task.statusId) return false;
      return movePerms.stages[task.statusId]?.modify === true;
    },
    [movePerms],
  );

  const selfAssignMutation = useMutation({
    mutationFn: (taskId: string) => assignTaskToMe(taskId, projectId),
    onMutate: async (taskId) => {
      const key = boardQueryKey(projectId);
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<BoardData>(key);
      queryClient.setQueryData<BoardData>(key, (old) => {
        if (!old) return old;
        return {
          ...old,
          tasks: old.tasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  assigneeId: currentMemberId ?? t.assigneeId,
                  assigneeName: currentMemberName ?? t.assigneeName,
                  assigneeAvatar: currentMemberAvatar ?? null,
                }
              : t,
          ),
        };
      });
      return { prev };
    },
    onError: (_err, _taskId, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(boardQueryKey(projectId), ctx.prev);
      setMoveError("The task couldn't be assigned to you. Please try again.");
    },
    // No onSettled invalidate: the optimistic patch above is the final state
    // and remote boards sync via the task.updated broadcast.
  });

  const openSelfAssign = useCallback((task: BoardTask) => {
    setAssignTarget(task);
  }, []);

  const todoStatusId = useMemo(
    () => statuses.find((s) => s.name === "Todo")?.id,
    [statuses],
  );

  const canAssignSlot = useMemo(
    () =>
      movePerms.full ||
      (todoStatusId
        ? movePerms.stages[todoStatusId]?.modify === true
        : false),
    [movePerms, todoStatusId],
  );

  const slotSelfAssignMutation = useMutation({
    mutationFn: (slotId: string) => assignWeeklySlotToMe(slotId, projectId),
    onMutate: async (slotId) => {
      const key = boardQueryKey(projectId);
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<BoardData>(key);
      queryClient.setQueryData<BoardData>(key, (old) => {
        if (!old) return old;
        return {
          ...old,
          weekly: old.weekly.map((g) => ({
            ...g,
            emptySlots: g.emptySlots.map((s) =>
              s.id === slotId
                ? {
                    ...s,
                    assigneeId: currentMemberId ?? s.assigneeId,
                    assigneeName: currentMemberName ?? s.assigneeName,
                    assigneeAvatar: currentMemberAvatar ?? null,
                  }
                : s,
            ),
          })),
        };
      });
      return { prev };
    },
    onError: (_err, _slotId, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(boardQueryKey(projectId), ctx.prev);
      setMoveError(
        "The plan slot couldn't be assigned to you. Please try again.",
      );
    },
  });

  const openSlotSelfAssign = useCallback((slot: WeeklyEmptySlot) => {
    setAssignSlotTarget(slot);
  }, []);

  // Admin-only: drop one of this week's open Todo slots. Optimistic — the
  // placeholder disappears immediately and comes back if the server refuses.
  const removeSlotMutation = useMutation({
    mutationFn: (slotId: string) => removeWeeklySlot(slotId, projectId),
    onMutate: async (slotId) => {
      const key = boardQueryKey(projectId);
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<BoardData>(key);
      queryClient.setQueryData<BoardData>(key, (old) => {
        if (!old) return old;
        return {
          ...old,
          weekly: old.weekly.map((g) =>
            g.emptySlots.some((s) => s.id === slotId)
              ? {
                  ...g,
                  total: g.total - 1,
                  emptySlots: g.emptySlots.filter((s) => s.id !== slotId),
                }
              : g,
          ),
        };
      });
      return { prev };
    },
    onError: (_err, _slotId, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(boardQueryKey(projectId), ctx.prev);
      setMoveError("The slot couldn't be removed. Please try again.");
    },
    // No onSettled invalidate: the optimistic removal is the final state.
  });
  const removeSlot = useCallback(
    (slotId: string) => removeSlotMutation.mutate(slotId),
    [removeSlotMutation],
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

        // Delivery items are produced during AI Generation and only need to be
        // complete when submitting for Internal Review — not on earlier forward
        // moves like Todo → AI Generation.
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
              setMoveError(
                `This task's delivery items aren't complete yet, so it can't be submitted for review. Still missing: ${names}. If you believe this is a mistake, please contact the task creator.`,
              );
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
  // Current owner shown in the confirm dialog's ownership hand-off chips.
  const confirmTask = confirmMove
    ? (tasks.find((t) => t.id === confirmMove.taskId) ?? null)
    : null;

  return (
    <TooltipProvider delayDuration={150}>
      <DndContext
        // Stable id — dnd-kit's auto-generated counter id differs between
        // server and client renders and trips React hydration.
        id={`board-${projectId}`}
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
        {/* Desktop: fixed-width columns in one horizontally scrollable row —
            grab empty space to pan it sideways. Mobile: stages stack
            vertically (dragging is off there anyway). */}
        <div
          ref={panScrollRef}
          onPointerDown={onPanPointerDown}
          onPointerMove={onPanPointerMove}
          onPointerUp={onPanPointerEnd}
          onPointerCancel={onPanPointerEnd}
          className="flex min-h-[calc(100vh-3.5rem)] flex-col gap-4 p-5 md:cursor-grab md:flex-row md:overflow-x-auto md:active:cursor-grabbing"
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
              dragDisabled={isMobile}
              canSelfAssign={canSelfAssign}
              onSelfAssign={openSelfAssign}
              weekly={col.name === "Todo" ? data.weekly : undefined}
              canAssignSlot={canAssignSlot}
              onSlotSelfAssign={openSlotSelfAssign}
              canRemoveSlot={movePerms.full}
              onRemoveSlot={removeSlot}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask ? (
            <div className="w-full cursor-grabbing rounded-lg border border-primary/40 bg-surface p-3 shadow-lg">
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
          if (confirmMove)
            moveTask(confirmMove.taskId, confirmMove.toStatusId);
          setConfirmMove(null);
        }}
        title={confirmMsg?.title ?? ""}
        description={confirmMsg?.description ?? ""}
        confirmLabel={confirmMsg?.confirmLabel}
        assignToMe={!!confirmMsg?.assignToMe}
        currentAssigneeName={confirmTask?.assigneeName}
        currentAssigneeAvatar={confirmTask?.assigneeAvatar}
        meName={currentMemberName}
        meAvatar={currentMemberAvatar}
      />

      {/* Avatar click — assign task to me */}
      <ConfirmStatusDialog
        open={assignTarget !== null}
        onClose={() => setAssignTarget(null)}
        onConfirm={() => {
          if (assignTarget) selfAssignMutation.mutate(assignTarget.id);
          setAssignTarget(null);
        }}
        title="Assign to me"
        description="By confirming, this task will be assigned to you and you take ownership of it."
        confirmLabel="Assign to Me"
        assignToMe
        currentAssigneeName={assignTarget?.assigneeName}
        currentAssigneeAvatar={assignTarget?.assigneeAvatar}
        meName={currentMemberName}
        meAvatar={currentMemberAvatar}
      />

      {/* Avatar click — assign weekly plan slot to me */}
      <ConfirmStatusDialog
        open={assignSlotTarget !== null}
        onClose={() => setAssignSlotTarget(null)}
        onConfirm={() => {
          if (assignSlotTarget) slotSelfAssignMutation.mutate(assignSlotTarget.id);
          setAssignSlotTarget(null);
        }}
        title="Assign to me"
        description="By confirming, this weekly plan slot will count toward your responsibility."
        confirmLabel="Assign to Me"
        assignToMe
        currentAssigneeName={assignSlotTarget?.assigneeName}
        currentAssigneeAvatar={assignSlotTarget?.assigneeAvatar}
        meName={currentMemberName}
        meAvatar={currentMemberAvatar}
      />

      {/* Backward move decline */}
      <DeclineDialog
        open={declineMove !== null}
        fromLabel={declineMove?.fromName ?? ""}
        toLabel={declineMove?.toName ?? ""}
        mentionName={declineMove?.mentionName ?? null}
        meName={currentMemberName}
        meAvatar={currentMemberAvatar}
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
