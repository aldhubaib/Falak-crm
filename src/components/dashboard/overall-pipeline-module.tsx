"use client";

// "Overall pipeline" dashboard module: every project's open tasks combined
// into one horizontal stacked bar (Todo → In Progress → Review). Clicking a
// segment lists that segment's tasks across all projects.

import { useState } from "react";
import Link from "next/link";
import { GitCommitHorizontal } from "lucide-react";
import { SettingsSection } from "@/components/settings-section";
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
  bar: string;
  dot: string;
}[] = [
  { key: "todo", label: "Todo", bar: "bg-violet-400", dot: "bg-violet-400" },
  {
    key: "inProgress",
    label: "In Progress",
    bar: "bg-sky-400",
    dot: "bg-sky-400",
  },
  { key: "review", label: "Review", bar: "bg-amber-400", dot: "bg-amber-400" },
];

type SegmentTask = StageTaskRow & { projectId: string; projectName: string };

export function OverallPipelineModule({
  projects,
}: {
  projects: ProjectStageBreakdown[];
}) {
  const [openSegment, setOpenSegment] = useState<StageSegment | null>(null);

  const totals: Record<StageSegment, number> = {
    todo: 0,
    inProgress: 0,
    review: 0,
  };
  let rejectedTotal = 0;
  for (const p of projects) {
    totals.todo += p.counts.todo;
    totals.inProgress += p.counts.inProgress;
    totals.review += p.counts.review;
    rejectedTotal += p.rejectedCount;
  }
  const total = totals.todo + totals.inProgress + totals.review;

  const segmentTasks: SegmentTask[] = openSegment
    ? projects.flatMap((p) =>
        p.tasks
          .filter((t) => t.segment === openSegment)
          .map((t) => ({ ...t, projectId: p.id, projectName: p.name })),
      )
    : [];
  const openMeta = SEGMENTS.find((s) => s.key === openSegment) ?? null;

  return (
    <>
      <SettingsSection
        icon={GitCommitHorizontal}
        title="Overall pipeline"
        description="All open tasks across your projects combined"
      >
        {total === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            No open tasks in the pipeline.
          </p>
        ) : (
          <>
            <div className="flex h-9 w-full overflow-hidden rounded-xl">
              {SEGMENTS.map((s) => {
                const count = totals[s.key];
                if (count === 0) return null;
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setOpenSegment(s.key)}
                    className={cn(
                      "grid min-w-8 place-items-center text-xs font-semibold text-black/75 transition-[filter] hover:brightness-110",
                      s.bar,
                    )}
                    style={{ flexGrow: count }}
                    title={`${s.label}: ${count}`}
                  >
                    {count}
                  </button>
                );
              })}
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
              {rejectedTotal > 0 && (
                <span className="ml-auto rounded-full bg-rose-500/15 px-2 py-0.5 text-xxs font-medium tabular-nums text-rose-400">
                  {rejectedTotal} rejected
                </span>
              )}
            </div>
          </>
        )}
      </SettingsSection>

      <Dialog
        open={!!openSegment}
        onOpenChange={(o) => !o && setOpenSegment(null)}
      >
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-hidden p-0">
          {openMeta && (
            <div className="flex max-h-[85vh] flex-col">
              <DialogHeader className="border-b border-border/50 px-5 py-4 pr-14">
                <DialogTitle className="flex items-center gap-2.5 text-left">
                  <span
                    className={cn("h-2.5 w-2.5 rounded-full", openMeta.dot)}
                  />
                  {openMeta.label}
                  <span className="text-sm font-normal text-muted-foreground">
                    {segmentTasks.length}{" "}
                    {segmentTasks.length === 1 ? "task" : "tasks"} across{" "}
                    {new Set(segmentTasks.map((t) => t.projectId)).size}{" "}
                    {new Set(segmentTasks.map((t) => t.projectId)).size === 1
                      ? "project"
                      : "projects"}
                  </span>
                </DialogTitle>
              </DialogHeader>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 py-4">
                {segmentTasks.map((t) => (
                  <Link
                    key={t.id}
                    href={`/projects/${t.projectId}/tasks/${t.id}`}
                    onClick={() => setOpenSegment(null)}
                    className="flex items-center gap-3 rounded-xl border border-border/50 bg-surface/60 px-3.5 py-2.5 transition-colors hover:border-border hover:bg-surface"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-foreground">
                        {t.title}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-xxs text-muted-foreground">
                        <span className="truncate">{t.projectName}</span>
                        <span>·</span>
                        <span className="tabular-nums">#{t.taskNumber}</span>
                        <span>·</span>
                        <span className="truncate">{t.stageName}</span>
                        {t.rejected && (
                          <span className="rounded-full bg-rose-500/15 px-1.5 py-px font-medium text-rose-400">
                            Rejected
                          </span>
                        )}
                      </div>
                    </div>
                    {t.assigneeName && (
                      <Avatar className="h-7 w-7 shrink-0">
                        {t.assigneeAvatar && (
                          <AvatarImage
                            src={t.assigneeAvatar}
                            alt={t.assigneeName}
                          />
                        )}
                        <AvatarFallback className="bg-primary/15 text-xxs font-medium text-primary">
                          {t.assigneeName.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
