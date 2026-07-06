import { useState } from "react";
import {
  CalendarPlus,
  CalendarX,
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
  // Field placement (Settings → Task Types → "Publish card"): "always" fields
  // render right under the fixed photo/date/title block even while collapsed;
  // the rest only appear when the card is opened.
  const texts = item.texts.filter((t) => t.value !== item.title);
  const alwaysTexts = texts.filter((t) => t.always);
  const expandedTexts = texts.filter((t) => !t.always);
  const alwaysAttachments = item.attachments.filter((a) => a.always);
  const expandedAttachments = item.attachments.filter((a) => !a.always);
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
      {/* Fields set to "Always visible" stay under the title in both states. */}
      {alwaysTexts.map((t) => (
        <TextFieldRow key={t.label} label={t.label} value={t.value} />
      ))}
      {alwaysAttachments.length > 0 && (
        <div className="divide-y divide-border/60 border-t border-border/60">
          {alwaysAttachments.map((a) => (
            <AttachmentDownloadRow
              key={a.attachmentId}
              attachmentId={a.attachmentId}
              label={a.label}
              isImage={a.isImage}
            />
          ))}
        </div>
      )}
      {expanded && (
        <div>
          {/* Fields set to "When expanded" only appear here; the fixed block
              and any "always" fields above stay visible. */}
          {expandedTexts.map((t) => (
            <TextFieldRow key={t.label} label={t.label} value={t.value} />
          ))}
          <div className="flex items-center justify-between border-t border-border/60 px-3 py-3">
            <span className="text-sm font-medium text-muted-foreground">
              Delivered
            </span>
            <span className="text-sm font-medium text-success">
              {fmtShort(parseISO(item.deliveredOn))}
            </span>
          </div>
          {expandedAttachments.length > 0 && (
            <div className="divide-y divide-border/60 border-y border-border/60">
              {expandedAttachments.map((a) => (
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
                    className="my-2 flex items-center justify-center gap-1.5 py-2.5 font-medium text-destructive transition-colors hover:bg-destructive/10"
                  >
                    <CalendarX className="size-3.5" />
                    Remove
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdate({ status: "published" })}
                    className="my-2 flex items-center justify-center gap-1.5 py-2.5 font-medium text-success transition-colors hover:bg-surface-2"
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

function TextFieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-border/60 px-3 pb-3 pt-3">
      <div className="flex items-center justify-between">
        <div className="text-xxs font-medium uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </div>
        <CopyButton text={value} label={label} />
      </div>
      <div dir="auto" className="mt-0.5 whitespace-pre-wrap text-sm">
        {value}
      </div>
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

