"use client";

import { useState } from "react";
import Link from "next/link";
import { Clock, UserCheck } from "lucide-react";
import { SettingsSection } from "@/components/settings-section";
import { PublishAvatar } from "@/components/publish/publish-avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TypeIcon, DEFAULT_TYPE_COLOR } from "@/components/task-types/task-type-visuals";
import type {
  MyResponsibilityData,
  ResponsibilitySlot,
  ResponsibilityTask,
} from "@/actions/responsibility";

function TaskRow({ task }: { task: ResponsibilityTask }) {
  const color = task.templateColor ?? DEFAULT_TYPE_COLOR;
  return (
    <Link
      href={`/projects/${task.projectId}/tasks/${task.taskId}`}
      className="flex items-center gap-3 rounded-xl border border-border/60 bg-surface px-3 py-2.5 transition-colors hover:border-border hover:bg-surface/80"
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border"
            style={{
              color,
              borderColor: `color-mix(in oklab, ${color} 40%, transparent)`,
              backgroundColor: `color-mix(in oklab, ${color} 15%, transparent)`,
            }}
          >
            <TypeIcon
              name={task.templateIcon}
              className="h-3 w-3"
              style={{ color }}
            />
          </span>
        </TooltipTrigger>
        <TooltipContent>{task.templateName}</TooltipContent>
      </Tooltip>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-foreground">
          {task.title}
        </div>
        <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" strokeWidth={1.5} />
            {task.ageLabel}
          </span>
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <PublishAvatar
              name={task.projectName}
              thumbnailId={task.projectThumbnailId}
              size={14}
            />
            <span className="max-w-[160px] truncate">{task.projectName}</span>
          </span>
        </div>
      </div>
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border/60 bg-surface-2 px-2 py-1 text-xxs font-medium text-muted-foreground">
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: task.statusColor }}
        />
        {task.statusName}
      </span>
    </Link>
  );
}

function PlannedSlotRow({ slot }: { slot: ResponsibilitySlot }) {
  return (
    <Link
      href={`/projects/${slot.projectId}`}
      className="flex items-center gap-2 rounded-xl border border-dashed border-border/60 bg-transparent px-3 py-2.5 transition-colors hover:border-border hover:bg-surface/40"
    >
      <span
        className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: slot.templateColor ?? DEFAULT_TYPE_COLOR }}
      />
      <span className="text-xxs font-medium uppercase tracking-[0.15em] text-muted-foreground">
        {slot.templateName}
      </span>
      <span className="ml-auto inline-flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
        <PublishAvatar
          name={slot.projectName}
          thumbnailId={slot.projectThumbnailId}
          size={14}
        />
        <span className="max-w-[160px] truncate">{slot.projectName}</span>
      </span>
    </Link>
  );
}

export function MyResponsibilityModule({ data }: { data: MyResponsibilityData }) {
  const { count, tasks, slots } = data;
  const visibleTasks = tasks.slice(0, 4);
  const visibleSlots =
    visibleTasks.length >= 4 ? [] : slots.slice(0, 4 - visibleTasks.length);
  const hidden = count - visibleTasks.length - visibleSlots.length;
  const [open, setOpen] = useState(false);

  return (
    <TooltipProvider delayDuration={150}>
      <SettingsSection
        icon={UserCheck}
        title="My responsibility"
        description={`task${tasks.length === 1 ? "" : "s"} assigned to you`}
        className="flex h-full flex-col"
        bodyClassName="flex flex-1 flex-col space-y-0"
        action={
          <span className="text-2xl font-semibold tabular-nums leading-none text-foreground">
            {count}
          </span>
        }
      >
        <div className="space-y-2">
          {count === 0 ? (
            <div className="py-10 text-center text-xs text-muted-foreground">
              No tasks or plan slots assigned to you
            </div>
          ) : (
            <>
              {visibleTasks.map((task) => (
                <TaskRow key={task.taskId} task={task} />
              ))}
              {visibleSlots.map((slot) => (
                <PlannedSlotRow key={slot.slotId} slot={slot} />
              ))}
            </>
          )}
        </div>
        {hidden > 0 && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="-mx-5 -mb-5 mt-auto block w-[calc(100%+2.5rem)] border-t border-border/60 px-5 py-3 text-center text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            Show all {count} tasks
          </button>
        )}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-h-[80vh] max-w-2xl overflow-hidden">
            <DialogHeader>
              <DialogTitle>My responsibility</DialogTitle>
            </DialogHeader>
            <div className="max-h-[65vh] space-y-2 overflow-y-auto pr-1">
              {tasks.map((task) => (
                <TaskRow key={task.taskId} task={task} />
              ))}
              {slots.map((slot) => (
                <PlannedSlotRow key={slot.slotId} slot={slot} />
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </SettingsSection>
    </TooltipProvider>
  );
}
