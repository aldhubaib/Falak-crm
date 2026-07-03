import { useEffect, useState } from "react";
import { Calendar as CalendarIcon, CalendarPlus } from "lucide-react";
import { ProjectAvatar } from "@/components/project-avatar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { type Item } from "./types";
import {
  DOW_SHORT,
  MONTHS,
  formatFullDate,
  groupByProject,
  parseISO,
  sameDay,
} from "./helpers";
import { QueueCard } from "./queue-card";

export function AssignToDateSheet({
  date,
  allItems,
  onClose,
  onPick,
  onUpdate,
  onOpenTask,
}: {
  date: Date | null;
  allItems: Item[];
  onClose: () => void;
  onPick: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Item>) => void;
  onOpenTask: (id: string) => void;
}) {
  const [tab, setTab] = useState<"queued" | "scheduled">("queued");
  const [projectId, setProjectId] = useState<string>("all");
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!date) setAddedIds(new Set());
  }, [date]);

  useEffect(() => {
    if (date) {
      const hasOnDate = allItems.some(
        (i) =>
          i.status === "scheduled" &&
          i.publishOn &&
          sameDay(parseISO(i.publishOn), date),
      );
      setTab(hasOnDate ? "scheduled" : "queued");
      setProjectId("all");
    }
    // Intentionally exclude allItems: we only pick the initial tab when the
    // sheet opens for a new date, so adding items doesn't yank the user away.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const byProject = (arr: Item[]) =>
    projectId === "all" ? arr : arr.filter((i) => i.projectId === projectId);

  const queued = byProject(
    allItems.filter((i) => i.status === "queued" || addedIds.has(i.id)),
  );
  const scheduled = byProject(
    allItems.filter((i) => i.status === "scheduled" && i.publishOn),
  ).sort((a, b) => (a.publishOn! < b.publishOn! ? -1 : 1));
  const scheduledOnDate = date
    ? scheduled.filter((i) => sameDay(parseISO(i.publishOn!), date))
    : [];

  return (
    <Sheet open={!!date} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-full border-border/60 bg-background p-0 sm:max-w-md"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Assign a task</SheetTitle>
        </SheetHeader>
        {date && (
          <div className="flex h-full flex-col">
            <div className="px-5 pt-5 pb-4 pr-14">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {DOW_SHORT[date.getDay()]}, {MONTHS[date.getMonth()]}
              </div>
              <div className="mt-1 text-2xl font-bold tracking-tight">
                {formatFullDate(date)}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Pick from the queue to schedule, or browse what&apos;s already scheduled.
              </p>
            </div>

            {/* Controls: tab + project filter */}
            <div className="flex items-center gap-2 border-b border-border/60 px-4 pb-3">
              <div className="inline-flex rounded-full border border-border/70 bg-surface p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setTab("queued")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3 py-1 font-medium transition-colors",
                    tab === "queued"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  aria-label={`Unscheduled (${queued.length})`}
                >
                  <CalendarPlus className="size-3.5" />
                  <span>{queued.length}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTab("scheduled")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3 py-1 font-medium transition-colors",
                    tab === "scheduled"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  aria-label={`Scheduled (${scheduled.length})`}
                >
                  <CalendarIcon className="size-3.5" />
                  <span>{scheduled.length}</span>
                </button>
              </div>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-4 pt-4 pb-6">
              {tab === "queued" ? (
                queued.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border/70 p-6 text-center text-xs text-muted-foreground">
                    Nothing in the queue.
                  </div>
                ) : (
                  <div className="space-y-5">
                    {groupByProject(queued).map(({ project, items: group }) => (
                      <div key={project.id}>
                        <div className="mb-2 flex items-center gap-2 px-1">
                          <ProjectAvatar name={project.name} size={20} />
                          <span className="text-xs font-semibold text-foreground/90">
                            {project.name}
                          </span>
                          <span className="text-tiny text-muted-foreground">
                            ({group.length})
                          </span>
                        </div>
                        <div className="space-y-2">
                          {group.map((it) => (
                            <QueueCard
                              key={it.id}
                              item={it}
                              onUpdate={(p) => onUpdate(it.id, p)}
                              added={addedIds.has(it.id)}
                              onAdd={() => {
                                setAddedIds((prev) => {
                                  const next = new Set(prev);
                                  next.add(it.id);
                                  return next;
                                });
                                window.setTimeout(() => onPick(it.id), 900);
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : scheduled.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/70 p-6 text-center text-xs text-muted-foreground">
                  Nothing scheduled yet.
                </div>
              ) : (
                <div className="space-y-5">
                  {scheduledOnDate.length > 0 && (
                    <div>
                      <div className="mb-2 px-1 text-tiny font-medium uppercase tracking-[0.14em] text-primary">
                        On this date ({scheduledOnDate.length})
                      </div>
                      <div className="space-y-2">
                        {scheduledOnDate.map((it) => (
                          <QueueCard
                            key={it.id}
                            item={it}
                            onUpdate={(p) => onUpdate(it.id, p)}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  {(() => {
                    const rest = groupByProject(
                      scheduled.filter(
                        (i) => !scheduledOnDate.some((s) => s.id === i.id),
                      ),
                    );
                    if (rest.length === 0) return null;
                    return (
                      <div>
                        <div className="mb-2 px-1 text-tiny font-medium uppercase tracking-[0.14em] text-muted-foreground">
                          Scheduled
                        </div>
                        <div className="space-y-5">
                          {rest.map(({ project, items: group }) => (
                            <div key={project.id}>
                              <div className="mb-2 flex items-center gap-2 px-1">
                                <ProjectAvatar name={project.name} size={20} />
                                <span className="text-xs font-semibold text-foreground/90">
                                  {project.name}
                                </span>
                                <span className="text-tiny text-muted-foreground">
                                  ({group.length})
                                </span>
                              </div>
                              <div className="space-y-2">
                                {group.map((it) => (
                                  <QueueCard
                                    key={it.id}
                                    item={it}
                                    onUpdate={(p) => onUpdate(it.id, p)}
                                  />
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
