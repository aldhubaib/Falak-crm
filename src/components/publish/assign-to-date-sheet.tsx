import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { type Item } from "./types";
import {
  DOW_SHORT,
  MONTHS,
  formatFullDate,
  groupByProject,
  parseISO,
  sameDay,
} from "./helpers";
import { PublishAvatar } from "./publish-avatar";
import { QueueCard } from "./queue-card";

export function AssignToDateSheet({
  date,
  allItems,
  onClose,
  onPick,
  onUpdate,
}: {
  date: Date | null;
  allItems: Item[];
  onClose: () => void;
  onPick: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Item>) => void;
  onOpenTask?: (id: string) => void;
}) {
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [hideScheduled, setHideScheduled] = useState(false);

  useEffect(() => {
    if (!date) setAddedIds(new Set());
  }, [date]);

  useEffect(() => {
    if (date) setHideScheduled(false);
  }, [date]);

  const queued = allItems.filter(
    (i) => i.status === "queued" || addedIds.has(i.id),
  );
  const scheduled = allItems
    .filter((i) => i.status === "scheduled" && i.publishOn)
    .sort((a, b) => (a.publishOn! < b.publishOn! ? -1 : 1));
  const scheduledOnDate = date
    ? scheduled.filter((i) => sameDay(parseISO(i.publishOn!), date))
    : [];

  const unscheduledCount = allItems.filter((i) => !i.publishOn).length;

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
            <div className="flex items-start gap-2 px-5 pt-5 pb-4 pr-14">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {DOW_SHORT[date.getDay()]}, {MONTHS[date.getMonth()]}
                </div>
                <div className="mt-1 text-2xl font-bold tracking-tight">
                  {formatFullDate(date)}
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="relative rounded-full"
                onClick={() => setHideScheduled((v) => !v)}
                aria-label={hideScheduled ? "Show scheduled" : "Hide scheduled"}
                title={hideScheduled ? "Show scheduled" : "Hide scheduled"}
              >
                {hideScheduled ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
                {unscheduledCount > 0 && (
                  <span
                    className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground"
                    aria-label={`${unscheduledCount} tasks without a publish date`}
                  >
                    {unscheduledCount > 9 ? "9+" : unscheduledCount}
                  </span>
                )}
              </Button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto border-t border-border/60 px-4 pt-4 pb-6">
              {scheduledOnDate.length === 0 && queued.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/70 p-6 text-center text-xs text-muted-foreground">
                  Nothing scheduled or queued.
                </div>
              ) : (
                <>
                  {!hideScheduled && scheduledOnDate.length > 0 && (
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

                  {queued.length > 0 && (
                    <div className="space-y-5">
                      <div className="px-1 text-tiny font-medium uppercase tracking-[0.14em] text-muted-foreground">
                        Queue ({queued.length})
                      </div>
                      {groupByProject(queued).map(({ project, items: group }) => (
                        <div key={project.id}>
                          <div className="mb-2 flex items-center gap-2 px-1">
                            <PublishAvatar
                              name={project.name}
                              thumbnailId={project.thumbnailId}
                              size={20}
                            />
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
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
