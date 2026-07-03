"use client";

import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import {
  AtSign,
  Send,
  CircleCheck,
  Download,
  Trash2,
  Loader2,
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
import { TaskTypeChip } from "@/components/task-type-chip";
import { cn } from "@/lib/utils";
import {
  saveChecklistItemText,
  removeChecklistItemAttachment,
} from "@/actions/projects";
import { addTaskComment } from "@/actions/comments";
import {
  categoryIcon,
  validateFile,
  isFileField,
  isYesNoField,
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

export function TaskDetailClient({
  projectId,
  taskId,
  title,
  typeName,
  statusName,
  items,
}: {
  projectId: string;
  taskId: string;
  title: string;
  typeName: string | null;
  statusName: string | null;
  items: ChecklistItem[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [comment, setComment] = useState("");

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
        title={
          <div className="flex min-w-0 items-center gap-2">
            {typeName && <TaskTypeChip name={typeName} />}
            <span className="truncate text-sm font-semibold">{title}</span>
          </div>
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
                    readOnly={showDelivery}
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
    </>
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
    const value = item.textValue;
    return (
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={readOnly}
          onClick={() => saveText(value === "yes" ? "" : "yes")}
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
          onClick={() => saveText(value === "no" ? "" : "no")}
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

  if (item.type === "textarea") {
    return (
      <Textarea
        value={value}
        readOnly={readOnly}
        placeholder="Type your answer…"
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        className="min-h-20 rounded-xl border-border/60 bg-background/60"
      />
    );
  }

  return (
    <Input
      type={item.type === "number" ? "number" : "text"}
      value={value}
      readOnly={readOnly}
      placeholder={item.type === "link" ? "https://…" : "Type your answer…"}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      className="h-11 rounded-xl border-border/60 bg-background/60"
    />
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
  const formats = item.allowedFormats;
  const Icon = categoryIcon(category);
  const label = category
    ? category.charAt(0).toUpperCase() + category.slice(1)
    : "File";
  const dropText = `Drop ${category ?? ""} file or click to attach`.replace(
    /\s+/g,
    " ",
  );
  const accept =
    formats.length > 0
      ? formats.join(",")
      : category && category !== "document"
        ? `${category}/*`
        : undefined;

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
              src={item.attachmentUrl}
              className="max-h-64 w-full max-w-md rounded"
            />
          ) : ct.startsWith("audio/") ? (
            <audio controls src={item.attachmentUrl} className="w-full max-w-md" />
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
