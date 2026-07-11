"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarClock } from "lucide-react";
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
  ThisWeekData,
  WeekScheduleProject,
  WeekScheduleSlot,
  WeekScheduleTask,
} from "@/actions/projects-dashboard";

function ProjectGroup({
  group,
  maxRows,
}: {
  group: WeekScheduleProject;
  maxRows?: number;
}) {
  const visibleTasks =
    maxRows === undefined ? group.tasks : group.tasks.slice(0, maxRows);
  const remaining =
    maxRows === undefined
      ? group.slots.length
      : Math.max(0, maxRows - visibleTasks.length);
  const visibleSlots =
    maxRows === undefined ? group.slots : group.slots.slice(0, remaining);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <PublishAvatar
          name={group.projectName}
          thumbnailId={group.thumbnailId}
          size={20}
        />
        <span className="truncate text-sm font-semibold text-foreground">
          {group.projectName}
        </span>
        <span className="text-xxs tabular-nums text-muted-foreground">
          {group.doneCount}/{group.totalCount}
        </span>
      </div>
      {visibleTasks.map((task) => (
        <TaskRow
          key={task.taskId}
          task={task}
          projectId={group.projectId}
        />
      ))}
      {visibleSlots.map((slot) => (
        <SlotRow key={slot.slotId} slot={slot} />
      ))}
    </div>
  );
}

function TaskRow({
  task,
  projectId,
}: {
  task: WeekScheduleTask;
  projectId: string;
}) {
  const color = task.templateColor ?? DEFAULT_TYPE_COLOR;
  return (
    <Link
      href={`/projects/${projectId}/tasks/${task.taskId}`}
      className="flex items-center gap-3 rounded-xl border border-border/60 bg-surface px-3 py-2.5 transition-colors hover:border-border"
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
      <span
        className={
          "min-w-0 flex-1 truncate text-sm font-medium " +
          (task.done ? "text-muted-foreground line-through" : "text-foreground")
        }
      >
        {task.title}
      </span>
    </Link>
  );
}

function SlotRow({ slot }: { slot: WeekScheduleSlot }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-dashed border-border/60 bg-transparent px-3 py-2.5">
      <span
        className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: slot.templateColor ?? DEFAULT_TYPE_COLOR }}
      />
      <span className="text-xxs font-medium uppercase tracking-[0.15em] text-muted-foreground">
        {slot.templateName} #{slot.slotIndex}
      </span>
    </div>
  );
}

export function WeeklyScheduleModule({ data }: { data: ThisWeekData }) {
  const { doneCount, totalPlanned, projects } = data;
  const [open, setOpen] = useState(false);
  const VISIBLE_PROJECTS = 1;
  const visible = projects.slice(0, VISIBLE_PROJECTS);
  const hidden = projects.length - visible.length;

  return (
    <TooltipProvider delayDuration={150}>
      <SettingsSection
        icon={CalendarClock}
        title="This week"
        description="planned tasks done this week"
        className="flex h-full flex-col"
        bodyClassName="flex flex-1 flex-col space-y-0"
        action={
          <span className="text-2xl font-semibold tabular-nums leading-none text-foreground">
            {doneCount}
            <span className="text-muted-foreground">/{totalPlanned}</span>
          </span>
        }
      >
        <div className="space-y-4">
          {totalPlanned === 0 ? (
            <div className="py-10 text-center text-xs text-muted-foreground">
              No weekly plan targets set
            </div>
          ) : (
            visible.map((group) => (
              <ProjectGroup key={group.projectId} group={group} />
            ))
          )}
        </div>
        {hidden > 0 && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="-mx-5 -mb-5 mt-auto block w-[calc(100%+2.5rem)] border-t border-border/60 px-5 py-3 text-center text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            Show all {totalPlanned} planned tasks
          </button>
        )}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-h-[80vh] max-w-2xl overflow-hidden">
            <DialogHeader>
              <DialogTitle>This week</DialogTitle>
            </DialogHeader>
            <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
              {projects.map((group) => (
                <ProjectGroup key={group.projectId} group={group} />
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </SettingsSection>
    </TooltipProvider>
  );
}
