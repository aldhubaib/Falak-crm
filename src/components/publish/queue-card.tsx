import { useState } from "react";
import {
  CalendarPlus,
  Check,
  ChevronDown,
  Download,
  Image as ImageIcon,
  Loader2,
  Paperclip,
} from "lucide-react";
import { PublishAvatar } from "./publish-avatar";
import { CopyButton } from "./copy-button";
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
  const isQueue = !!onAdd;
  return (
    <div
      className={cn(
        "rounded-xl border bg-surface transition-colors",
        isQueue
          ? "border-destructive/60 hover:border-destructive"
          : isPublished
            ? "border-success/60 hover:border-success"
            : "border-border/60 hover:border-border",
      )}
    >
      {/* Collapsed layout: the parts every task has — project, publish date,
          title with copy. Everything checklist-driven lives in the expanded
          section below. */}
      <div className="flex items-center gap-2.5 p-3">
        <PublishAvatar name={project.name} thumbnailId={project.thumbnailId} size={28} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{project.name}</div>
          {item.publishOn && (
            <div
              className={cn(
                "mt-0.5 truncate text-xs font-semibold",
                isPublished ? "text-success" : "text-primary",
              )}
            >
              {fmtShort(parseISO(item.publishOn))}
            </div>
          )}
        </div>
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
      <div className="flex items-end gap-2 px-3 pb-3 text-tiny">
        <div className="min-w-0 flex-1">
          <div className="text-xxs font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Title
          </div>
          <div dir="auto" className="mt-0.5 truncate text-xs font-semibold text-foreground">
            {item.title}
          </div>
        </div>
        <CopyButton text={item.title} label="title" />
      </div>
      {expanded && (
        <div className="border-t border-border/60">
          <div className="px-3 pt-3">
            <div className="text-xxs font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Title
            </div>
            <div dir="auto" className="mt-0.5 text-base font-semibold">
              {item.title}
            </div>
          </div>
          {/* Dynamic section: fields marked "Show on publish card" in
              Settings → Task Types, texts first then attachments. */}
          {item.texts
            .filter((t) => t.value !== item.title)
            .map((t) => (
              <div
                key={t.label}
                className="mt-3 border-t border-border/60 px-3 pt-3"
              >
                <div className="flex items-center justify-between">
                  <div className="text-xxs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    {t.label}
                  </div>
                  <CopyButton text={t.value} label={t.label} />
                </div>
                <div dir="auto" className="mt-0.5 whitespace-pre-wrap text-sm">
                  {t.value}
                </div>
              </div>
            ))}
          <div className="mt-3 flex items-center justify-between border-t border-border/60 px-3 pt-3">
            <span className="text-sm font-medium text-muted-foreground">
              Delivered
            </span>
            <span className="text-sm font-medium text-success">
              {fmtShort(parseISO(item.deliveredOn))}
            </span>
          </div>
          {item.attachments.length > 0 && (
            <div className="mt-3 divide-y divide-border/60 border-y border-border/60">
              {item.attachments.map((a) => (
                <AttachmentDownloadRow
                  key={a.attachmentId}
                  attachmentId={a.attachmentId}
                  label={a.label}
                  isImage={a.isImage}
                />
              ))}
            </div>
          )}
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
  attachmentId,
  label,
  isImage,
}: {
  attachmentId: string;
  label: string;
  isImage: boolean;
}) {
  const [downloading, setDownloading] = useState(false);
  const Icon = isImage ? ImageIcon : Paperclip;
  return (
    <a
      href={`/api/files/${attachmentId}/download`}
      className="flex min-h-12 items-center gap-3 px-3 py-3 transition-colors hover:bg-surface-2 active:bg-surface-2"
      aria-label={`Download ${label}`}
      onClick={() => {
        setDownloading(true);
        window.setTimeout(() => setDownloading(false), 2500);
      }}
    >
      <span className="text-muted-foreground">
        <Icon className="size-4" />
      </span>
      <span className="flex-1 truncate text-sm font-medium">{label}</span>
      {downloading ? (
        <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
      ) : (
        <Download className="size-4 shrink-0 text-muted-foreground" />
      )}
    </a>
  );
}

