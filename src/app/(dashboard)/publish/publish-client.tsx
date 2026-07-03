"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  MoreVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/components/app-header";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProjectAvatar } from "@/components/project-avatar";
import { cn } from "@/lib/utils";
import { useActionHandler } from "@/hooks/use-action";
import {
  markPublished,
  markUnpublished,
  scheduleTask,
  unscheduleTask,
} from "@/actions/publish";
import { type Item, type Project, type View, toISODate } from "@/components/publish/types";
import { MONTHS, fmtShort, startOfWeek } from "@/components/publish/helpers";
import { MonthView } from "@/components/publish/month-view";
import { WeekView } from "@/components/publish/week-view";
import { ScheduleView } from "@/components/publish/schedule-view";
import { QueueView } from "@/components/publish/queue-view";
import { TaskDetailSheet } from "@/components/publish/task-detail-sheet";
import { AssignToDateSheet } from "@/components/publish/assign-to-date-sheet";

export function PublishClient({
  items: initialItems,
  projects,
}: {
  items: Item[];
  projects: Project[];
}) {
  const router = useRouter();
  const { run } = useActionHandler({ onSuccess: () => router.refresh() });

  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState<Date>(today);
  const [view, setView] = useState<View>("month");
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [items, setItems] = useState<Item[]>(initialItems);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [assignDate, setAssignDate] = useState<Date | null>(null);

  // Re-sync when the server sends fresh data after an action.
  useEffect(() => setItems(initialItems), [initialItems]);

  const filtered = useMemo(
    () => items.filter((i) => !hidden.has(i.projectId)),
    [items, hidden],
  );
  const toggleProject = (id: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const selected = selectedId ? items.find((i) => i.id === selectedId) ?? null : null;

  const patchLocal = (id: string, patch: Partial<Item>) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const openTask = (id: string) => setSelectedId(id);
  const openDate = (d: Date) => setAssignDate(d);

  const scheduleItemOnDate = (item: Item, date: Date) => {
    patchLocal(item.id, { publishOn: toISODate(date), status: "scheduled" });
    void run("scheduleTask", () =>
      scheduleTask({
        taskId: item.taskId,
        projectId: item.projectId,
        scheduledDate: toISODate(date),
      }),
    );
  };

  const assignToDate = (itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    if (!item || !assignDate) return;
    scheduleItemOnDate(item, assignDate);
  };

  // Maps a Lovable-style local patch to the correct real server action.
  const applyPatch = (id: string, patch: Partial<Item>) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    const unscheduling =
      patch.status === "queued" || ("publishOn" in patch && !patch.publishOn);
    if (unscheduling) {
      patchLocal(id, { publishOn: undefined, status: "queued" });
      if (item.publishItemId) {
        void run("unscheduleTask", () => unscheduleTask(item.publishItemId!));
      }
      return;
    }
    if (patch.status === "published") {
      patchLocal(id, { status: "published" });
      if (item.publishItemId) {
        void run("markPublished", () => markPublished(item.publishItemId!));
      }
      return;
    }
    if (patch.status === "scheduled") {
      patchLocal(id, { status: "scheduled" });
      if (item.publishItemId) {
        void run("markUnpublished", () => markUnpublished(item.publishItemId!));
      }
      return;
    }
    patchLocal(id, patch);
  };

  const goToday = () => setCursor(today);
  const step = (dir: -1 | 1) => {
    const d = new Date(cursor);
    if (view === "month") d.setMonth(d.getMonth() + dir);
    else if (view === "week") d.setDate(d.getDate() + dir * 7);
    else d.setDate(d.getDate() + dir * 14);
    setCursor(d);
  };

  const rangeLabel = useMemo(() => {
    if (view === "month")
      return `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;
    if (view === "week") {
      const start = startOfWeek(cursor);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return `${fmtShort(start)} – ${fmtShort(end)}`;
    }
    return `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;
  }, [cursor, view]);

  const headerTitle = (
    <div className="flex min-w-0 items-center gap-1 sm:gap-2">
      <h1 className="truncate text-base font-semibold tracking-tight sm:text-lg">
        {rangeLabel}
      </h1>
      <Button
        variant="ghost"
        size="icon"
        className="size-8 shrink-0 rounded-full"
        onClick={() => step(-1)}
        aria-label="Previous"
      >
        <ChevronLeft className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 shrink-0 rounded-full px-3 text-xs font-medium"
        onClick={goToday}
      >
        Today
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-8 shrink-0 rounded-full"
        onClick={() => step(1)}
        aria-label="Next"
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );

  const headerActions = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label="More">
          <MoreVertical className="h-[18px] w-[18px]" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="text-tiny font-medium uppercase tracking-wider text-muted-foreground">
          View
        </DropdownMenuLabel>
        {(["month", "week", "schedule", "queue"] as const).map((v) => (
          <DropdownMenuItem
            key={v}
            onSelect={(e) => {
              e.preventDefault();
              setView(v);
            }}
            className="gap-2 capitalize"
          >
            <span className="flex-1">{v}</span>
            {view === v && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-tiny font-medium uppercase tracking-wider text-muted-foreground">
          Projects
        </DropdownMenuLabel>
        {projects.map((p) => {
          const isHidden = hidden.has(p.id);
          return (
            <DropdownMenuItem
              key={p.id}
              onSelect={(e) => {
                e.preventDefault();
                toggleProject(p.id);
              }}
              className="gap-2"
            >
              <ProjectAvatar name={p.name} size={20} />
              <span className={cn("flex-1 truncate", isHidden && "text-muted-foreground line-through")}>
                {p.name}
              </span>
              {isHidden ? (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Eye className="h-4 w-4 text-primary" />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <>
      <AppHeader title={headerTitle} actions={headerActions} />
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-background text-foreground">
        <div className="flex flex-1 min-h-0">
          <main className="flex min-w-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-auto">
              {view === "month" && (
                <MonthView cursor={cursor} today={today} items={filtered} onSelect={openTask} onDateClick={openDate} />
              )}
              {view === "week" && (
                <WeekView cursor={cursor} today={today} items={filtered} onSelect={openTask} onDateClick={openDate} />
              )}
              {view === "schedule" && <ScheduleView items={filtered} onSelect={openTask} />}
              {view === "queue" && <QueueView items={filtered} onSelect={openTask} />}
            </div>
          </main>
        </div>
      </div>

      <TaskDetailSheet
        item={selected}
        onClose={() => setSelectedId(null)}
        onSchedule={(date) =>
          selected && scheduleItemOnDate(selected, new Date(date))
        }
        onUnschedule={() => selected && applyPatch(selected.id, { publishOn: undefined, status: "queued" })}
        onMarkPublished={() => selected && applyPatch(selected.id, { status: "published" })}
        onUnpublish={() => selected && applyPatch(selected.id, { status: "scheduled" })}
      />

      <AssignToDateSheet
        date={assignDate}
        allItems={items}
        onClose={() => setAssignDate(null)}
        onPick={assignToDate}
        onUpdate={applyPatch}
        onOpenTask={(id) => {
          setAssignDate(null);
          openTask(id);
        }}
      />
    </>
  );
}
