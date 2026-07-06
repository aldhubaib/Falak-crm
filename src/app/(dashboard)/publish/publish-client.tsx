"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarOff,
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PublishAvatar } from "@/components/publish/publish-avatar";
import { cn } from "@/lib/utils";
import { useActionHandler } from "@/hooks/use-action";
import {
  markPublished,
  markUnpublished,
  scheduleTask,
  unscheduleTask,
} from "@/actions/publish";
import { type Item, type Project, type View, toISODate } from "@/components/publish/types";
import { fmtShort, MONTHS } from "@/components/publish/helpers";
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
  const unscheduled = useMemo(
    () => items.filter((i) => i.status !== "published" && !i.publishOn),
    [items],
  );
  const unscheduledCount = unscheduled.length;

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

  // Swipe / drag navigation for month & week views (touch, mouse, and pen).
  const swipeStart = useRef<{ x: number; y: number; id: number } | null>(null);
  const suppressClick = useRef(false);
  const onPointerDown = (e: React.PointerEvent) => {
    swipeStart.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start || start.id !== e.pointerId) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    suppressClick.current = true;
    e.preventDefault();
    e.stopPropagation();
    step(dx < 0 ? 1 : -1);
  };
  const onClickCapture = (e: React.MouseEvent) => {
    if (!suppressClick.current) return;
    suppressClick.current = false;
    e.preventDefault();
    e.stopPropagation();
  };

  const headerTitle = (
    <div className="flex min-w-0 items-center gap-1 sm:gap-2">
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
        title="Jump to today"
      >
        {view === "month"
          ? `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`
          : `${fmtShort(cursor)}, ${cursor.getFullYear()}`}
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

  const beforeNotifications =
    unscheduledCount > 0 ? (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="relative rounded-full"
            aria-label={`${unscheduledCount} tasks without a publish date`}
            title={`${unscheduledCount} tasks without a publish date`}
          >
            <CalendarOff className="size-[18px]" />
            <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
              {unscheduledCount > 9 ? "9+" : unscheduledCount}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" sideOffset={8} className="w-[320px] p-0">
          <div className="flex items-center justify-between border-b border-border/60 px-3 py-2 text-sm font-semibold">
            Without publish date
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold text-muted-foreground">
              {unscheduledCount}
            </span>
          </div>
          <ul className="max-h-[420px] overflow-y-auto py-1">
            {unscheduled.map((i) => (
              <li key={i.id}>
                <button
                  type="button"
                  onClick={() => openTask(i.id)}
                  className="flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-surface/60"
                >
                  <PublishAvatar
                    name={i.project.name}
                    thumbnailId={i.project.thumbnailId}
                    size={28}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{i.title}</div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                      {i.project.name}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>
    ) : null;

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
              <PublishAvatar name={p.name} thumbnailId={p.thumbnailId} size={20} />
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
      <AppHeader
        title={headerTitle}
        beforeNotifications={beforeNotifications}
        actions={headerActions}
      />
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-background text-foreground">
        <div className="flex flex-1 min-h-0">
          <main className="flex min-w-0 flex-1 flex-col">
            <div
              className="min-h-0 flex-1 overflow-auto touch-pan-y"
              onPointerDownCapture={
                view === "month" || view === "week" ? onPointerDown : undefined
              }
              onPointerUpCapture={
                view === "month" || view === "week" ? onPointerUp : undefined
              }
              onClickCapture={
                view === "month" || view === "week" ? onClickCapture : undefined
              }
              onPointerCancel={() => (swipeStart.current = null)}
            >
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
