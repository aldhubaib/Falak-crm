"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Clock, Eye, EyeOff, Plus, Timer } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PriorityBadge } from "@/components/priority-badge";
import { TaskTypeChip } from "@/components/task-type-chip";
import { ConfirmStatusDialog } from "@/components/board/confirm-status-dialog";
import { DeclineDialog } from "@/components/board/decline-dialog";
import { cn } from "@/lib/utils";
import { updateTaskStatus } from "@/actions/projects";

type TaskCard = {
  id: string;
  title: string;
  statusId: string | null;
  statusName: string;
  statusColor: string;
  assigneeName: string | null;
  assigneeAvatar: string | null;
  serviceName: string | null;
  priority: number | null;
  estimateMin: number | null;
  stageEnteredAt: string | null;
  completedAt: string | null;
  createdAt: string;
  checklistTotal: number;
  checklistDone: number;
};

// Completed tasks auto-archive after this many days; archived tasks are hidden
// in their column until the eye toggle reveals them.
const ARCHIVE_AFTER_DAYS = 10;

type Status = {
  id: string;
  name: string;
  color: string;
  order: number;
};

type PendingMove = { taskId: string; toStatusId: string } | null;

const CONFIRM_MESSAGES: Record<
  string,
  { title: string; description: string; confirmLabel?: string }
> = {
  "In Progress": {
    title: "Move to In Progress",
    description:
      "By confirming, you acknowledge that you understand the requirements and are taking ownership of this task.",
    confirmLabel: "I Understand",
  },
  "Internal Review": {
    title: "Submit for Internal Review",
    description:
      "I confirm that all requirements have been completed, checked, and are ready for internal review.",
  },
  Review: {
    title: "Send to Review",
    description:
      "I confirm that all requirements have been completed and meet our quality standards.",
  },
  Completed: {
    title: "Mark as Completed",
    description:
      "I confirm that the client has approved this task and it is ready to be marked as completed.",
  },
};

function formatSince(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.max(1, Math.floor(ms / 60000));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

export function ProjectBoardClient({
  projectId,
  tasks,
  statuses,
}: {
  projectId: string;
  tasks: TaskCard[];
  statuses: Status[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [dragOver, setDragOver] = useState<string | null>(null);
  const [dragSource, setDragSource] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [confirmMove, setConfirmMove] = useState<PendingMove>(null);
  const [declineMove, setDeclineMove] = useState<{
    taskId: string;
    toStatusId: string;
    fromName: string;
    toName: string;
  } | null>(null);

  const moveTask = (taskId: string, statusId: string) => {
    startTransition(async () => {
      await updateTaskStatus(taskId, statusId, projectId);
      router.refresh();
    });
  };

  const archiveCutoff = Date.now() - ARCHIVE_AFTER_DAYS * 24 * 60 * 60 * 1000;
  const isArchived = (t: TaskCard) =>
    t.completedAt != null && new Date(t.completedAt).getTime() < archiveCutoff;

  const groupTasks = (all: TaskCard[]) => {
    const archivedCount = all.filter(isArchived).length;
    const visible = showArchived ? all : all.filter((t) => !isArchived(t));
    return { tasks: visible, total: all.length, archivedCount };
  };

  const grouped = statuses.map((s) => ({
    ...s,
    ...groupTasks(tasks.filter((t) => t.statusId === s.id)),
  }));

  const unassigned = tasks.filter(
    (t) => !statuses.some((s) => s.id === t.statusId),
  );
  if (unassigned.length > 0) {
    grouped.unshift({
      id: "unassigned",
      name: "Unassigned",
      color: "#6b7280",
      order: -1,
      ...groupTasks(unassigned),
    });
  }

  const statusOrderMap = new Map(statuses.map((s) => [s.id, s.order]));

  const handleDrop = (taskId: string, targetStatusId: string) => {
    if (targetStatusId === "unassigned") return;

    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const fromOrder = task.statusId
      ? (statusOrderMap.get(task.statusId) ?? -1)
      : -1;
    const toOrder = statusOrderMap.get(targetStatusId) ?? -1;
    const targetStatus = statuses.find((s) => s.id === targetStatusId);
    const targetName = targetStatus?.name ?? "";

    if (toOrder > fromOrder) {
      const msg = CONFIRM_MESSAGES[targetName];
      if (msg) {
        setConfirmMove({ taskId, toStatusId: targetStatusId });
      } else {
        moveTask(taskId, targetStatusId);
      }
    } else if (toOrder < fromOrder) {
      const fromStatus = task.statusId
        ? statuses.find((s) => s.id === task.statusId)
        : null;
      setDeclineMove({
        taskId,
        toStatusId: targetStatusId,
        fromName: fromStatus?.name ?? "Unknown",
        toName: targetName,
      });
    }
  };

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
      <div
        className={cn(
          "grid min-h-[calc(100vh-3.5rem)] gap-4 p-5",
          grouped.length <= 3
            ? "grid-cols-1 sm:grid-cols-3"
            : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5",
        )}
      >
        {grouped.map((col) => (
          <div key={col.id} className="flex min-w-0 flex-col">
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
              {col === grouped[0] && (
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
                  onClick={() => setShowArchived((v) => !v)}
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
              className={cn(
                "flex-1 space-y-2 rounded-lg border border-dotted p-2 min-h-24 transition-colors",
                dragSource && dragSource !== col.id
                  ? "border-primary/40 bg-primary/5"
                  : "border-transparent",
                dragOver === col.id && "border-primary bg-primary/10",
              )}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (dragOver !== col.id) setDragOver(col.id);
              }}
              onDragLeave={(e) => {
                if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                setDragOver((s) => (s === col.id ? null : s));
              }}
              onDrop={(e) => {
                e.preventDefault();
                const taskId = e.dataTransfer.getData("text/task-id");
                setDragOver(null);
                setDragSource(null);
                if (!taskId) return;
                handleDrop(taskId, col.id);
              }}
            >
              {col.tasks.length === 0 ? (
                <div className="grid h-24 place-items-center text-xs text-muted-foreground">
                  No tasks
                </div>
              ) : (
                col.tasks.map((task) => (
                  <Link
                    key={task.id}
                    href={`/projects/${projectId}/tasks/${task.id}`}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/task-id", task.id);
                      e.dataTransfer.effectAllowed = "move";
                      setDragSource(task.statusId ?? "unassigned");
                    }}
                    onDragEnd={() => {
                      setDragSource(null);
                      setDragOver(null);
                    }}
                    className="block cursor-grab rounded-md border border-border/60 bg-surface p-3 text-left transition-colors hover:border-border active:cursor-grabbing"
                  >
                    {task.serviceName && (
                      <div className="mb-2">
                        <TaskTypeChip name={task.serviceName} />
                      </div>
                    )}

                    <div className="text-xs font-medium text-foreground">
                      {task.title || "Untitled"}
                    </div>

                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                      {task.estimateMin != null && (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" strokeWidth={1.5} />
                          {task.estimateMin}m
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <Timer className="h-3.5 w-3.5" strokeWidth={1.5} />
                        {formatSince(task.stageEnteredAt ?? task.createdAt)}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <PriorityBadge value={task.priority} />
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Avatar className="ml-auto h-6 w-6 ring-1 ring-primary/30">
                            <AvatarImage
                              src={
                                task.assigneeAvatar ??
                                (task.assigneeName
                                  ? `https://i.pravatar.cc/48?u=${encodeURIComponent(task.assigneeName)}`
                                  : undefined)
                              }
                              alt={task.assigneeName ?? "Unassigned"}
                            />
                            <AvatarFallback className="bg-primary/20 text-xxs font-semibold text-primary">
                              {(task.assigneeName ?? "?")
                                .charAt(0)
                                .toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        </TooltipTrigger>
                        <TooltipContent>
                          {task.assigneeName ?? "Unassigned"}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

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
        onClose={() => setDeclineMove(null)}
        onConfirm={() => {
          if (declineMove)
            moveTask(declineMove.taskId, declineMove.toStatusId);
          setDeclineMove(null);
        }}
      />
    </TooltipProvider>
  );
}
