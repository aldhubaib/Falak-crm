"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarClock, CheckCircle2, XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TypeIcon } from "@/components/task-types/task-type-visuals";
import type { StatTaskRow } from "@/actions/projects-dashboard";

const DEFAULT_TYPE_COLOR = "#8b5cf6";

function RowAvatar({ row }: { row: StatTaskRow }) {
  return (
    <Avatar className="h-7 w-7" title={row.assigneeName ?? "Unassigned"}>
      <AvatarImage
        src={row.assigneeAvatar ?? undefined}
        alt={row.assigneeName ?? "Unassigned"}
      />
      <AvatarFallback className="bg-primary/15 text-tiny font-semibold text-primary">
        {(row.assigneeName ?? "?").charAt(0).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );
}

// One task row inside a stat dialog — icon box, title, type · project, avatar
// and date. Open plan slots (no task yet) link to their project board instead.
function TaskRow({
  row,
  onNavigate,
  subtitle,
}: {
  row: StatTaskRow;
  onNavigate: () => void;
  subtitle?: React.ReactNode;
}) {
  const color = row.typeColor ?? DEFAULT_TYPE_COLOR;
  return (
    <Link
      href={
        row.taskId
          ? `/projects/${row.projectId}/tasks/${row.taskId}`
          : `/projects/${row.projectId}`
      }
      onClick={onNavigate}
      className="group flex items-center gap-3 rounded-xl border border-border/60 bg-surface p-3 transition-colors hover:border-border hover:bg-surface-2"
    >
      <span
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border/60 bg-surface-2"
        style={{ color }}
        aria-hidden
      >
        <TypeIcon name={row.typeIcon} className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-foreground">
          {row.title}
        </div>
        <div className="mt-1 flex items-center gap-2 text-tiny text-muted-foreground">
          {subtitle ?? (
            <>
              {row.typeName && (
                <span className="inline-flex items-center gap-1.5" style={{ color }}>
                  {row.typeName}
                </span>
              )}
              {row.typeName && <span aria-hidden>·</span>}
              <span className="truncate">{row.projectName}</span>
            </>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <RowAvatar row={row} />
        {row.dateLabel && (
          <span className="text-tiny tabular-nums text-muted-foreground">
            {row.dateLabel}
          </span>
        )}
      </div>
    </Link>
  );
}

function statCardClass() {
  return "flex min-h-[7.5rem] flex-col gap-2 rounded-2xl border border-border/60 bg-card/60 px-4 py-3.5 text-left backdrop-blur-sm transition-colors hover:border-border hover:bg-card";
}

// ─── Planned Tasks ───────────────────────────────────────────────────────────

export function PlannedTasksStat({
  thisWeekCount,
  nextWeekCount,
  thisWeek,
  nextWeek,
}: {
  thisWeekCount: number;
  nextWeekCount: number;
  thisWeek: StatTaskRow[];
  nextWeek: StatTaskRow[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={statCardClass()}>
        <div className="flex items-center justify-between">
          <span className="text-xxs font-medium uppercase tracking-[0.15em] text-muted-foreground">
            Planned Tasks
          </span>
          <CalendarClock className="size-3.5 text-muted-foreground" strokeWidth={2} />
        </div>
        <div className="mt-auto flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xxs uppercase tracking-[0.15em] text-muted-foreground">
              This week
            </span>
            <span className="text-lg font-semibold tabular-nums text-foreground">
              {thisWeekCount}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xxs uppercase tracking-[0.15em] text-muted-foreground">
              Next week
            </span>
            <span className="text-lg font-semibold tabular-nums text-foreground">
              {nextWeekCount}
            </span>
          </div>
        </div>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>Planned tasks</DialogTitle>
          </DialogHeader>
          <div className="flex max-h-[65vh] flex-col gap-5 overflow-y-auto pr-1">
            <PlannedGroup
              label="This week"
              tasks={thisWeek}
              onNavigate={() => setOpen(false)}
            />
            <PlannedGroup
              label="Next week"
              tasks={nextWeek}
              onNavigate={() => setOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PlannedGroup({
  label,
  tasks,
  onNavigate,
}: {
  label: string;
  tasks: StatTaskRow[];
  onNavigate: () => void;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2 text-xxs font-medium uppercase tracking-[0.15em] text-muted-foreground">
        <span>{label}</span>
        <span className="text-foreground">{tasks.length}</span>
      </div>
      {tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing planned.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {tasks.map((t) => (
            <li key={t.id}>
              <TaskRow row={t} onNavigate={onNavigate} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ─── Completed / Rejected (grouped by type) ─────────────────────────────────

type TypeGroup = {
  typeName: string;
  typeColor: string;
  typeIcon: string | null;
  tasks: StatTaskRow[];
};

function groupByType(tasks: StatTaskRow[]): TypeGroup[] {
  const map = new Map<string, TypeGroup>();
  for (const t of tasks) {
    const name = t.typeName ?? "No type";
    const g = map.get(name);
    if (g) g.tasks.push(t);
    else
      map.set(name, {
        typeName: name,
        typeColor: t.typeColor ?? DEFAULT_TYPE_COLOR,
        typeIcon: t.typeIcon,
        tasks: [t],
      });
  }
  return [...map.values()].sort((a, b) => b.tasks.length - a.tasks.length);
}

export function CompletedTasksStat({
  done,
  total,
  tasks,
}: {
  done: number;
  total: number;
  tasks: StatTaskRow[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={statCardClass()}>
        <div className="flex items-center justify-between">
          <span className="text-xxs font-medium uppercase tracking-[0.15em] text-muted-foreground">
            Completed Tasks
          </span>
          <CheckCircle2 className="size-3.5 text-muted-foreground" strokeWidth={2} />
        </div>
        <div className="text-2xl font-semibold tabular-nums text-foreground">
          {done} / {total}
        </div>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>
              Completed tasks · {done} / {total}
            </DialogTitle>
          </DialogHeader>
          <div className="flex max-h-[65vh] flex-col gap-5 overflow-y-auto pr-1">
            {tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No completed tasks yet.</p>
            ) : (
              groupByType(tasks).map((g) => (
                <section key={g.typeName}>
                  <div className="mb-2 flex items-center gap-2">
                    <span
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-border/60 bg-surface-2"
                      style={{ color: g.typeColor }}
                      aria-hidden
                    >
                      <TypeIcon name={g.typeIcon} className="size-3.5" />
                    </span>
                    <span
                      className="text-xxs font-medium uppercase tracking-[0.15em]"
                      style={{ color: g.typeColor }}
                    >
                      {g.typeName}
                    </span>
                    <span className="text-xxs font-medium uppercase tracking-[0.15em] text-foreground">
                      {g.tasks.length}
                    </span>
                  </div>
                  <ul className="flex flex-col gap-2">
                    {g.tasks.map((t) => (
                      <li key={t.id}>
                        <TaskRow
                          row={t}
                          onNavigate={() => setOpen(false)}
                          subtitle={<span className="truncate">{t.projectName}</span>}
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function RejectedTasksStat({
  count,
  tasks,
}: {
  count: number;
  tasks: StatTaskRow[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={statCardClass()}>
        <div className="flex items-center justify-between">
          <span className="text-xxs font-medium uppercase tracking-[0.15em] text-muted-foreground">
            Rejected Tasks
          </span>
          <XCircle className="size-3.5 text-muted-foreground" strokeWidth={2} />
        </div>
        <div className="text-2xl font-semibold tabular-nums text-foreground">
          {count}
        </div>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>Rejected tasks · {count}</DialogTitle>
          </DialogHeader>
          <div className="flex max-h-[65vh] flex-col gap-5 overflow-y-auto pr-1">
            {tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No rejected tasks.</p>
            ) : (
              groupByType(tasks).map((g) => (
                <section key={g.typeName}>
                  <div className="mb-2 flex items-center gap-2">
                    <span
                      className="text-xxs font-medium uppercase tracking-[0.15em]"
                      style={{ color: g.typeColor }}
                    >
                      {g.typeName}
                    </span>
                    <span className="text-xxs font-medium uppercase tracking-[0.15em] text-foreground">
                      {g.tasks.length}
                    </span>
                  </div>
                  <ul className="flex flex-col gap-2">
                    {g.tasks.map((t) => (
                      <li key={t.id}>
                        <TaskRow
                          row={t}
                          onNavigate={() => setOpen(false)}
                          subtitle={
                            <>
                              <span className="truncate">{t.projectName}</span>
                              {t.reason && (
                                <>
                                  <span aria-hidden>·</span>
                                  <span className="truncate text-destructive/80">
                                    {t.reason}
                                  </span>
                                </>
                              )}
                            </>
                          }
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
