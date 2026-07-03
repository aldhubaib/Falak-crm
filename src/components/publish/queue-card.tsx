import { useState } from "react";
import {
  CalendarPlus,
  Check,
  ChevronDown,
  Download,
  Image as ImageIcon,
  Paperclip,
} from "lucide-react";
import { ProjectAvatar } from "@/components/project-avatar";
import { cn } from "@/lib/utils";
import { type Item } from "./types";
import { fmtShort, parseISO } from "./helpers";

export function QueueCard({
  item,
  onUpdate,
  onAdd,
  added,
}: {
  item: Item;
  onClick?: () => void;
  onUpdate?: (patch: Partial<Item>) => void;
  onAdd?: () => void;
  added?: boolean;
}) {
  const project = item.project;
  const [expanded, setExpanded] = useState(false);
  const isScheduled = item.status === "scheduled" && !!item.publishOn;
  const isPublished = item.status === "published";
  return (
    <div className="rounded-xl border border-border/60 bg-surface transition-colors hover:border-border">
      <div className="flex items-center gap-2.5 p-3">
        <ProjectAvatar name={project.name} size={28} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {project.name}
        </span>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="grid size-7 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
          aria-label={expanded ? "Hide details" : "Show details"}
          aria-expanded={expanded}
        >
          <ChevronDown
            className={cn("size-4 transition-transform", expanded && "rotate-180")}
          />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 px-3 pb-3 text-tiny">
        <MetaCell label="Delivered" value={fmtShort(parseISO(item.deliveredOn))} tone="success" />
        <MetaCell
          label="Publish"
          value={item.publishOn ? fmtShort(parseISO(item.publishOn)) : "Not set"}
          tone={item.publishOn ? "primary" : "muted"}
        />
      </div>
      {expanded && (
        <div className="border-t border-border/60">
          <div className="px-3 pt-3">
            <div className="text-xxs font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Title
            </div>
            <div dir="rtl" className="mt-0.5 text-right text-base font-semibold">
              {item.title}
            </div>
          </div>
          <div className="mt-3 divide-y divide-border/60 border-y border-border/60">
            <AttachmentDownloadRow
              icon={<Paperclip className="size-4" />}
              label="Final Short Video"
            />
            <AttachmentDownloadRow
              icon={<ImageIcon className="size-4" />}
              label="Final Video Poster"
            />
          </div>
          {onAdd ? (
            <div className="text-xs">
              <button
                type="button"
                disabled={added}
                onClick={onAdd}
                className={cn(
                  "flex w-full items-center justify-center gap-1.5 py-2.5 font-medium transition-colors",
                  added
                    ? "bg-emerald-500/10 text-emerald-500"
                    : "text-primary hover:bg-surface-2",
                )}
              >
                {added ? (
                  <>
                    <Check className="size-3.5" />
                    Added
                  </>
                ) : (
                  <>
                    <CalendarPlus className="size-3.5" />
                    Add to this date
                  </>
                )}
              </button>
            </div>
          ) : onUpdate && (isScheduled || isPublished) ? (
            <div className="grid grid-cols-2 divide-x divide-border/60 text-xs">
              {isScheduled ? (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdate({ publishOn: undefined, status: "queued" })
                    }
                    className="flex items-center justify-center gap-1.5 py-2.5 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
                  >
                    <CalendarPlus className="size-3.5" />
                    Reschedule
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdate({ status: "published" })}
                    className="flex items-center justify-center gap-1.5 py-2.5 font-medium text-success transition-colors hover:bg-surface-2"
                  >
                    <Check className="size-3.5" />
                    Mark completed
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => onUpdate({ status: "scheduled" })}
                  className="col-span-2 flex items-center justify-center gap-1.5 py-2.5 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
                >
                  <CalendarPlus className="size-3.5" />
                  Mark as scheduled
                </button>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function AttachmentDownloadRow({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <span className="text-muted-foreground">{icon}</span>
      <span className="flex-1 text-sm font-medium">{label}</span>
      <button
        type="button"
        className="grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
        aria-label={`Download ${label}`}
      >
        <Download className="size-4" />
      </button>
    </div>
  );
}

function MetaCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "success" | "primary" | "muted";
}) {
  return (
    <div>
      <div className="text-xxs font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "mt-0.5 text-xs font-semibold",
          tone === "success"
            ? "text-success"
            : tone === "primary"
              ? "text-primary"
              : "text-muted-foreground",
        )}
      >
        {value}
      </div>
    </div>
  );
}
