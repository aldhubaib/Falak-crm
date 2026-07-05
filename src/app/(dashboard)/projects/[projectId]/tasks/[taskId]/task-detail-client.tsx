"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  AtSign,
  Send,
  CircleCheck,
  Download,
  Trash2,
  Loader2,
  MoreVertical,
  AlertTriangle,
  Paperclip,
  History,
  Clock,
  ArrowLeft,
  ArrowRight,
  MessageSquare,
  List,
  X,
  Copy,
  Check,
  RotateCcw,
  Flag,
  HelpCircle,
  LayoutGrid,
  Package,
  Type as TypeIcon,
  VideoOff,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AppHeader } from "@/components/app-header";
import { PageContainer } from "@/components/page-container";

import { cn } from "@/lib/utils";
import {
  saveChecklistItemText,
  removeChecklistItemAttachment,
  deleteTask,
  updateTaskStatus,
} from "@/actions/projects";
import { ConfirmStatusDialog } from "@/components/board/confirm-status-dialog";
import { DeclineDialog } from "@/components/board/decline-dialog";
import { CONFIRM_MESSAGES } from "@/components/board/confirm-messages";
import { useActionHandler } from "@/hooks/use-action";
import { restoreRecord, permanentDeleteRecord } from "@/actions/delete";
import { addTaskComment } from "@/actions/comments";
import type { MessageAttachment } from "@/actions/messages";
import { AttachmentBubble } from "@/components/messages/chat-attachments";
import { useChannel } from "@/components/realtime/hooks";
import { taskChannel } from "@/lib/channels";
import {
  categoryIcon,
  validateFileFull,
  normalizeFormats,
  allowedExtsFor,
  isFileField,
  isYesNoField,
  yesFollowUp,
  parseYesNo,
  serializeYesNo,
} from "@/components/projects/dynamic-field";
import { uploadManager, type UploadItem } from "@/lib/upload-manager";
import { FormSection } from "@/components/projects/form-section";
import { boardQueryKey } from "../../use-board";
import type { BoardData } from "@/actions/board";

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
  attachments: MessageAttachment[];
};

// Everything the status bar needs to move the task Back / Next from here,
// mirroring the board's drag flow (permissions, confirm dialogs, decline).
export type TaskMoveData = {
  statuses: { id: string; name: string; color: string; order: number }[];
  statusId: string | null;
  perms: {
    full: boolean;
    stages: Record<string, { forward: boolean; rollback: boolean }>;
  };
  submittedBy: { id: string | null; name: string | null };
};

export function TaskDetailClient({
  projectId,
  taskId,
  canDelete,
  trashed,
  title,
  projectName,
  taskNumber,
  typeName,
  priority,
  statusName,
  statusColor,
  stageEnteredAt,
  createdAt,
  items,
  comments,
  history,
  totalTimeMs,
  move,
  mentionables,
}: {
  projectId: string;
  taskId: string;
  canDelete: boolean;
  /** Set when the task is in the trash — renders read-only with a trash banner. */
  trashed?: { deletedAt: string; deletedByName: string | null } | null;
  title: string;
  projectName: string;
  taskNumber: number;
  typeName: string | null;
  priority: number | null;
  statusName: string | null;
  statusColor: string;
  stageEnteredAt: string | null;
  createdAt: string;
  items: ChecklistItem[];
  comments: CommentEntry[];
  history: HistoryEntry[];
  totalTimeMs: number;
  move?: TaskMoveData | null;
  /** Project team + owners, offered by the @ mention autocomplete. */
  mentionables?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyTab, setHistoryTab] = useState<"all" | "comments" | "status">("all");

  const queryClient = useQueryClient();
  // Drop the task from the board's React Query cache right away — the board
  // page keeps its own client cache, so without this the deleted task would
  // linger there until the next background refetch.
  const evictFromBoardCache = () => {
    queryClient.setQueryData<BoardData>(boardQueryKey(projectId), (prev) =>
      prev ? { ...prev, tasks: prev.tasks.filter((t) => t.id !== taskId) } : prev,
    );
    void queryClient.invalidateQueries({ queryKey: boardQueryKey(projectId) });
  };

  const [confirmDelete, setConfirmDelete] = useState(false);
  const { run: runDelete, loading: deleting } = useActionHandler();
  const handleDelete = () =>
    runDelete("Delete Task", async () => {
      await deleteTask(taskId, projectId);
      evictFromBoardCache();
      router.push(`/projects/${projectId}`);
    });

  const { run: runTrashAction, loading: trashActionLoading } = useActionHandler();
  const handleRestore = () =>
    runTrashAction("Restore Task", async () => {
      await restoreRecord("task", taskId);
      // Restored task must reappear on the board.
      void queryClient.invalidateQueries({ queryKey: boardQueryKey(projectId) });
      router.refresh();
    });
  const handlePurge = () =>
    runTrashAction("Delete Task Forever", async () => {
      await permanentDeleteRecord("task", taskId);
      evictFromBoardCache();
      router.push("/settings/trash");
    });

  const reqItems = items.filter((i) => i.phase === "create");
  const delItems = items.filter((i) => i.phase === "delivery");

  // Requirements are locked once the task leaves Todo; delivery unlocks then.
  const isTodo = !statusName || statusName === "Todo";
  const showDelivery = !isTodo;

  const sendComment = (body: string) => {
    startTransition(async () => {
      await addTaskComment(taskId, body, projectId);
      router.refresh();
    });
  };

  // Live comments/rejections: refresh when a new message lands on this task.
  useChannel(taskChannel(taskId), (data) => {
    const d = data as { type?: string } | null;
    if (d?.type === "message.new") router.refresh();
  });

  return (
    <>
      <AppHeader
        backHref={trashed ? "/settings/trash" : `/projects/${projectId}`}
        title={
          <div className="truncate text-sm text-muted-foreground">
            <span className="font-semibold text-primary">{projectName}</span>
            <span className="mx-2">/</span>
            <span className="font-semibold text-foreground">
              T-{String(taskNumber).padStart(3, "0")}
            </span>
          </div>
        }
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
        actions={
          canDelete ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full"
                  aria-label="Task options"
                >
                  <MoreVertical className="size-[18px]" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={() => setConfirmDelete(true)}
                >
                  <Trash2 className="size-4" />
                  Delete task
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : undefined
        }
      />

      <Dialog open={confirmDelete} onOpenChange={(o) => !deleting && setConfirmDelete(o)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-destructive" />
              Delete this task?
            </DialogTitle>
            <DialogDescription>
              “{title}” and its checklist will be removed from the board. This
              can&apos;t be undone from the app.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={deleting}
              onClick={() => setConfirmDelete(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" disabled={deleting} onClick={handleDelete}>
              {deleting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                <>
                  <Trash2 className="size-4" />
                  Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <main className="min-h-0 flex-1 overflow-y-auto">
        <PageContainer className="mx-auto max-w-3xl">
          {trashed && (
            <div className="flex flex-wrap items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3">
              <Trash2 className="h-4 w-4 shrink-0 text-destructive" />
              <div className="min-w-0 flex-1 text-sm">
                <span className="font-medium">This task is in the trash.</span>{" "}
                <span className="text-muted-foreground">
                  Deleted{trashed.deletedByName ? ` by ${trashed.deletedByName}` : ""} · everything
                  below is read-only.
                </span>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={trashActionLoading}
                  onClick={handleRestore}
                >
                  <RotateCcw className="h-4 w-4" /> Restore
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={trashActionLoading}
                  onClick={handlePurge}
                >
                  <Trash2 className="h-4 w-4" /> Delete forever
                </Button>
              </div>
            </div>
          )}
          {/* Status bar — move the task Back / Next without going to the board */}
          {!trashed && move && (
            <StatusMoveBar
              projectId={projectId}
              taskId={taskId}
              move={move}
              items={items}
            />
          )}

          {/* Task type / title / priority — mirrors the New Task page */}
          <FormSection
            icon={<LayoutGrid className="size-4" />}
            title="Task Type"
            hint="The template this task was created from."
          >
            {typeName ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/60 bg-primary/10 px-3.5 py-1.5 text-xs font-medium text-primary">
                {typeName}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">No template</span>
            )}
          </FormSection>

          <FormSection
            icon={<TypeIcon className="size-4" />}
            title="Task Title"
            hint="A short, clear summary of what needs to be done."
          >
            <div className="flex min-h-12 items-center rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-sm">
              {title}
            </div>
          </FormSection>

          <FormSection
            icon={<Flag className="size-4" />}
            title="Priority"
            hint="1 is highest priority."
          >
            <PriorityDisplay value={priority} />
          </FormSection>

          {/* Requirements */}
          <FormSection
            icon={<HelpCircle className="size-4" />}
            title="Requirements"
            hint="Information provided when the task was created."
          >
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
          </FormSection>

          {/* Delivery — gated behind leaving Todo */}
          {showDelivery ? (
            delItems.length > 0 && (
              <FormSection
                icon={<Package className="size-4" />}
                title="Delivery"
                hint="The finished work delivered for this task."
              >
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
              </FormSection>
            )
          ) : delItems.length > 0 ? (
            <section className="rounded-2xl border border-dashed border-border/60 p-6 text-center text-xs text-muted-foreground">
              Delivery fields unlock when the task moves past{" "}
              <span className="text-foreground">Todo</span>.
            </section>
          ) : null}

          {/* Comments */}
          <FormSection
            icon={<MessageSquare className="size-4" />}
            title="Comments"
            hint="Discussion about this task."
          >
            {comments.length > 0 && (
              <div className="mb-3 space-y-3">
                {comments.map((c) => (
                  <CommentItem key={c.id} comment={c} />
                ))}
              </div>
            )}
            {!trashed && (
              <CommentComposer
                mentionables={mentionables ?? []}
                onSend={sendComment}
              />
            )}
          </FormSection>
        </PageContainer>
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

// Status bar with Back / Next controls — the same move flow as dragging the
// card on the board: per-stage permissions, delivery gating, stage confirm
// dialogs on forward moves and the decline dialog (reason + mention) on
// backward moves.
function StatusMoveBar({
  projectId,
  taskId,
  move,
  items,
}: {
  projectId: string;
  taskId: string;
  move: TaskMoveData;
  items: ChecklistItem[];
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [moving, setMoving] = useState(false);
  const [confirmNext, setConfirmNext] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);

  const ordered = useMemo(
    () => [...move.statuses].sort((a, b) => a.order - b.order),
    [move.statuses],
  );
  const idx = ordered.findIndex((s) => s.id === move.statusId);
  const current = idx >= 0 ? ordered[idx] : null;
  const prev = idx > 0 ? ordered[idx - 1] : null;
  const next = idx >= 0 && idx < ordered.length - 1 ? ordered[idx + 1] : null;

  // Per-stage move rights on the CURRENT stage (mirrors the server check).
  const stagePerm = move.statusId ? move.perms.stages[move.statusId] : undefined;
  const canForward = move.perms.full || stagePerm?.forward === true;
  const canBack = move.perms.full || stagePerm?.rollback === true;

  const deliveryIncomplete = items
    .filter((i) => i.phase === "delivery" && i.mandatory && !i.completed)
    .map((i) => i.name);

  const showNext = next != null && canForward;
  const showBack = prev != null && canBack;

  if (!current || (!showNext && !showBack)) return null;

  const doMove = async (targetId: string): Promise<boolean> => {
    setMoving(true);
    try {
      await updateTaskStatus(taskId, targetId, projectId);
      // The board keeps its own client cache — refetch it so the card is in
      // the right column when the user navigates back.
      void queryClient.invalidateQueries({ queryKey: boardQueryKey(projectId) });
      router.refresh();
      return true;
    } catch (err) {
      setMoveError(err instanceof Error ? err.message : "Failed to move task");
      return false;
    } finally {
      setMoving(false);
    }
  };

  const handleNext = () => {
    if (!next || moving) return;
    if (
      next.name.toLowerCase() === "internal review" &&
      deliveryIncomplete.length > 0
    ) {
      const names = deliveryIncomplete.map((n) => `"${n}"`).join(", ");
      setMoveError(`Complete delivery items first: ${names}`);
      return;
    }
    if (CONFIRM_MESSAGES[next.name]) setConfirmNext(true);
    else void doMove(next.id);
  };

  // Backward move requires a decline reason that @mentions the submitter —
  // identical to dropping the card on an earlier column.
  const handleDecline = async (reason: string, file: File | null) => {
    if (!prev) return;
    const moved = await doMove(prev.id);
    if (!moved) return;

    const mention =
      move.submittedBy.id && move.submittedBy.name
        ? `@[${move.submittedBy.name}](${move.submittedBy.id}) `
        : "";
    const body = `${mention}${reason}`.trim();
    if (!body && !file) return;
    try {
      let attachmentIds: string[] = [];
      if (file) {
        const ids = uploadManager.enqueueMessage([file]);
        const uploaded = await uploadManager.waitForCompletion(ids);
        attachmentIds = uploaded
          .filter((i) => i.status === "done" && i.attachmentId)
          .map((i) => i.attachmentId!);
        uploadManager.removeItems(ids);
      }
      await addTaskComment(taskId, body, projectId, "rejection", attachmentIds);
      router.refresh();
    } catch {
      // Comment failure shouldn't block the move.
    }
  };

  const confirmMsg = next
    ? (CONFIRM_MESSAGES[next.name] ?? {
        title: `Move to ${next.name}`,
        description: `Are you sure you want to move this task to ${next.name}?`,
      })
    : null;

  return (
    <>
      <section className="rounded-2xl border border-border/60 bg-card/60 p-5 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Status:
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background px-3 py-1 text-sm font-medium text-foreground">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: current.color }}
            />
            {current.name}
          </span>
        </div>
        <div className="mt-4 flex items-center justify-between">
          {showBack ? (
            <Button
              variant="outline"
              className="rounded-full"
              disabled={moving}
              onClick={() => setDeclineOpen(true)}
              title={prev ? `Back to ${prev.name}` : undefined}
            >
              {moving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ArrowLeft className="size-4" />
              )}
              Back
            </Button>
          ) : (
            <span />
          )}
          {showNext ? (
            <Button
              variant="outline"
              className="rounded-full"
              disabled={moving}
              onClick={handleNext}
              title={next ? `Move to ${next.name}` : undefined}
            >
              Next
              {moving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ArrowRight className="size-4" />
              )}
            </Button>
          ) : (
            <span />
          )}
        </div>
      </section>

      {/* Forward move confirmation */}
      <ConfirmStatusDialog
        open={confirmNext}
        onClose={() => setConfirmNext(false)}
        onConfirm={() => {
          setConfirmNext(false);
          if (next) void doMove(next.id);
        }}
        title={confirmMsg?.title ?? ""}
        description={confirmMsg?.description ?? ""}
        confirmLabel={confirmMsg?.confirmLabel}
      />

      {/* Backward move decline */}
      <DeclineDialog
        open={declineOpen}
        fromLabel={current.name}
        toLabel={prev?.name ?? ""}
        mentionName={move.submittedBy.name}
        onClose={() => setDeclineOpen(false)}
        onConfirm={(reason, file) => {
          setDeclineOpen(false);
          void handleDecline(reason, file);
        }}
      />

      {/* Move error dialog */}
      <Dialog open={!!moveError} onOpenChange={(o) => !o && setMoveError(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-destructive" />
              Cannot move task
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{moveError}</p>
          <DialogFooter>
            <Button onClick={() => setMoveError(null)}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Comment composer with @ mention autocomplete. Mentions display as plain
// "@Name" while typing; on send each picked name is converted to the
// "@[Name](memberId)" token that sendMessage parses to notify the member and
// deliver the comment to their inbox.
function CommentComposer({
  mentionables,
  onSend,
}: {
  mentionables: { id: string; name: string }[];
  onSend: (body: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [picked, setPicked] = useState<{ id: string; name: string }[]>([]);
  const [pickerIndex, setPickerIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Trailing "@query" token in the draft opens the member picker.
  const mentionToken = useMemo(() => {
    const m = /(^|\s)@([^\s@]*)$/.exec(draft);
    if (!m) return null;
    return { start: m.index + m[1].length, query: m[2].toLowerCase() };
  }, [draft]);

  const pickerResults = useMemo(() => {
    if (!mentionToken) return [];
    const q = mentionToken.query;
    const filtered = q
      ? mentionables.filter((m) => m.name.toLowerCase().includes(q))
      : mentionables;
    return filtered.slice(0, 6);
  }, [mentionToken, mentionables]);
  const pickerOpen = !!mentionToken && pickerResults.length > 0;

  useEffect(() => {
    setPickerIndex(0);
  }, [mentionToken?.query, pickerResults.length]);

  const pickMember = (m: { id: string; name: string }) => {
    if (!mentionToken) return;
    const before = draft.slice(0, mentionToken.start);
    const after = draft.slice(
      mentionToken.start + 1 + mentionToken.query.length,
    );
    setDraft(`${before}@${m.name} ${after}`.replace(/ {2,}/g, " "));
    setPicked((prev) =>
      prev.some((p) => p.id === m.id) ? prev : [...prev, m],
    );
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const send = () => {
    let body = draft.trim();
    if (!body) return;
    // Longest names first so "@Adham Ali" isn't clobbered by "@Adham".
    const sorted = [...picked].sort((a, b) => b.name.length - a.name.length);
    for (const m of sorted) {
      body = body.split(`@${m.name}`).join(`@[${m.name}](${m.id})`);
    }
    setDraft("");
    setPicked([]);
    onSend(body);
  };

  return (
    <div className="relative">
      {pickerOpen && (
        <div className="absolute bottom-full left-0 z-10 mb-1 w-full max-w-sm overflow-hidden rounded-lg border border-border/60 bg-popover shadow-lg">
          <div className="border-b border-border/60 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Mention someone
          </div>
          <ul className="max-h-52 overflow-y-auto py-1">
            {pickerResults.map((m, i) => (
              <li key={m.id}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pickMember(m);
                  }}
                  onMouseEnter={() => setPickerIndex(i)}
                  className={cn(
                    "flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm",
                    i === pickerIndex ? "bg-surface" : "hover:bg-surface/60",
                  )}
                >
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
                    {m.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{m.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex items-center gap-2 rounded-md border border-border/60 bg-surface px-3 py-2">
        <AtSign className="h-4 w-4 shrink-0 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (pickerOpen) {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setPickerIndex((i) => (i + 1) % pickerResults.length);
                return;
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setPickerIndex(
                  (i) => (i - 1 + pickerResults.length) % pickerResults.length,
                );
                return;
              }
              if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                pickMember(pickerResults[pickerIndex]);
                return;
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setDraft((d) => d.replace(/(^|\s)@[^\s@]*$/, "$1"));
                return;
              }
            }
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Write a comment... Use @ to mention"
          className="h-9 border-0 bg-transparent px-0 focus-visible:ring-0"
        />
        <Button
          size="icon"
          className="h-9 w-9 shrink-0 rounded-md"
          onClick={send}
          disabled={!draft.trim()}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// Read-only version of the New Task page's priority picker.
function PriorityDisplay({ value }: { value: number | null }) {
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 4, 7, 8, 9, 10].map((n) => (
          <div
            key={n}
            className={cn(
              "grid h-9 w-9 place-items-center rounded-md border text-sm font-medium",
              value === n
                ? "border-primary bg-primary/15 text-primary"
                : "border-border/60 bg-surface text-muted-foreground",
            )}
          >
            {n}
          </div>
        ))}
      </div>
      <div className="mt-2 text-xs text-muted-foreground">
        {value === null ? "No priority selected" : `Priority ${value}`}
      </div>
    </div>
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
        {comment.body && (
          <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-muted-foreground">
            {renderCommentBody(comment.body)}
          </p>
        )}
        {comment.attachments.length > 0 && (
          <div className="mt-2 space-y-2">
            {comment.attachments.map((att) => (
              <AttachmentBubble key={att.id} attachment={att} mine={false} />
            ))}
          </div>
        )}
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
              href={`/api/files/${item.attachmentId}/download`}
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
  const formats = normalizeFormats(item.allowedFormats);
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

  const handlePick = async (picked: File | null) => {
    if (!picked) return;
    const err = await validateFileFull(
      picked,
      category,
      formats,
      item.aspectRatio,
    );
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
            <SafeVideo
              src={`/api/files/${item.attachmentId}/stream`}
              downloadHref={`/api/files/${item.attachmentId}/download`}
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
              href={`/api/files/${item.attachmentId}/download`}
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

// <video> that swaps to an honest explanation when the source can't actually
// be played (missing/failed upload, or the stream 404s) — a dead player with
// a play button that does nothing is confusing, especially on iOS.
function SafeVideo({
  src,
  downloadHref,
  className,
}: {
  src: string;
  downloadHref?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="flex w-full max-w-md flex-col items-center gap-2 rounded-lg border border-dashed border-border/60 bg-surface/40 px-4 py-6 text-center">
        <VideoOff className="h-6 w-6 text-muted-foreground" />
        <div className="text-xs text-muted-foreground">
          This video can&apos;t be played — the file may not have finished
          uploading. Try re-uploading it.
        </div>
        {downloadHref && (
          <a href={downloadHref} className="text-xs font-medium text-primary underline">
            Try downloading instead
          </a>
        )}
      </div>
    );
  }
  return (
    <video
      controls
      playsInline
      preload="metadata"
      src={src}
      onError={() => setFailed(true)}
      className={className}
    />
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
      <SafeVideo
        src={streamSrc}
        downloadHref={attachmentId ? `/api/files/${attachmentId}/download` : url}
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
