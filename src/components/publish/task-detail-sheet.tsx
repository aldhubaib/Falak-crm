import {
  CalendarPlus,
  Check,
  CheckCircle2,
  Download,
  Image as ImageIcon,
  Inbox,
  Paperclip,
} from "lucide-react";
import { ProjectAvatar } from "@/components/project-avatar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { type Item } from "./types";
import { formatFullDate, parseISO } from "./helpers";

export function TaskDetailSheet({
  item,
  onClose,
  onSchedule,
  onUnschedule,
  onMarkPublished,
  onUnpublish,
}: {
  item: Item | null;
  onClose: () => void;
  onSchedule: (isoDate: string) => void;
  onUnschedule: () => void;
  onMarkPublished: () => void;
  onUnpublish: () => void;
}) {
  const project = item ? item.project : null;
  const isScheduled = !!item?.publishOn && item.status !== "published";
  const isPublished = item?.status === "published";

  return (
    <Sheet open={!!item} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-full border-border/60 bg-background p-0 sm:max-w-md"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>{item?.title ?? "Task"}</SheetTitle>
        </SheetHeader>
        {item && project && (
          <div className="flex h-full flex-col">
            {/* Header */}
            <div className="px-5 pt-5 pb-4 pr-14">
              <div>
                <div className="text-lg font-semibold tracking-tight">
                  {item.publishOn
                    ? formatFullDate(parseISO(item.publishOn))
                    : "Not scheduled"}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  1 delivery
                </div>
              </div>
            </div>

            {/* Card */}
            <div className="flex-1 overflow-y-auto px-4 pb-6">
              <div className="overflow-hidden rounded-2xl border border-border/60 bg-surface">
                {/* Top: project + title + delivered */}
                <div className="flex items-start gap-3 px-4 pt-4">
                  <ProjectAvatar name={project.name} size={44} />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-muted-foreground">
                      {item.handle}
                    </div>
                    <div
                      dir="rtl"
                      className="mt-0.5 truncate text-right text-base font-semibold"
                    >
                      {item.title}
                    </div>
                  </div>
                </div>
                <div className="pb-2" />

                {/* Attachments */}
                <div className="border-t border-border/60">
                  <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
                    <span className="text-success">
                      <CheckCircle2 className="size-4" />
                    </span>
                    <span className="flex-1 text-sm font-medium">Delivered</span>
                    <span className="text-xs text-muted-foreground">
                      {formatFullDate(parseISO(item.deliveredOn))}
                    </span>
                  </div>
                  <AttachmentRow
                    icon={<Paperclip className="size-4" />}
                    label="Final Short Video"
                  />
                  <AttachmentRow
                    icon={<ImageIcon className="size-4" />}
                    label="Final Video Poster"
                  />
                </div>

                {/* Actions */}
                <div className="border-t border-border/60 text-sm">
                  {isScheduled ? (
                    <button
                      type="button"
                      onClick={onUnschedule}
                      className="flex w-full items-center justify-center gap-2 py-3 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
                    >
                      <CalendarPlus className="size-4" />
                      Reschedule
                    </button>
                  ) : isPublished ? (
                    <button
                        type="button"
                        onClick={onUnschedule}
                        className="flex w-full items-center justify-center gap-2 py-3 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
                      >
                        <CalendarPlus className="size-4" />
                        Reschedule
                    </button>
                  ) : (
                    <div className="px-4 py-3 text-center text-xs text-muted-foreground">
                      In the queue. Tap a date on the calendar to schedule.
                    </div>
                  )}
                </div>

                {(isScheduled || isPublished) && (
                  <div className="grid grid-cols-1 border-t border-border/60">
                    {isPublished ? (
                      <button
                        type="button"
                        onClick={onUnpublish}
                        className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
                      >
                        <Inbox className="size-4" />
                        Unpublish
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={onMarkPublished}
                        className="flex items-center justify-center gap-2 py-3 text-sm text-success transition-colors hover:bg-success/10"
                      >
                        <Check className="size-4" />
                        Mark Published
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function AttachmentRow({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3 last:border-b-0">
      <span className="text-muted-foreground">{icon}</span>
      <span className="flex-1 text-sm font-medium">{label}</span>
      <button
        type="button"
        aria-label={`Download ${label}`}
        className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-surface-2 hover:text-foreground"
      >
        <Download className="size-4" />
      </button>
    </div>
  );
}
