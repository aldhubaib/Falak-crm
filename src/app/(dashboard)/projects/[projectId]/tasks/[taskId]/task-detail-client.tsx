"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type ReactNode,
} from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  AtSign,
  Send,
  CircleCheck,
  Download,
  Trash2,
  Loader2,
  Play,
  Pause,
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
  Pencil,
  Type as TypeIcon,
  Calculator,
  CalendarClock,
  Eye,
} from "lucide-react";
import { VideoPlayer, formatMediaTime } from "@/components/media/video-player";
import { EffortDialog } from "@/components/effort/effort-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
import { fieldAppliesForGate } from "@/lib/checklist-config";
import {
  saveChecklistItemText,
  removeChecklistItemAttachment,
  removeChecklistItemFile,
  getChecklistItemState,
  backfillAttachmentDuration,
  deleteTask,
  updateTask,
  updateTaskDueDate,
  updateTaskStatus,
  assignTaskToMe,
  checkTaskMoveGates,
  previewForwardOwnership,
} from "@/actions/projects";
import {
  DEFAULT_PROJECT_TIMEZONE,
  formatZonedDateInput,
  parseZonedDateTime,
} from "@/lib/timezone";
import { ConfirmStatusDialog } from "@/components/board/confirm-status-dialog";
import { DeclineDialog } from "@/components/board/decline-dialog";
import {
  CONFIRM_MESSAGES,
  missingDataMessage,
} from "@/components/board/confirm-messages";
import { useActionHandler } from "@/hooks/use-action";
import { useErrorStore } from "@/lib/error-store";
import { createAppError } from "@/lib/errors";
import { restoreRecord, permanentDeleteRecord } from "@/actions/delete";
import { addTaskComment } from "@/actions/comments";
import { sendMessage } from "@/actions/messages";
import type { MessageAttachment, MessageDTO } from "@/actions/messages";
import { AttachmentBubble } from "@/components/messages/chat-attachments";
import { useChannel } from "@/components/realtime/hooks";
import { taskChannel, projectChannel } from "@/lib/channels";
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
  /** Owning checklist section (resolved server-side, synthetic for legacy). */
  sectionId: string;
  completed: boolean;
  textValue: string | null;
  attachmentId: string | null;
  attachmentName: string | null;
  attachmentUrl: string | null;
  attachmentContentType: string | null;
  /** Files of a multi-file field (empty for other kinds). */
  attachments: {
    id: string;
    name: string;
    contentType: string | null;
    url: string | null;
    durationSec: number | null;
  }[];
  mandatory: boolean;
  options: string[];
  allowedFileTypes: string | null;
  allowedFormats: string[];
  aspectRatio: string | null;
  /** Whether this field is read-only at the task's current stage. */
  locked: boolean;
  /** Whether this field should render at the task's current stage. */
  visible: boolean;
};

// Editable field group from Settings → Task Types. phase "create" = shown
// like the old Requirements section; "delivery" = gated like Delivery.
export type TaskSection = {
  id: string;
  name: string;
  phase: string;
};

// The History side panel loads in its own chunk only when opened.
const TaskHistoryPanel = dynamic(() => import("./task-history-panel"), {
  ssr: false,
});

// Patch one checklist field's local state (completed flag, attachment info)
// after a save/upload/remove — replaces the old router.refresh() per change,
// which re-rendered the entire RSC tree.
const ChecklistPatchContext = createContext<
  (id: string, patch: Partial<ChecklistItem>) => void
>(() => {});

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

const EMPTY_UPLOADS: UploadItem[] = [];

// All upload entries for one checklist item — multi-file fields can have
// several files in flight at once. The snapshot array from the manager is
// stable between notifications, so the filtered list is memoized on it.
function useChecklistUploads(itemId: string): UploadItem[] {
  const subscribe = useCallback(
    (cb: () => void) => uploadManager.subscribe(cb),
    [],
  );
  const getSnapshot = useCallback(() => uploadManager.getItems(), []);
  const all = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_UPLOADS);
  return useMemo(
    () =>
      all.filter(
        (i) =>
          i.target.kind === "checklist_item" &&
          i.target.checklistItemId === itemId,
      ),
    [all, itemId],
  );
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
  submittedBy: { id: string | null; name: string | null; avatar?: string | null };
  /** Current assignee — shown in the confirm dialog's ownership chips. */
  assignee?: { id?: string; name: string; avatar: string | null } | null;
  /** Current viewer — the "→ me" side of the ownership chips. */
  me?: { name: string; avatar: string | null } | null;
  /** False when the viewer is a non-assignee: forward moves are the
   *  assignee's to make, so "Next" hides until they take ownership
   *  (the read-only banner's chip). Mirrors the server rule. */
  assigneeGateOpen?: boolean;
};

// Assignee-only editing: who owns the task, whether the current viewer is
// read-only because of it, and whether they may claim it from the banner.
export type TaskOwnership = {
  assignee: { id: string; name: string; avatar: string | null } | null;
  /** Render the ownership banner (viewer is not the task's assignee). */
  show: boolean;
  /** True when the viewer is a non-assignee locked out of the work product. */
  readOnly: boolean;
  /** Forward right on the current stage — allows the banner's self-assign. */
  canTakeOwnership: boolean;
};

export function TaskDetailClient({
  projectId,
  taskId,
  canDelete,
  canEditTitle,
  canEditFields,
  canChangeDueDate,
  dueDate,
  timezone,
  isOwner,
  ownership,
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
  sections,
  comments,
  history,
  totalTimeMs,
  move,
  mentionables,
}: {
  projectId: string;
  taskId: string;
  canDelete: boolean;
  /** Whether the member may edit the title (Modify right at the current stage). */
  canEditTitle: boolean;
  /** Whether the member may edit checklist fields at the current stage. */
  canEditFields: boolean;
  /** Modify right at the current stage — shows "Change due date" in ⋮. */
  canChangeDueDate?: boolean;
  /** Current deadline (ISO), if the task has one. */
  dueDate?: string | null;
  /** Project timezone — due dates are end-of-day in this zone. */
  timezone?: string;
  /** Workspace owner — unlocks the Effort breakdown (audit) dialog. */
  isOwner?: boolean;
  /** Assignee-only editing state (read-only banner + take ownership). */
  ownership?: TaskOwnership | null;
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
  /** Ordered field sections of the task's type. */
  sections: TaskSection[];
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
  const [effortOpen, setEffortOpen] = useState(false);

  // Change due date (⋮ menu): date picker seeded with the current deadline;
  // past dates are blocked here and re-checked on the server.
  const tz = timezone ?? DEFAULT_PROJECT_TIMEZONE;
  const todayStr = formatZonedDateInput(new Date(), tz).date;
  const [dueDateOpen, setDueDateOpen] = useState(false);
  const [dueDraft, setDueDraft] = useState("");
  const openDueDialog = () => {
    setDueDraft(
      dueDate ? formatZonedDateInput(new Date(dueDate), tz).date : todayStr,
    );
    setDueDateOpen(true);
  };
  const { run: runDueDate, loading: savingDueDate } = useActionHandler();
  const handleSaveDueDate = () => {
    if (!dueDraft || dueDraft < todayStr) return;
    runDueDate("Change Due Date", async () => {
      // Deadlines are end-of-day in the project's timezone.
      await updateTaskDueDate(
        taskId,
        parseZonedDateTime(dueDraft, "23:59", tz, new Date()),
      );
      setDueDateOpen(false);
      router.refresh();
      return true;
    });
  };

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

  // Claim the task from the read-only banner — the chip opens a confirmation
  // dialog first; on success the server render flips canEditFields and the
  // banner disappears.
  const [confirmOwnership, setConfirmOwnership] = useState(false);
  const { run: runTakeOwnership, loading: takingOwnership } = useActionHandler();
  const handleTakeOwnership = () =>
    runTakeOwnership("Take Ownership", async () => {
      await assignTaskToMe(taskId, projectId);
      void queryClient.invalidateQueries({ queryKey: boardQueryKey(projectId) });
      router.refresh();
      return true;
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

  // Checklist fields live in local state so saves/uploads/removals patch in
  // place instead of refreshing the whole page. Server props re-seed on real
  // navigations.
  const [itemList, setItemList] = useState<ChecklistItem[]>(items);
  useEffect(() => setItemList(items), [items]);
  const patchChecklistItem = useCallback(
    (id: string, patch: Partial<ChecklistItem>) => {
      setItemList((prev) =>
        prev.map((i) => (i.id === id ? { ...i, ...patch } : i)),
      );
    },
    [],
  );

  // Group fields under their (editable) sections in section order. A section
  // is just a heading: it renders only when at least one of its fields is
  // visible at the current stage (each field's own "Visible From" rule).
  const sectionGroups = sections.map((s) => ({
    section: s,
    items: itemList.filter(
      (i) =>
        i.sectionId === s.id && i.visible && fieldAppliesForGate(i, itemList),
    ),
  }));
  const visibleGroups = sectionGroups.filter((g) => g.items.length > 0);

  // Comments live in local state so sending/receiving one never triggers a
  // full router.refresh() (which re-renders the whole RSC tree and re-runs
  // auth in the layout). Server props re-seed the list on real navigations.
  const [commentList, setCommentList] = useState<CommentEntry[]>(comments);
  useEffect(() => setCommentList(comments), [comments]);

  const appendComment = useCallback((m: MessageDTO) => {
    setCommentList((prev) =>
      prev.some((c) => c.id === m.id)
        ? prev
        : [
            ...prev,
            {
              id: m.id,
              body: m.body,
              authorName: m.authorName,
              createdAt: m.createdAt,
              attachments: m.attachments,
            },
          ],
    );
  }, []);

  const sendComment = (body: string) => {
    startTransition(async () => {
      const res = await sendMessage({ taskId, projectId, body });
      if (res.ok) appendComment(res.data);
    });
  };

  // Live comments/rejections: append when a new message lands on this task.
  useChannel(taskChannel(taskId), (data) => {
    const d = data as { type?: string; message?: MessageDTO } | null;
    if (d?.type === "message.new" && d.message) appendComment(d.message);
  });

  // Live stage changes: when THIS task moves (from the board, another tab or
  // another user), re-render the page so stage-scoped fields (Visible From /
  // Locked From / gates) reflect the new stage without a manual reload.
  useChannel(projectChannel(projectId), (data) => {
    const d = data as { type?: string; taskId?: string } | null;
    if (d?.type === "task.moved" && d.taskId === taskId) router.refresh();
  });

  return (
    <ChecklistPatchContext.Provider value={patchChecklistItem}>
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
        actions={
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
            <DropdownMenuContent align="end" className="w-56">
              {!trashed && move && (
                <TaskStatusMoveMenu
                  projectId={projectId}
                  taskId={taskId}
                  move={move}
                  items={itemList}
                  statusName={statusName}
                  statusColor={statusColor}
                />
              )}
              {!trashed && move && <DropdownMenuSeparator />}
              {!trashed && canChangeDueDate && (
                <DropdownMenuItem onSelect={openDueDialog}>
                  <CalendarClock className="size-4" />
                  Change due date
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={() => setHistoryOpen(true)}>
                <History className="size-4" />
                History
              </DropdownMenuItem>
              {isOwner && (
                <DropdownMenuItem onSelect={() => setEffortOpen(true)}>
                  <Calculator className="size-4" />
                  Effort
                </DropdownMenuItem>
              )}
              {canDelete && (
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={() => setConfirmDelete(true)}
                >
                  <Trash2 className="size-4" />
                  Delete task
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      {isOwner && (
        <EffortDialog
          taskId={taskId}
          open={effortOpen}
          onOpenChange={setEffortOpen}
        />
      )}

      {/* Change due date (⋮ menu). */}
      <Dialog
        open={dueDateOpen}
        onOpenChange={(o) => !savingDueDate && setDueDateOpen(o)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="size-4" />
              Change due date
            </DialogTitle>
            <DialogDescription>
              {dueDate
                ? `Current deadline: ${new Intl.DateTimeFormat("en-US", {
                    timeZone: tz,
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  }).format(new Date(dueDate))}. `
                : "This task has no deadline yet. "}
              Pick a new one — past dates aren&apos;t allowed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <input
              type="date"
              value={dueDraft}
              min={todayStr}
              onChange={(e) => setDueDraft(e.target.value)}
              className="h-9 w-full rounded-lg border border-border/60 bg-background/60 px-2 text-xs tabular-nums text-foreground outline-none [color-scheme:dark]"
            />
            {dueDraft && dueDraft < todayStr && (
              <p className="text-tiny text-destructive">
                The due date can&apos;t be in the past.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              disabled={savingDueDate}
              onClick={() => setDueDateOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!dueDraft || dueDraft < todayStr || savingDueDate}
              onClick={handleSaveDueDate}
            >
              {savingDueDate && <Loader2 className="size-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
          {/* Assignee-only editing: non-assignees see who owns the task and can
              claim it here when they hold the Forward right on this stage.
              Non-owners are read-only; workspace owners can still edit. */}
          {!trashed && ownership?.show && (
            <div className="flex flex-wrap items-center gap-3 rounded-md border border-border/60 bg-surface px-4 py-3">
              <Eye className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1 text-sm text-muted-foreground">
                {ownership.readOnly
                  ? "Only the assignee can edit — you are viewing in read-only."
                  : "This task belongs to someone else — as the workspace owner you can still edit."}
              </div>
              <div className="flex shrink-0 items-center gap-2.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Assignee
                </span>
                <button
                  type="button"
                  disabled={!ownership.canTakeOwnership || takingOwnership}
                  onClick={() => setConfirmOwnership(true)}
                  title={
                    ownership.canTakeOwnership
                      ? "Take ownership — assign this task to yourself and edit"
                      : "You need permission to move tasks forward from this stage to take ownership"
                  }
                  className={cn(
                    "flex items-center gap-2 rounded-full border border-border/60 bg-background/60 py-1 pl-1 pr-3 text-xs font-medium",
                    ownership.canTakeOwnership
                      ? "transition-colors hover:border-primary/60 hover:bg-primary/10"
                      : "cursor-default opacity-80",
                  )}
                >
                  {takingOwnership ? (
                    <Loader2 className="size-6 animate-spin p-1 text-muted-foreground" />
                  ) : ownership.assignee?.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={ownership.assignee.avatar}
                      alt={ownership.assignee.name}
                      className="size-6 rounded-full object-cover"
                    />
                  ) : (
                    <span className="grid size-6 place-items-center rounded-full bg-primary/20 text-[10px] font-semibold text-primary">
                      {(ownership.assignee?.name ?? "?")
                        .split(/\s+/)
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((w) => w[0]!.toUpperCase())
                        .join("") || "?"}
                    </span>
                  )}
                  <span className="max-w-40 truncate">
                    {ownership.assignee?.name ?? "Unassigned"}
                  </span>
                </button>
              </div>
            </div>
          )}
          {/* Take-ownership confirmation (assignee chip in the banner). */}
          {ownership?.show && (
            <ConfirmStatusDialog
              open={confirmOwnership}
              onClose={() => setConfirmOwnership(false)}
              onConfirm={() => {
                setConfirmOwnership(false);
                void handleTakeOwnership();
              }}
              title="Assign to me"
              description="By confirming, this task will be assigned to you and you take ownership of it."
              confirmLabel="Assign to Me"
              assignToMe
              currentAssigneeName={ownership.assignee?.name}
              currentAssigneeAvatar={ownership.assignee?.avatar}
              meName={move?.me?.name}
              meAvatar={move?.me?.avatar}
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
            <TaskTitleField
              taskId={taskId}
              title={title}
              editable={canEditTitle}
            />
          </FormSection>

          <FormSection
            icon={<Flag className="size-4" />}
            title="Priority"
            hint="1 is highest priority."
          >
            <PriorityDisplay value={priority} />
          </FormSection>

          {/* Checklist sections in template order. Each renders only when it
              has at least one visible field; empty sections simply don't
              show. One placeholder renders when nothing is visible at all. */}
          {visibleGroups.map((g) => (
            <FormSection
              key={g.section.id}
              icon={
                g.section.phase === "create" ? (
                  <HelpCircle className="size-4" />
                ) : (
                  <Package className="size-4" />
                )
              }
              title={g.section.name}
            >
              <div className="space-y-6">
                {g.items.map((item, i) => (
                  <TaskField
                    key={item.id}
                    item={item}
                    index={i + 1}
                    projectId={projectId}
                    readOnly={item.locked || !canEditFields}
                  />
                ))}
              </div>
            </FormSection>
          ))}
          {visibleGroups.length === 0 && (
            <FormSection
              icon={<HelpCircle className="size-4" />}
              title={sections[0]?.name ?? "Fields"}
            >
              <div className="rounded-md border border-dashed border-border/60 p-6 text-center text-xs text-muted-foreground">
                No fields on this task at this stage.
              </div>
            </FormSection>
          )}

          {/* Comments */}
          <FormSection
            icon={<MessageSquare className="size-4" />}
            title="Comments"
            hint="Discussion about this task."
          >
            {commentList.length > 0 && (
              <div className="mb-3 space-y-3">
                {commentList.map((c) => (
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
    </ChecklistPatchContext.Provider>
  );
}

// Back / Next status controls in the header ⋮ menu — same move flow as the
// board drag: per-stage permissions, delivery gating, confirm on forward,
// decline dialog on backward.
function TaskStatusMoveMenu({
  projectId,
  taskId,
  move,
  items,
  statusName,
  statusColor,
}: {
  projectId: string;
  taskId: string;
  move: TaskMoveData;
  items: ChecklistItem[];
  statusName: string | null;
  statusColor: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [moving, setMoving] = useState(false);
  const [confirmNext, setConfirmNext] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  // Predicted owner after the forward move (e.g. review approval hands the
  // task back to the worker) — fetched when the confirm dialog opens.
  const [ownershipPreview, setOwnershipPreview] = useState<{
    id: string;
    name: string;
    avatar: string | null;
    isMe: boolean;
  } | null>(null);

  const ordered = useMemo(
    () => [...move.statuses].sort((a, b) => a.order - b.order),
    [move.statuses],
  );
  const idx = ordered.findIndex((s) => s.id === move.statusId);
  const current = idx >= 0 ? ordered[idx] : null;
  const prev = idx > 0 ? ordered[idx - 1] : null;
  const next = idx >= 0 && idx < ordered.length - 1 ? ordered[idx + 1] : null;

  const nextId = next?.id ?? null;
  useEffect(() => {
    if (!confirmNext || !nextId) {
      setOwnershipPreview(null);
      return;
    }
    let cancelled = false;
    previewForwardOwnership(taskId, nextId, projectId)
      .then((p) => {
        if (!cancelled) setOwnershipPreview(p);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [confirmNext, nextId, taskId, projectId]);
  // Only surface the hand-off chip when ownership actually changes.
  const previewedOwner =
    ownershipPreview && ownershipPreview.id !== move.assignee?.id
      ? ownershipPreview
      : null;

  // Per-stage move rights on the CURRENT stage (mirrors the server check).
  // Forward additionally requires being the assignee (or workspace owner /
  // unassigned task): a non-assignee takes ownership first via the banner.
  const stagePerm = move.statusId ? move.perms.stages[move.statusId] : undefined;
  const canForward =
    (move.perms.full || stagePerm?.forward === true) &&
    move.assigneeGateOpen !== false;
  const canBack = move.perms.full || stagePerm?.rollback === true;

  const showNext = next != null && canForward;
  const showBack = prev != null && canBack;

  const doMove = async (targetId: string): Promise<boolean> => {
    setMoving(true);
    try {
      const result = await updateTaskStatus(taskId, targetId, projectId);
      // Blocked moves come back as data (not a thrown error) so the friendly
      // message survives production builds.
      if (!result.ok) {
        setMoveError(result.error);
        return false;
      }
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
    // Stage-gate dry-run against fresh server data BEFORE the confirm dialog
    // — missing data surfaces first, same as dragging on the board.
    void (async () => {
      try {
        const gate = await checkTaskMoveGates(taskId, next.id, projectId);
        if (!gate.ok) {
          setMoveError(missingDataMessage(gate.missing));
          return;
        }
      } catch {
        // Dry-run unavailable — the real move still enforces every gate.
      }
      if (CONFIRM_MESSAGES[next.name]) setConfirmNext(true);
      else void doMove(next.id);
    })();
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
      // The comment lands in the thread via the task channel's message.new
      // event — no page refresh needed.
      await addTaskComment(taskId, body, projectId, "rejection", attachmentIds);
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
      <DropdownMenuLabel className="flex items-center gap-2 py-2 font-normal">
        <span className="text-xxs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Status:
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background px-2.5 py-0.5 text-xs font-medium text-foreground">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: current?.color ?? statusColor }}
          />
          {current?.name ?? statusName ?? "Unknown"}
        </span>
      </DropdownMenuLabel>
      {(showBack || showNext) && (
        <>
          <DropdownMenuSeparator />
          {showBack && (
            <DropdownMenuItem
              disabled={moving}
              onSelect={(e) => {
                e.preventDefault();
                setDeclineOpen(true);
              }}
            >
              {moving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ArrowLeft className="size-4" />
              )}
              Back
              <span className="ml-auto text-xs text-muted-foreground">
                {prev?.name}
              </span>
            </DropdownMenuItem>
          )}
          {showNext && (
            <DropdownMenuItem
              disabled={moving}
              onSelect={(e) => {
                e.preventDefault();
                handleNext();
              }}
            >
              {moving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ArrowRight className="size-4" />
              )}
              Next
              <span className="ml-auto text-xs text-muted-foreground">
                {next?.name}
              </span>
            </DropdownMenuItem>
          )}
        </>
      )}

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
        assignToMe={!!confirmMsg?.assignToMe}
        currentAssigneeName={move.assignee?.name}
        currentAssigneeAvatar={move.assignee?.avatar}
        meName={move.me?.name}
        meAvatar={move.me?.avatar}
        nextOwnerName={previewedOwner?.name}
        nextOwnerAvatar={previewedOwner?.avatar}
        nextOwnerIsMe={previewedOwner?.isMe}
      />

      {/* Backward move decline */}
      <DeclineDialog
        open={declineOpen}
        fromLabel={current?.name ?? statusName ?? ""}
        toLabel={prev?.name ?? ""}
        mentionName={move.submittedBy.name}
        mentionAvatar={move.submittedBy.avatar}
        meName={move.me?.name}
        meAvatar={move.me?.avatar}
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
          <p className="text-sm whitespace-pre-line text-muted-foreground">
            {moveError}
          </p>
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
  const overlayRef = useRef<HTMLDivElement>(null);

  // Picked "@Name" mentions render in blue while typing. An input can only
  // have one text color, so a mirror overlay paints the highlighted text and
  // the input's own text turns transparent (keeping the caret) on top of it.
  const highlightParts = useMemo(() => {
    if (picked.length === 0) return null;
    const names = picked
      .map((p) => `@${p.name}`)
      .sort((a, b) => b.length - a.length);
    const nameSet = new Set(names);
    const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const re = new RegExp(`(${escaped.join("|")})`, "g");
    const parts = draft.split(re).filter((p) => p !== "");
    if (!parts.some((p) => nameSet.has(p))) return null;
    return parts.map((part, i) =>
      nameSet.has(part) ? (
        <span key={i} className="font-medium text-primary">
          {part}
        </span>
      ) : (
        <span key={i}>{part}</span>
      ),
    );
  }, [draft, picked]);

  const syncOverlayScroll = () => {
    if (overlayRef.current && inputRef.current) {
      overlayRef.current.scrollLeft = inputRef.current.scrollLeft;
    }
  };

  useEffect(() => {
    syncOverlayScroll();
  }, [draft]);

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
                    {m.id === "all" ? "@" : m.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {m.name}
                    {m.id === "all" && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        Notify everyone
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex items-center gap-2 rounded-md border border-border/60 bg-surface px-3 py-2">
        <AtSign className="h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="relative min-w-0 flex-1">
          {highlightParts && (
            <div
              ref={overlayRef}
              aria-hidden
              className="pointer-events-none absolute inset-0 flex h-9 items-center overflow-hidden whitespace-pre text-base text-foreground md:text-sm"
            >
              {highlightParts}
            </div>
          )}
        <Input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onScroll={syncOverlayScroll}
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
          className={cn(
            "relative h-9 border-0 bg-transparent px-0 focus-visible:ring-0",
            highlightParts && "text-transparent caret-foreground",
          )}
        />
        </div>
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

// Inline-editable task title: pencil → input → save (Enter) / cancel (Esc).
// Only rendered editable when the member holds the Modify right for the
// task's current stage; the server action re-checks the same rule.
function TaskTitleField({
  taskId,
  title,
  editable,
}: {
  taskId: string;
  title: string;
  editable: boolean;
}) {
  const router = useRouter();
  const { run, loading } = useActionHandler();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);

  // Keep the draft in sync when a refresh brings a new title.
  useEffect(() => setDraft(title), [title]);

  const save = async () => {
    const next = draft.trim();
    if (!next || next === title) {
      setEditing(false);
      setDraft(title);
      return;
    }
    const ok = await run("Rename Task", async () => {
      await updateTask(taskId, { title: next });
      router.refresh();
      return true;
    });
    if (ok) setEditing(false);
  };

  if (!editing) {
    return (
      <div className="flex min-h-12 items-center gap-2 rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-sm">
        <span className="min-w-0 flex-1 truncate">{title}</span>
        {editable && (
          <Button
            variant="ghost"
            size="icon"
            className="size-7 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
            aria-label="Edit title"
            onClick={() => setEditing(true)}
          >
            <Pencil className="size-3.5" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        autoFocus
        value={draft}
        disabled={loading}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void save();
          if (e.key === "Escape") {
            setEditing(false);
            setDraft(title);
          }
        }}
        className="h-12 rounded-xl"
      />
      <Button size="sm" disabled={loading || !draft.trim()} onClick={save}>
        {loading ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
        Save
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={loading}
        onClick={() => {
          setEditing(false);
          setDraft(title);
        }}
      >
        Cancel
      </Button>
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
  const patchItem = useContext(ChecklistPatchContext);
  const { push } = useErrorStore();
  const [, startTransition] = useTransition();

  const saveText = (value: string) => {
    if (readOnly) return;
    const previous = { textValue: item.textValue, completed: item.completed };
    // Optimistic: the typed value is the new truth; the server only decides
    // whether the field now counts as complete.
    patchItem(item.id, { textValue: value });
    startTransition(async () => {
      try {
        const res = await saveChecklistItemText(item.id, value, projectId);
        patchItem(item.id, { completed: res.completed });
      } catch (err) {
        patchItem(item.id, previous);
        push(createAppError(err));
      }
    });
  };

  if (item.type === "multi_file") {
    return (
      <TaskMultiFileField item={item} projectId={projectId} readOnly={readOnly} />
    );
  }

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
      <SearchableSelect
        value={item.textValue || undefined}
        disabled={readOnly}
        onValueChange={(v) => saveText(v)}
        placeholder="Select an option…"
        searchPlaceholder="Search options…"
        className="h-11 rounded-xl border-border/60 bg-background/60"
        options={item.options.map((o) => ({ value: o, label: o }))}
      />
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

  const chooseYes = () => {
    if (readOnly || value === "yes") return;
    onSaveText(serializeYesNo("yes", parsed.text));
  };
  const chooseNo = () => {
    if (readOnly || value === "no") return;
    onSaveText("no");
  };

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
  const patchItem = useContext(ChecklistPatchContext);
  const [, startTransition] = useTransition();
  const upload = useChecklistUpload(item.id);
  const required = !!yesFollowUp(item.type)?.file?.required;

  // When the upload finishes, fetch the field's fresh state (attachment id,
  // name, presigned preview URL) and patch it in place — no page refresh.
  useEffect(() => {
    if (upload?.status !== "done") return;
    getChecklistItemState(item.id, projectId)
      .then((s) => patchItem(item.id, s))
      .catch(() => {});
  }, [upload?.status, item.id, projectId, patchItem]);

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
      patchItem(item.id, {
        attachmentId: null,
        attachmentName: null,
        attachmentUrl: null,
        attachmentContentType: null,
        completed: false,
      });
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
        className={cn(
          "flex w-full items-center gap-2 rounded-xl border border-dashed bg-surface/40 px-3 py-3 text-left text-sm text-muted-foreground transition-colors hover:border-border hover:bg-surface",
          required ? "border-destructive/50" : "border-border/70",
        )}
      >
        <Paperclip className="h-4 w-4" />
        <span>
          Attach file
          {required && <span className="ml-1 text-destructive">*</span>}
        </span>
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
  const patchItem = useContext(ChecklistPatchContext);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const upload = useChecklistUpload(item.id);
  const durationBackfilled = useRef(false);
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

  // When an upload finishes, fetch the saved attachment's fresh state and
  // patch this field in place — no full page refresh.
  useEffect(() => {
    if (upload?.status !== "done") return;
    getChecklistItemState(item.id, projectId)
      .then((s) => patchItem(item.id, s))
      .catch(() => {});
  }, [upload?.status, item.id, projectId, patchItem]);

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
      patchItem(item.id, {
        attachmentId: null,
        attachmentName: null,
        attachmentUrl: null,
        attachmentContentType: null,
        completed: false,
      });
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
            <VideoPlayer
              src={`/api/files/${item.attachmentId}/stream`}
              downloadHref={`/api/files/${item.attachmentId}/download`}
              onDurationKnown={(sec) =>
                backfillMediaDurationOnce(
                  item.attachmentId!,
                  projectId,
                  null,
                  sec,
                  durationBackfilled,
                )
              }
            />
          ) : ct.startsWith("audio/") ? (
            <audio
              controls
              preload="metadata"
              src={`/api/files/${item.attachmentId}/stream`}
              className="w-full max-w-md"
              onLoadedMetadata={(e) =>
                backfillMediaDurationOnce(
                  item.attachmentId!,
                  projectId,
                  null,
                  e.currentTarget.duration,
                  durationBackfilled,
                )
              }
            />
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

// Persist media length when the browser reads it but the DB row is missing it.
function backfillMediaDurationOnce(
  attachmentId: string,
  projectId: string,
  knownDurationSec: number | null | undefined,
  sec: number,
  backfilledRef: React.MutableRefObject<boolean>,
) {
  if (backfilledRef.current) return;
  if (knownDurationSec != null && knownDurationSec > 0) return;
  if (!(sec > 0) || !Number.isFinite(sec)) return;
  backfilledRef.current = true;
  void backfillAttachmentDuration(attachmentId, sec, projectId).catch(() => {});
}

// One row in a multi-file list — play opens a video popup; audio plays inline.
function MultiFileListRow({
  file,
  projectId,
  fallbackIcon: FallbackIcon,
  readOnly,
  removing,
  onRemove,
}: {
  file: ChecklistItem["attachments"][number];
  projectId: string;
  fallbackIcon: React.ComponentType<{ className?: string }>;
  readOnly: boolean;
  removing: boolean;
  onRemove: () => void;
}) {
  const ct = file.contentType ?? "";
  const isVideo = ct.startsWith("video/");
  const isAudio = ct.startsWith("audio/");
  const isMedia = isVideo || isAudio;
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const [durationSec, setDurationSec] = useState(file.durationSec);
  const durationBackfilled = useRef(false);

  const streamSrc = `/api/files/${file.id}/stream`;
  const durationLabel =
    durationSec != null && durationSec > 0 ? formatMediaTime(durationSec) : null;

  const pauseOtherMedia = useCallback(() => {
    document.querySelectorAll("[data-multi-file-media]").forEach((el) => {
      if (el instanceof HTMLMediaElement) el.pause();
    });
  }, []);

  const toggleAudio = useCallback(async () => {
    const el = audioRef.current;
    if (!el) return;
    try {
      if (el.paused) {
        pauseOtherMedia();
        await el.play();
      } else {
        el.pause();
      }
    } catch {
      setPlaying(false);
    }
  }, [pauseOtherMedia]);

  const openVideo = useCallback(() => {
    pauseOtherMedia();
    setVideoOpen(true);
  }, [pauseOtherMedia]);

  const onMetadata = useCallback(
    (sec: number) => {
      if (durationSec == null || durationSec <= 0) {
        setDurationSec(sec);
      }
      backfillMediaDurationOnce(
        file.id,
        projectId,
        file.durationSec,
        sec,
        durationBackfilled,
      );
    },
    [durationSec, file.durationSec, file.id, projectId],
  );

  return (
    <>
      <div className="flex items-center gap-3 rounded-xl border border-green-500/50 bg-green-500/5 px-3 py-2">
        {isMedia ? (
          <>
            <button
              type="button"
              onClick={isVideo ? openVideo : toggleAudio}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/15 text-primary hover:bg-primary/25"
              aria-label={
                isVideo
                  ? `Play ${file.name} in popup`
                  : playing
                    ? `Pause ${file.name}`
                    : `Play ${file.name}`
              }
            >
              {isVideo || !playing ? (
                <Play className="h-4 w-4 fill-current" />
              ) : (
                <Pause className="h-4 w-4 fill-current" />
              )}
            </button>
            {isAudio && (
              <audio
                ref={audioRef}
                data-multi-file-media
                preload="metadata"
                src={streamSrc}
                className="hidden"
                onLoadedMetadata={(e) => onMetadata(e.currentTarget.duration)}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onEnded={() => setPlaying(false)}
              />
            )}
          </>
        ) : ct.startsWith("image/") && file.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={file.url}
          alt={file.name}
          className="h-10 w-10 shrink-0 rounded object-cover"
        />
      ) : (
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded bg-muted/30 text-muted-foreground">
          <FallbackIcon className="h-4 w-4" />
        </span>
      )}

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-foreground">
          {file.name}
          {durationLabel && (
            <span className="text-muted-foreground"> · {durationLabel}</span>
          )}
        </div>
      </div>

      <a
        href={`/api/files/${file.id}/download`}
        rel="noreferrer"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted/40 hover:text-foreground"
        aria-label={`Download ${file.name}`}
      >
        <Download className="h-4 w-4" />
      </a>
      {!readOnly && (
        <button
          type="button"
          disabled={removing}
          onClick={onRemove}
          aria-label={`Remove ${file.name}`}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-destructive/15 hover:text-destructive disabled:opacity-50"
        >
          {removing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </button>
      )}
      </div>

      {isVideo && (
        <Dialog open={videoOpen} onOpenChange={setVideoOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle className="truncate pr-8">{file.name}</DialogTitle>
              {durationLabel && (
                <DialogDescription>{durationLabel}</DialogDescription>
              )}
            </DialogHeader>
            <VideoPlayer
              key={file.id}
              src={streamSrc}
              downloadHref={`/api/files/${file.id}/download`}
              className="max-w-none"
              videoClassName="max-h-[60vh] w-full"
              autoPlay
              onDurationKnown={onMetadata}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

// Multi-file field: any number of uploads live on one checklist item. Files
// are listed with per-file download/remove, and the drop zone stays available
// to add more. The field counts as complete while at least one file remains.
function TaskMultiFileField({
  item,
  projectId,
  readOnly,
}: {
  item: ChecklistItem;
  projectId: string;
  readOnly: boolean;
}) {
  const patchItem = useContext(ChecklistPatchContext);
  const { push } = useErrorStore();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const uploads = useChecklistUploads(item.id);
  const activeUploads = uploads.filter(
    (u) =>
      u.status === "queued" ||
      u.status === "uploading" ||
      u.status === "completing",
  );

  const category = item.allowedFileTypes;
  const formats = normalizeFormats(item.allowedFormats);
  const Icon = categoryIcon(category);
  const accepts = allowedExtsFor(category, item.allowedFormats);
  const accept = accepts.length > 0 ? accepts.join(",") : undefined;

  // Each finished upload bumps this count → refetch the saved file list once
  // per completion and patch the field in place (no full page refresh).
  const doneCount = uploads.filter((u) => u.status === "done").length;
  useEffect(() => {
    if (doneCount === 0) return;
    getChecklistItemState(item.id, projectId)
      .then((s) => patchItem(item.id, s))
      .catch(() => {});
  }, [doneCount, item.id, projectId, patchItem]);

  const handlePick = async (picked: File[]) => {
    if (picked.length === 0) return;
    const errors: string[] = [];
    for (const file of picked) {
      const err = await validateFileFull(
        file,
        category,
        formats,
        item.aspectRatio,
      );
      if (err) {
        errors.push(`${file.name}: ${err}`);
        continue;
      }
      uploadManager.enqueueChecklist(file, {
        checklistItemId: item.id,
        projectId,
        label: item.name,
      });
    }
    setError(errors.length > 0 ? errors.join(" · ") : null);
  };

  const removeFile = (attachmentId: string) => {
    setRemovingId(attachmentId);
    startTransition(async () => {
      try {
        const res = await removeChecklistItemFile(item.id, attachmentId, projectId);
        patchItem(item.id, {
          attachments: item.attachments.filter((a) => a.id !== attachmentId),
          completed: res.completed,
        });
      } catch (err) {
        push(createAppError(err));
      } finally {
        setRemovingId(null);
      }
    });
  };

  const hasFiles = item.attachments.length > 0;

  return (
    <div className="space-y-2">
      {hasFiles && (
        <div className="space-y-1.5">
          {item.attachments.map((file) => (
            <MultiFileListRow
              key={file.id}
              file={file}
              projectId={projectId}
              fallbackIcon={Icon}
              readOnly={readOnly}
              removing={removingId === file.id}
              onRemove={() => removeFile(file.id)}
            />
          ))}
        </div>
      )}

      {activeUploads.map((upload) => (
        <div
          key={upload.id}
          className="flex items-center gap-3 rounded-xl border border-border/60 bg-surface/40 px-3 py-2"
        >
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm text-foreground">
              {upload.file.name}
            </div>
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
      ))}

      {readOnly ? (
        !hasFiles &&
        activeUploads.length === 0 && (
          <div className="rounded-xl border border-dashed border-border/60 bg-surface/40 px-3 py-4 text-center text-xs text-muted-foreground">
            No files uploaded.
          </div>
        )
      ) : (
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
              handlePick(Array.from(e.dataTransfer.files ?? []));
            }}
            className={cn(
              "flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-center transition-colors",
              hasFiles || activeUploads.length > 0 ? "py-4" : "py-10 gap-3",
              error
                ? "border-destructive/60 bg-destructive/5"
                : dragOver
                  ? "border-primary bg-primary/5"
                  : "border-border/70 bg-surface/40 hover:border-border hover:bg-surface",
            )}
          >
            <Icon
              className={cn(
                "text-muted-foreground",
                hasFiles || activeUploads.length > 0 ? "h-5 w-5" : "h-8 w-8",
              )}
            />
            <span className="text-xs text-muted-foreground">
              {hasFiles || activeUploads.length > 0
                ? "Add more files"
                : `Drop ${category ?? ""} files or click to attach (multiple allowed)`.replace(/\s+/g, " ")}
            </span>
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
          {error && <div className="text-xs text-destructive">{error}</div>}
          <input
            id={`file-${item.id}`}
            type="file"
            multiple
            accept={accept}
            className="hidden"
            onChange={(e) => {
              handlePick(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
        </>
      )}
    </div>
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
      <VideoPlayer
        src={streamSrc}
        downloadHref={attachmentId ? `/api/files/${attachmentId}/download` : url}
        className="mb-2"
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
