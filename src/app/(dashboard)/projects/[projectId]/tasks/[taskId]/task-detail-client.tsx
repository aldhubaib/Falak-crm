"use client";

import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  AtSign,
  Send,
  CircleCheck,
  Download,
  Trash2,
  Loader2,
  Paperclip,
  History,
  Clock,
  ArrowRight,
  MessageSquare,
  List,
  X,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AppHeader } from "@/components/app-header";

import { cn } from "@/lib/utils";
import {
  saveChecklistItemText,
  removeChecklistItemAttachment,
} from "@/actions/projects";
import { addTaskComment } from "@/actions/comments";
import {
  categoryIcon,
  validateFile,
  dotExt,
  allowedExtsFor,
  isFileField,
  isYesNoField,
  yesFollowUp,
  parseYesNo,
  serializeYesNo,
} from "@/components/projects/dynamic-field";
import { uploadManager, type UploadItem } from "@/lib/upload-manager";

export type ChecklistItem = {
  id: string;
  name: string;
  type: string;
  phase: string;
  completed: boolean;
  textValue: string | null;
  attachmentId: string | null;
  attachmentName: string | null;
  attachmentUrl: string | null;
  attachmentContentType: string | null;
  mandatory: boolean;
  options: string[];
  allowedFileTypes: string | null;
  allowedFormats: string[];
  aspectRatio: string | null;
  /** Whether this field is read-only at the task's current stage. */
  locked: boolean;
};

function useChecklistUpload(itemId: string): UploadItem | undefined {
  const subscribe = useCallback(
    (cb: () => void) => uploadManager.subscribe(cb),
    [],
  );
  const getSnapshot = useCallback(
    () => uploadManager.getItemForChecklist(itemId),
    [itemId],
  );
  return useSyncExternalStore(subscribe, getSnapshot, () => undefined);
}

export type HistoryEntry = {
  id: string;
  action: string;
  fromStatusName: string | null;
  toStatusName: string | null;
  durationMs: number | null;
  memberName: string | null;
  createdAt: string;
};

export type CommentEntry = {
  id: string;
  body: string;
  authorName: string;
  createdAt: string;
};

export function TaskDetailClient({
  projectId,
  taskId,
  title,
  typeName,
  statusName,
  statusColor,
  stageEnteredAt,
  createdAt,
  items,
  comments,
  history,
  totalTimeMs,
}: {
  projectId: string;
  taskId: string;
  title: string;
  typeName: string | null;
  statusName: string | null;
  statusColor: string;
  stageEnteredAt: string | null;
  createdAt: string;
  items: ChecklistItem[];
  comments: CommentEntry[];
  history: HistoryEntry[];
  totalTimeMs: number;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [comment, setComment] = useState("");

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyTab, setHistoryTab] = useState<"all" | "comments" | "status">("all");

  const reqItems = items.filter((i) => i.phase === "create");
  const delItems = items.filter((i) => i.phase === "delivery");

  // Requirements are locked once the task leaves Todo; delivery unlocks then.
  const isTodo = !statusName || statusName === "Todo";
  const showDelivery = !isTodo;

  const sendComment = () => {
    const text = comment.trim();
    if (!text) return;
    setComment("");
    startTransition(async () => {
      await addTaskComment(taskId, text, projectId);
      router.refresh();
    });
  };

  return (
    <>
      <AppHeader
        backHref={`/projects/${projectId}`}
        title={title}
        beforeNotifications={
          <Button
            variant="ghost"
            size="icon"
            className="relative rounded-full"
            aria-label="Task history"
            onClick={() => setHistoryOpen(true)}
          >
            <History className="size-[18px]" />
          </Button>
        }
      />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-8 p-5">
          {/* Requirements */}
          <section>
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-primary">
              Requirements
              <div className="h-px flex-1 bg-border/60" />
            </div>
            {reqItems.length > 0 ? (
              <div className="space-y-6">
                {reqItems.map((item, i) => (
                  <TaskField
                    key={item.id}
                    item={item}
                    index={i + 1}
                    projectId={projectId}
                    readOnly={item.locked}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-border/60 p-6 text-center text-xs text-muted-foreground">
                No requirement fields on this task.
              </div>
            )}
          </section>

          {/* Delivery — gated behind leaving Todo */}
          {showDelivery ? (
            delItems.length > 0 && (
              <section>
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-warning">
                  Delivery
                  <div className="h-px flex-1 bg-border/60" />
                </div>
                <div className="space-y-6">
                  {delItems.map((item, i) => (
                    <TaskField
                      key={item.id}
                      item={item}
                      index={i + 1}
                      projectId={projectId}
                      readOnly={item.locked}
                    />
                  ))}
                </div>
              </section>
            )
          ) : delItems.length > 0 ? (
            <section className="rounded-md border border-dashed border-border/60 p-6 text-center text-xs text-muted-foreground">
              Delivery fields unlock when the task moves past{" "}
              <span className="text-foreground">Todo</span>.
            </section>
          ) : null}

          {/* Comments */}
          <section>
            <div className="mb-3 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Comments
            </div>
            {comments.length > 0 && (
              <div className="mb-3 space-y-3">
                {comments.map((c) => (
                  <CommentItem key={c.id} comment={c} />
                ))}
              </div>
            )}
            <div className="flex items-center gap-2 rounded-md border border-border/60 bg-surface px-3 py-2">
              <AtSign className="h-4 w-4 text-muted-foreground" />
              <Input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendComment();
                  }
                }}
                placeholder="Write a comment... Use @ to mention"
                className="h-9 border-0 bg-transparent px-0 focus-visible:ring-0"
              />
              <Button
                size="icon"
                className="h-9 w-9 rounded-md"
                onClick={sendComment}
                disabled={!comment.trim()}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </section>

        </div>
      </main>

      {/* History panel */}
      {historyOpen && (
        <TaskHistoryPanel
          statusName={statusName}
          statusColor={statusColor}
          stageEnteredAt={stageEnteredAt}
          history={history}
          totalTimeMs={totalTimeMs}
          tab={historyTab}
          onTabChange={setHistoryTab}
          onClose={() => setHistoryOpen(false)}
        />
      )}
    </>
  );
}

function formatDurationMs(ms: number): string {
  if (ms < 0) return "0s";
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

const MENTION_RE = /@\[([^\]]+)\]\(([^)]+)\)/g;

// Render a comment body, turning @[Name](id) mention tokens into styled chips.
function renderCommentBody(body: string) {
  const parts: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  MENTION_RE.lastIndex = 0;
  while ((m = MENTION_RE.exec(body)) !== null) {
    if (m.index > last) parts.push(body.slice(last, m.index));
    parts.push(
      <span key={`${m.index}-${m[2]}`} className="font-medium text-primary">
        @{m[1]}
      </span>,
    );
    last = m.index + m[0].length;
  }
  if (last < body.length) parts.push(body.slice(last));
  return parts;
}

function CommentItem({ comment }: { comment: CommentEntry }) {
  const initial = comment.authorName.charAt(0).toUpperCase();
  return (
    <div className="flex gap-2.5">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
        {initial}
      </div>
      <div className="min-w-0 flex-1 rounded-xl border border-border/60 bg-surface/50 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">
            {comment.authorName}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatRelativeDate(comment.createdAt)}
          </span>
        </div>
        <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-muted-foreground">
          {renderCommentBody(comment.body)}
        </p>
      </div>
    </div>
  );
}

function formatRelativeDate(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function TaskHistoryPanel({
  statusName,
  statusColor,
  stageEnteredAt,
  history,
  totalTimeMs,
  tab,
  onTabChange,
  onClose,
}: {
  statusName: string | null;
  statusColor: string;
  stageEnteredAt: string | null;
  history: HistoryEntry[];
  totalTimeMs: number;
  tab: "all" | "comments" | "status";
  onTabChange: (tab: "all" | "comments" | "status") => void;
  onClose: () => void;
}) {
  const statusEntries = history.filter((h) => h.action === "status_change" || h.action === "created");
  const displayEntries = tab === "status" ? statusEntries : history;
  const statusCount = statusEntries.filter((h) => h.action === "status_change").length;

  const [, tick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => tick((n) => n + 1), 60_000);
    return () => clearInterval(iv);
  }, []);

  const currentDuration = stageEnteredAt
    ? Date.now() - new Date(stageEnteredAt).getTime()
    : 0;

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-background shadow-2xl animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
        <History className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold">Task History</span>
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-[10px] font-mono tabular-nums text-muted-foreground">
          <Clock className="h-3 w-3" />
          Total {formatDurationMs(totalTimeMs)}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-muted/40 hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4 border-b border-border/60 px-4 py-2">
        {([
          { key: "all" as const, icon: List, label: "All", count: history.length },
          { key: "comments" as const, icon: MessageSquare, label: "Comments", count: 0 },
          { key: "status" as const, icon: ArrowRight, label: "Status", count: statusCount },
        ]).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => onTabChange(t.key)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              tab === t.key
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <t.icon className="h-3 w-3" />
            {t.label}
            <span className="tabular-nums">{t.count}</span>
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-6">
          {/* Current status */}
          {statusName && (
            <div className="flex items-start gap-3">
              <div
                className="mt-1 h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: statusColor }}
              />
              <div>
                <p className="text-sm font-medium">
                  Currently in {statusName}
                </p>
                {stageEnteredAt && (
                  <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-primary">
                    <Clock className="h-2.5 w-2.5" />
                    {formatDurationMs(currentDuration)} · ongoing
                  </span>
                )}
              </div>
            </div>
          )}

          {/* History entries */}
          {displayEntries.map((entry) => (
            <div key={entry.id} className="flex items-start gap-3">
              <div className="mt-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[9px] font-semibold text-muted-foreground">
                {(entry.memberName ?? "?").charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                {entry.action === "created" ? (
                  <p className="text-sm">
                    <span className="font-medium">{entry.memberName ?? "Someone"}</span>
                    {" "}created this task
                  </p>
                ) : (
                  <p className="text-sm">
                    <span className="font-medium">{entry.memberName ?? "Someone"}</span>
                    {" "}moved from {entry.fromStatusName ?? "—"}{" "}
                    <ArrowRight className="inline h-3 w-3 text-muted-foreground" />{" "}
                    {entry.toStatusName ?? "—"}
                  </p>
                )}
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">
                    {formatRelativeDate(entry.createdAt)}
                  </span>
                  {entry.durationMs != null && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-violet-400">
                      <Clock className="h-2.5 w-2.5" />
                      {formatDurationMs(entry.durationMs)}
                    </span>
                  )}
                  {entry.fromStatusName && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] text-muted-foreground">
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                      {entry.fromStatusName}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TaskField({
  item,
  index,
  projectId,
  readOnly = false,
}: {
  item: ChecklistItem;
  index: number;
  projectId: string;
  readOnly?: boolean;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">{index}.</span>
        <span className="font-medium text-foreground">{item.name}</span>
        {item.mandatory && <span className="text-destructive">*</span>}
      </div>
      <TaskFieldControl item={item} projectId={projectId} readOnly={readOnly} />
    </div>
  );
}

function TaskFieldControl({
  item,
  projectId,
  readOnly,
}: {
  item: ChecklistItem;
  projectId: string;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const saveText = (value: string) => {
    startTransition(async () => {
      await saveChecklistItemText(item.id, value, projectId);
      router.refresh();
    });
  };

  if (isFileField(item.type)) {
    return <TaskFileField item={item} projectId={projectId} readOnly={readOnly} />;
  }

  if (isYesNoField(item.type)) {
    return (
      <TaskYesNoField
        item={item}
        projectId={projectId}
        readOnly={readOnly}
        onSaveText={saveText}
      />
    );
  }

  if (item.type === "select") {
    return (
      <Select
        value={item.textValue || undefined}
        disabled={readOnly}
        onValueChange={(v) => saveText(v)}
      >
        <SelectTrigger className="h-11 rounded-xl border-border/60 bg-background/60">
          <SelectValue placeholder="Select an option…" />
        </SelectTrigger>
        <SelectContent>
          {item.options.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <TextAnswer
      item={item}
      readOnly={readOnly}
      onSave={saveText}
    />
  );
}

function TextAnswer({
  item,
  readOnly,
  onSave,
}: {
  item: ChecklistItem;
  readOnly: boolean;
  onSave: (value: string) => void;
}) {
  const [value, setValue] = useState(item.textValue ?? "");

  useEffect(() => {
    setValue(item.textValue ?? "");
  }, [item.textValue]);

  const commit = () => {
    if (value !== (item.textValue ?? "")) onSave(value);
  };

  const roClass = readOnly
    ? "cursor-default bg-surface/40 text-muted-foreground focus-visible:ring-0"
    : "";

  if (item.type === "textarea") {
    return (
      <div className="relative">
        <Textarea
          value={value}
          readOnly={readOnly}
          placeholder="Type your answer…"
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          className={cn(
            "min-h-20 rounded-xl border-border/60 bg-background/60",
            readOnly && "resize-none pr-11",
            roClass,
          )}
        />
        {readOnly && <CopyButton value={value} className="absolute right-2 top-2" />}
      </div>
    );
  }

  return (
    <div className="relative">
      <Input
        type={item.type === "number" ? "number" : "text"}
        value={value}
        readOnly={readOnly}
        placeholder={item.type === "link" ? "https://…" : "Type your answer…"}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        className={cn(
          "h-11 rounded-xl border-border/60 bg-background/60",
          readOnly && "pr-11",
          roClass,
        )}
      />
      {readOnly && (
        <CopyButton value={value} className="absolute right-1.5 top-1/2 -translate-y-1/2" />
      )}
    </div>
  );
}

// Small copy-to-clipboard icon button for read-only text answers.
function CopyButton({ value, className }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may be unavailable — ignore.
    }
  };

  if (!value.trim()) return null;

  return (
    <button
      type="button"
      onClick={copy}
      aria-label="Copy"
      className={cn(
        "grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted/40 hover:text-foreground",
        className,
      )}
    >
      {copied ? (
        <Check className="h-4 w-4 text-green-400" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </button>
  );
}

function TaskYesNoField({
  item,
  projectId,
  readOnly,
  onSaveText,
}: {
  item: ChecklistItem;
  projectId: string;
  readOnly: boolean;
  onSaveText: (value: string) => void;
}) {
  const parsed = parseYesNo(item.textValue);
  const followUp = yesFollowUp(item.type);
  const value = parsed.value;

  const chooseYes = () =>
    onSaveText(value === "yes" ? "" : serializeYesNo("yes", parsed.text));
  const chooseNo = () => onSaveText(value === "no" ? "" : "no");

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={readOnly}
          onClick={chooseYes}
          className={cn(
            "h-11 rounded-md border text-sm font-medium transition-colors disabled:opacity-60",
            value === "yes"
              ? "border-green-500/60 bg-green-500/10 text-green-400"
              : "border-border/60 bg-surface text-muted-foreground hover:text-foreground",
          )}
        >
          Yes
        </button>
        <button
          type="button"
          disabled={readOnly}
          onClick={chooseNo}
          className={cn(
            "h-11 rounded-md border text-sm font-medium transition-colors disabled:opacity-60",
            value === "no"
              ? "border-destructive/60 bg-destructive/10 text-destructive"
              : "border-border/60 bg-surface text-muted-foreground hover:text-foreground",
          )}
        >
          No
        </button>
      </div>
      {value === "yes" && followUp?.text && (
        <FollowUpText
          key={`${item.id}-text`}
          placeholder={followUp.text.placeholder}
          initial={parsed.text}
          readOnly={readOnly}
          onSave={(t) => onSaveText(serializeYesNo("yes", t))}
        />
      )}
      {value === "yes" && followUp?.file && (
        <FollowUpFile item={item} projectId={projectId} readOnly={readOnly} />
      )}
    </div>
  );
}

function FollowUpText({
  placeholder,
  initial,
  readOnly,
  onSave,
}: {
  placeholder: string;
  initial: string;
  readOnly: boolean;
  onSave: (value: string) => void;
}) {
  const [v, setV] = useState(initial);
  useEffect(() => setV(initial), [initial]);
  return (
    <Input
      value={v}
      readOnly={readOnly}
      placeholder={`${placeholder} *`}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        if (v !== initial) onSave(v);
      }}
      className={cn(
        "h-11 rounded-xl border-border/60 bg-background/60",
        !v.trim() && "border-destructive/50",
      )}
    />
  );
}

function FollowUpFile({
  item,
  projectId,
  readOnly,
}: {
  item: ChecklistItem;
  projectId: string;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const upload = useChecklistUpload(item.id);

  useEffect(() => {
    if (upload?.status === "done") router.refresh();
  }, [upload?.status, router]);

  const pick = (f: File | null) => {
    if (!f) return;
    uploadManager.enqueueChecklist(f, {
      checklistItemId: item.id,
      projectId,
      label: item.name,
    });
  };
  const remove = () =>
    startTransition(async () => {
      await removeChecklistItemAttachment(item.id, projectId);
      router.refresh();
    });

  if (item.attachmentId && item.attachmentUrl) {
    const ct = item.attachmentContentType ?? "";
    return (
      <div className="rounded-xl border border-green-500/50 bg-green-500/5 p-3">
        <AttachmentPreview
          url={item.attachmentUrl}
          name={item.attachmentName}
          contentType={ct}
          attachmentId={item.attachmentId}
        />
        <div className="flex items-center justify-between text-sm">
          <div className="flex min-w-0 items-center gap-2 text-green-400">
            <Paperclip className="h-4 w-4 shrink-0" />
            <span className="truncate text-foreground">{item.attachmentName}</span>
          </div>
          <div className="flex items-center gap-1">
            <a
              href={item.attachmentUrl}
              target="_blank"
              rel="noreferrer"
              className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              aria-label="Download"
            >
              <Download className="h-4 w-4" />
            </a>
            {!readOnly && (
              <button
                type="button"
                onClick={remove}
                aria-label="Remove file"
                className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (
    upload &&
    (upload.status === "uploading" ||
      upload.status === "completing" ||
      upload.status === "queued")
  ) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-surface/40 px-3 py-2">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
        <span className="truncate text-sm text-foreground">
          {upload.file.name}
        </span>
        <span className="ml-auto shrink-0 text-xs text-muted-foreground">
          {upload.progress}%
        </span>
      </div>
    );
  }

  if (readOnly) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 bg-surface/40 px-3 py-3 text-center text-xs text-muted-foreground">
        No file uploaded.
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => document.getElementById(`yfile-${item.id}`)?.click()}
        className="flex w-full items-center gap-2 rounded-xl border border-dashed border-border/70 bg-surface/40 px-3 py-3 text-left text-sm text-muted-foreground transition-colors hover:border-border hover:bg-surface"
      >
        <Paperclip className="h-4 w-4" />
        <span>Attach file</span>
        <span className="ml-auto text-xs text-muted-foreground/70">Any file</span>
      </button>
      <input
        id={`yfile-${item.id}`}
        type="file"
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0] ?? null)}
      />
    </>
  );
}

function TaskFileField({
  item,
  projectId,
  readOnly,
}: {
  item: ChecklistItem;
  projectId: string;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const upload = useChecklistUpload(item.id);
  const category = item.allowedFileTypes;
  const formats = item.allowedFormats.map(dotExt).filter(Boolean);
  const Icon = categoryIcon(category);
  const label = category
    ? category.charAt(0).toUpperCase() + category.slice(1)
    : "File";
  const dropText = `Drop ${category ?? ""} file or click to attach`.replace(
    /\s+/g,
    " ",
  );
  const accepts = allowedExtsFor(category, item.allowedFormats);
  const accept = accepts.length > 0 ? accepts.join(",") : undefined;

  // When an upload finishes, refresh so the saved attachment renders.
  useEffect(() => {
    if (upload?.status === "done") router.refresh();
  }, [upload?.status, router]);

  const handlePick = (picked: File | null) => {
    if (!picked) return;
    const err = validateFile(picked, category, formats);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    uploadManager.enqueueChecklist(picked, {
      checklistItemId: item.id,
      projectId,
      label: item.name,
    });
  };

  const remove = () => {
    startTransition(async () => {
      await removeChecklistItemAttachment(item.id, projectId);
      router.refresh();
    });
  };

  // Existing attachment → show preview + actions.
  if (item.attachmentId && item.attachmentUrl) {
    const ct = item.attachmentContentType ?? "";
    return (
      <div className="rounded-xl border border-green-500/50 bg-green-500/5 p-4">
        <div className="flex min-h-24 items-center justify-center py-2">
          {ct.startsWith("image/") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.attachmentUrl}
              alt={item.attachmentName ?? ""}
              className="max-h-64 rounded"
            />
          ) : ct.startsWith("video/") ? (
            <video
              controls
              preload="metadata"
              src={`/api/files/${item.attachmentId}/stream`}
              className="max-h-64 w-full max-w-md rounded"
            />
          ) : ct.startsWith("audio/") ? (
            <audio controls preload="metadata" src={`/api/files/${item.attachmentId}/stream`} className="w-full max-w-md" />
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Icon className="h-8 w-8" />
              <div className="text-xs">{item.attachmentName}</div>
            </div>
          )}
        </div>
        <div className="mt-2 flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-green-400">
            <CircleCheck className="h-4 w-4" />
            File uploaded
          </div>
          <div className="flex items-center gap-1">
            <a
              href={item.attachmentUrl}
              target="_blank"
              rel="noreferrer"
              className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              aria-label="Download"
            >
              <Download className="h-4 w-4" />
            </a>
            {!readOnly && (
              <button
                type="button"
                onClick={remove}
                aria-label="Remove file"
                className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Uploading in progress.
  if (upload && (upload.status === "uploading" || upload.status === "completing" || upload.status === "queued")) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-surface/40 p-4">
        <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm text-foreground">{upload.file.name}</div>
          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${upload.progress}%` }}
            />
          </div>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">
          {upload.progress}%
        </span>
      </div>
    );
  }

  if (readOnly) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 bg-surface/40 px-3 py-4 text-center text-xs text-muted-foreground">
        No file uploaded.
      </div>
    );
  }

  // Empty drop zone.
  return (
    <>
      <button
        type="button"
        onClick={() => document.getElementById(`file-${item.id}`)?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handlePick(e.dataTransfer.files?.[0] ?? null);
        }}
        className={cn(
          "flex w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-10 text-center transition-colors",
          error
            ? "border-destructive/60 bg-destructive/5"
            : dragOver
              ? "border-primary bg-primary/5"
              : "border-border/70 bg-surface/40 hover:border-border hover:bg-surface",
        )}
      >
        <Icon className="h-8 w-8 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-xs text-muted-foreground">{dropText}</span>
        {(formats.length > 0 || item.aspectRatio) && (
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {formats.map((f) => (
              <span
                key={f}
                className="rounded-md bg-muted/40 px-2 py-0.5 text-tiny text-muted-foreground"
              >
                {f}
              </span>
            ))}
            {item.aspectRatio && (
              <span className="rounded-md bg-muted/40 px-2 py-0.5 text-tiny text-muted-foreground">
                {item.aspectRatio}
              </span>
            )}
          </div>
        )}
      </button>
      {error && <div className="mt-1.5 text-xs text-destructive">{error}</div>}
      <input
        id={`file-${item.id}`}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => handlePick(e.target.files?.[0] ?? null)}
      />
    </>
  );
}

function AttachmentPreview({
  url,
  name,
  contentType,
  attachmentId,
}: {
  url: string;
  name: string | null;
  contentType: string;
  attachmentId?: string;
}) {
  if (contentType.startsWith("image/")) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name ?? ""}
        className="mb-2 max-h-64 rounded"
      />
    );
  }

  const streamSrc = attachmentId ? `/api/files/${attachmentId}/stream` : url;

  if (contentType.startsWith("video/")) {
    return (
      <video
        controls
        preload="metadata"
        src={streamSrc}
        className="mb-2 max-h-64 w-full max-w-md rounded"
      />
    );
  }

  if (contentType.startsWith("audio/")) {
    return (
      <audio controls preload="metadata" src={streamSrc} className="mb-2 w-full" />
    );
  }

  return null;
}
