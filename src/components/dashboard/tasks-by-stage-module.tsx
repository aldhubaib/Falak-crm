"use client";

// "Tasks by stage" dashboard module: one stacked bar per active project
// showing where its open tasks sit in the pipeline (Todo → In Progress →
// Review). Clicking a bar opens the per-segment breakdown with task lists.
// A red count under a bar flags currently-rejected tasks in those stages.

import { useState } from "react";
import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { SettingsSection } from "@/components/settings-section";
import { PublishAvatar } from "@/components/publish/publish-avatar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type {
  ProjectStageBreakdown,
  StageSegment,
  StageTaskRow,
} from "@/actions/projects-dashboard";

const SEGMENTS: {
  key: StageSegment;
  label: string;
  stages: string;
  bar: string;
  dot: string;
}[] = [
  {
    key: "todo",
    label: "Todo",
    stages: "Todo",
    bar: "bg-violet-400",
    dot: "bg-violet-400",
  },
  {
    key: "inProgress",
    label: "In Progress",
    stages: "Raw Footage · Raw Footage Review · Post Production",
    bar: "bg-sky-400",
    dot: "bg-sky-400",
  },
  {
    key: "review",
    label: "Review",
    stages: "Final Video Check · Review",
    bar: "bg-amber-400",
    dot: "bg-amber-400",
  },
];

function hueFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 360;
}

function ProjectBar({
  project,
  onClick,
}: {
  project: ProjectStageBreakdown;
  onClick: () => void;
}) {
  const hue = hueFor(project.id);
  return (
    <button
      type="button"
      onClick={onClick}
      title={project.name}
      className="group flex w-14 shrink-0 flex-col items-center gap-2"
    >
      <div className="relative">
        <div className="flex h-32 w-11 flex-col overflow-hidden rounded-xl transition-transform group-hover:scale-[1.04]">
          {SEGMENTS.map((s) => {
            const count = project.counts[s.key];
            if (count === 0) return null;
            return (
              <div
                key={s.key}
                className={s.bar}
                style={{ flexGrow: count }}
                title={`${s.label}: ${count}`}
              />
            );
          })}
        </div>
        {/* Rejected badge rides the bar so the avatar/count rows below stay
            aligned across all projects. */}
        {project.rejectedCount > 0 && (
          <span
            className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-xxs font-bold tabular-nums text-white ring-2 ring-card"
            title={`${project.rejectedCount} rejected ${project.rejectedCount === 1 ? "task" : "tasks"} in these stages`}
          >
            {project.rejectedCount}
          </span>
        )}
      </div>
      <PublishAvatar
        name={project.name}
        thumbnailId={project.thumbnailId}
        size={28}
        fallback={
          <div
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold text-white"
            style={{ background: `hsl(${hue} 70% 55%)` }}
          >
            {project.name.charAt(0).toUpperCase()}
          </div>
        }
      />
      <span className="text-xs leading-tight tabular-nums text-muted-foreground">
        {project.total}
      </span>
    </button>
  );
}

function TaskRow({
  task,
  projectId,
  onNavigate,
}: {
  task: StageTaskRow;
  projectId: string;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={`/projects/${projectId}/tasks/${task.id}`}
      onClick={onNavigate}
      className="flex items-center gap-3 rounded-xl border border-border/50 bg-surface/60 px-3.5 py-2.5 transition-colors hover:border-border hover:bg-surface"
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-foreground">{task.title}</div>
        <div className="mt-0.5 flex items-center gap-1.5 text-xxs text-muted-foreground">
          <span className="tabular-nums">#{task.taskNumber}</span>
          <span>·</span>
          <span className="truncate">{task.stageName}</span>
          {task.rejected && (
            <span className="rounded-full bg-rose-500/15 px-1.5 py-px font-medium text-rose-400">
              Rejected
            </span>
          )}
        </div>
      </div>
      {task.assigneeName && (
        <Avatar className="h-7 w-7 shrink-0">
          {task.assigneeAvatar && (
            <AvatarImage src={task.assigneeAvatar} alt={task.assigneeName} />
          )}
          <AvatarFallback className="bg-primary/15 text-xxs font-medium text-primary">
            {task.assigneeName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      )}
    </Link>
  );
}

export function TasksByStageModule({
  projects,
}: {
  projects: ProjectStageBreakdown[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = projects.find((p) => p.id === selectedId) ?? null;
  const hue = selected ? hueFor(selected.id) : 0;

  return (
    <>
      <SettingsSection
        icon={BarChart3}
        title="Tasks by stage"
        description="Where each project's open tasks are in the pipeline"
      >
        {projects.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            No open tasks in the pipeline.
          </p>
        ) : (
          <>
            <div className="flex items-end gap-3 overflow-x-auto pb-1 pt-2">
              {projects.map((p) => (
                <ProjectBar
                  key={p.id}
                  project={p}
                  onClick={() => setSelectedId(p.id)}
                />
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1">
              {SEGMENTS.map((s) => (
                <span
                  key={s.key}
                  className="flex items-center gap-1.5 text-xxs text-muted-foreground"
                >
                  <span className={cn("h-2 w-2 rounded-full", s.dot)} />
                  {s.label}
                </span>
              ))}
              <span className="flex items-center gap-1.5 text-xxs text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-rose-400" />
                Rejected
              </span>
            </div>
          </>
        )}
      </SettingsSection>

      <Dialog
        open={!!selected}
        onOpenChange={(o) => !o && setSelectedId(null)}
      >
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-hidden p-0">
          {selected && (
            <div className="flex max-h-[85vh] flex-col">
              <DialogHeader className="border-b border-border/50 px-5 py-4 pr-14">
                <DialogTitle className="flex items-center gap-3 text-left">
                  <PublishAvatar
                    name={selected.name}
                    thumbnailId={selected.thumbnailId}
                    size={32}
                    fallback={
                      <div
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-semibold text-white"
                        style={{ background: `hsl(${hue} 70% 55%)` }}
                      >
                        {selected.name.charAt(0).toUpperCase()}
                      </div>
                    }
                  />
                  <span className="truncate">{selected.name}</span>
                  <span className="text-sm font-normal text-muted-foreground">
                    {selected.total} {selected.total === 1 ? "task" : "tasks"}
                  </span>
                  {selected.rejectedCount > 0 && (
                    <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-xs font-medium text-rose-400">
                      {selected.rejectedCount} rejected
                    </span>
                  )}
                </DialogTitle>
              </DialogHeader>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
                {/* Segment summary: count, share and stage names. */}
                <div className="space-y-2">
                  {SEGMENTS.map((s) => {
                    const count = selected.counts[s.key];
                    const pct =
                      selected.total > 0
                        ? Math.round((count / selected.total) * 100)
                        : 0;
                    return (
                      <div
                        key={s.key}
                        className="rounded-xl border border-border/50 bg-surface/60 px-3.5 py-2.5"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={cn("h-2 w-2 shrink-0 rounded-full", s.dot)}
                          />
                          <span className="text-sm font-medium">{s.label}</span>
                          <span className="hidden truncate text-xxs text-muted-foreground sm:inline">
                            {s.stages}
                          </span>
                          <span className="ml-auto text-sm font-semibold tabular-nums">
                            {count}
                          </span>
                          <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">
                            {pct}%
                          </span>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted/40">
                          <div
                            className={cn("h-full rounded-full", s.bar)}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Task lists, one group per segment. */}
                {SEGMENTS.map((s) => {
                  const rows = selected.tasks.filter(
                    (t) => t.segment === s.key,
                  );
                  if (rows.length === 0) return null;
                  return (
                    <div key={s.key} className="space-y-2">
                      <div className="text-xxs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        {s.label} tasks
                      </div>
                      {rows.map((t) => (
                        <TaskRow
                          key={t.id}
                          task={t}
                          projectId={selected.id}
                          onNavigate={() => setSelectedId(null)}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
