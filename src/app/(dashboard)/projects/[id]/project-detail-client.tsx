"use client";

import { useState, useEffect, useRef, useMemo, useCallback, memo, type DragEvent } from "react";
import { updateTaskStatus, getStageGateBlockers } from "@/actions/projects";
import { createInvoiceFromProject } from "@/actions/invoices";
import { addTaskComment } from "@/actions/comments";
import { ArrowLeft, Plus, FileText, AlertTriangle, Settings, GripVertical, ChevronRight, Undo2, Paperclip, X, Loader2, LayoutGrid, FolderOpen, Upload, Trash2, Download, MoreHorizontal, FolderPlus, Pencil, FolderInput } from "lucide-react";
import { getProjectAssets, createFolder, deleteFolder, renameFolder, deleteAsset, renameAsset, getFolderBreadcrumbs, moveAsset, moveFolder } from "@/actions/assets";
import { uploadManager } from "@/lib/upload-manager";
import { HeaderActions } from "@/components/header-actions";
import Link from "next/link";
import { useErrorStore } from "@/lib/error-store";
import { usePermissions } from "@/components/permissions-provider";
import { useRouter } from "next/navigation";
import type { TaskPermissions } from "@/lib/permissions";

type TaskStatus = { id: string; name: string; color: string; order: number };
type ProjectStatus = { id: string; name: string; color: string; order: number };

type ChecklistItem = {
  id: string;
  name: string;
  type: string;
  role: string;
  completed: boolean;
  attachmentId: string | null;
  order: number;
  templateItem: { template: { id: string; name: string; icon: string | null; color: string | null } } | null;
};

type Task = {
  id: string;
  taskNumber: number;
  title: string;
  description: string | null;
  billable: boolean;
  price: unknown;
  priority: number | null;
  completedAt: Date | null;
  status: TaskStatus | null;
  service: { name: string } | null;
  assignee: { name: string | null; email: string } | null;
  checklistItems: ChecklistItem[];
};

type Invoice = {
  id: string;
  number: string;
  total: unknown;
  currency: string;
  status: string;
  createdAt: Date;
};

type Project = {
  id: string;
  name: string;
  type: string;
  thumbnailId: string | null;
  description: string | null;
  startDate: Date | null;
  deadline: Date | null;
  createdAt: Date;
  status: ProjectStatus | null;
  company: { id: string; name: string } | null;
  deal: { id: string; title: string } | null;
  tasks: Task[];
  invoices: Invoice[];
};

export function ProjectDetailClient({
  project,
  taskStatuses,
}: {
  project: Project;
  taskStatuses: TaskStatus[];
}) {
  const permissions = usePermissions();
  const canEditProject = permissions.projects === "full";
  const hasTaskPermissions = !!permissions.taskPermissions?.stages && Object.keys(permissions.taskPermissions.stages).length > 0;
  const canInteractWithTasks = canEditProject || hasTaskPermissions;
  const [activeTab, setActiveTab] = useState<"board" | "assets">("board");

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 h-12 border-b border-border/50 shrink-0">
        <Link
          href="/projects"
          className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card transition-colors shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
        </Link>
        <ProjectThumbnail thumbnailId={project.thumbnailId} name={project.name} />
        {project.deal && (
          <span className="text-[13px] text-muted-foreground truncate">
            Deal: <Link href={`/deals/${project.deal.id}`} className="text-primary hover:underline">{project.deal.title}</Link>
          </span>
        )}
        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground capitalize shrink-0">{project.type}</span>
        <div className="flex-1" />
        {canEditProject && (
          <Link
            href={`/projects/${project.id}/settings`}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card transition-colors shrink-0"
          >
            <Settings className="w-3.5 h-3.5" />
          </Link>
        )}
        <HeaderActions />
      </div>

      {/* Tabs */}
      <div className="px-6 pt-3">
        <div className="inline-flex items-center rounded-xl bg-muted/30 border border-border p-1">
          {([
            { id: "board" as const, label: "Board", icon: <LayoutGrid className="w-3.5 h-3.5" /> },
            { id: "assets" as const, label: "Assets", icon: <Paperclip className="w-3.5 h-3.5" /> },
          ]).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === "board" && (
        <>
          <div className="px-6 pt-4">
            <KanbanBoard
              project={project}
              taskStatuses={taskStatuses}
              canEdit={canInteractWithTasks}
              canEditProject={canEditProject}
              taskPermissions={permissions.taskPermissions}
            />
          </div>
          {project.invoices.length > 0 && permissions.invoices !== "none" && (
            <div className="px-6">
              <InvoicesSection project={project} />
            </div>
          )}
        </>
      )}

      {activeTab === "assets" && (
        <div className="px-6 pt-4 flex-1">
          <AssetsPanel projectId={project.id} canEdit={canEditProject} />
        </div>
      )}
    </div>
  );
}

function ProjectThumbnail({ thumbnailId, name }: { thumbnailId: string | null; name: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!thumbnailId) return;
    let cancelled = false;
    fetch(`/api/files/${thumbnailId}/download-url`)
      .then((r) => r.json())
      .then((data) => { if (!cancelled && data.url) setUrl(data.url); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [thumbnailId]);

  if (url) {
    return <img src={url} alt={name} loading="lazy" className="w-8 h-8 rounded-lg object-cover" />;
  }

  const initials = name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  return (
    <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
      <span className="text-[11px] font-bold text-primary">{initials}</span>
    </div>
  );
}

/* ─── Kanban Board ──────────────────────────────────────────────────────────── */

function KanbanBoard({
  project,
  taskStatuses,
  canEdit,
  canEditProject,
  taskPermissions,
}: {
  project: Project;
  taskStatuses: TaskStatus[];
  canEdit: boolean;
  canEditProject: boolean;
  taskPermissions?: TaskPermissions;
}) {
  const router = useRouter();
  const { push: pushError } = useErrorStore();
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [gateError, setGateError] = useState<{ taskId: string; message: string } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    taskId: string;
    statusId: string;
    title: string;
    message: string;
    button: string;
  } | null>(null);

  const [declineModal, setDeclineModal] = useState<{
    taskId: string;
    statusId: string;
    fromName: string;
    toName: string;
  } | null>(null);

  const [optimisticMoves, setOptimisticMoves] = useState<Record<string, string>>({});

  const sorted = useMemo(
    () => [...taskStatuses].filter((s) => s.name.toLowerCase() !== "published").sort((a, b) => a.order - b.order),
    [taskStatuses]
  );

  const tasksWithOptimistic = useMemo(
    () => project.tasks.map((t) => {
      const overrideStatusId = optimisticMoves[t.id];
      if (!overrideStatusId || overrideStatusId === t.status?.id) return t;
      const newStatus = taskStatuses.find((s) => s.id === overrideStatusId);
      return newStatus ? { ...t, status: newStatus } : t;
    }),
    [project.tasks, optimisticMoves, taskStatuses]
  );

  const tasksByStatus = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const s of sorted) map.set(s.id, []);
    map.set("__none__", []);
    for (const t of tasksWithOptimistic) {
      const key = t.status?.id ?? "__none__";
      const arr = map.get(key);
      if (arr) arr.push(t);
      else map.set(key, [t]);
    }
    for (const [key, arr] of map) {
      map.set(key, arr.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0)));
    }
    return map;
  }, [sorted, tasksWithOptimistic]);

  const moveTask = useCallback((taskId: string, statusId: string) => {
    setOptimisticMoves((prev) => ({ ...prev, [taskId]: statusId }));

    updateTaskStatus(taskId, statusId, project.id)
      .then(() => router.refresh())
      .catch(() => {
        setOptimisticMoves((prev) => {
          const next = { ...prev };
          delete next[taskId];
          return next;
        });
      });
  }, [project.id, router]);

  const handleDragStart = useCallback((e: DragEvent, taskId: string) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", taskId);
    const el = e.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    e.dataTransfer.setDragImage(el, e.clientX - rect.left, e.clientY - rect.top);
    setDraggingTaskId(taskId);
  }, []);

  const handleDragOver = useCallback((e: DragEvent, statusId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverColumn(statusId);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    const target = e.currentTarget as HTMLElement;
    const related = e.relatedTarget as HTMLElement | null;
    if (!related || !target.contains(related)) {
      setDragOverColumn(null);
    }
  }, []);

  const handleDrop = useCallback(async (e: DragEvent, statusId: string) => {
    e.preventDefault();
    setDragOverColumn(null);
    setDraggingTaskId(null);

    const taskId = e.dataTransfer.getData("text/plain");
    if (!taskId || !canEdit) return;

    const task = tasksWithOptimistic.find((t) => t.id === taskId);
    if (!task || task.status?.id === statusId) return;

    setGateError(null);

    const fromStatusId = task.status?.id ?? "";
    const fromOrder = task.status ? sorted.find((s) => s.id === task.status!.id)?.order ?? 0 : 0;
    const toOrder = sorted.find((s) => s.id === statusId)?.order ?? 0;
    const isForward = toOrder > fromOrder;

    if (!canEditProject && taskPermissions && fromStatusId) {
      const sp = taskPermissions.stages?.[fromStatusId];
      if (isForward && !sp?.forward) {
        setGateError({ taskId, message: "Your role does not have permission to move tasks forward from this stage." });
        return;
      }
      if (!isForward && !sp?.rollback) {
        setGateError({ taskId, message: "Your role does not have permission to move tasks back from this stage." });
        return;
      }
    }

    const fromName = task.status?.name?.toLowerCase() ?? "";
    const toName = sorted.find((s) => s.id === statusId)?.name?.toLowerCase() ?? "";

    if (fromName === "internal review" && toName === "in progress") {
      setDeclineModal({ taskId, statusId, fromName: "Internal Review", toName: "In Progress" });
      return;
    }

    if (fromName === "review" && toName === "internal review") {
      setDeclineModal({ taskId, statusId, fromName: "Review", toName: "Internal Review" });
      return;
    }

    if (fromName === "in progress" && toName === "internal review") {
      const blockers = await getStageGateBlockers(taskId, statusId);
      if (blockers.length > 0) {
        setGateError({ taskId, message: `Complete these items first: ${blockers.map((b) => `"${b.itemName}"`).join(", ")}` });
        return;
      }
      setConfirmModal({
        taskId, statusId,
        title: "Move to Internal Review",
        message: "By moving this task to internal review, you confirm that all deliverables are complete and ready to be reviewed by the team.",
        button: "Confirm",
      });
      return;
    }

    if (fromName === "internal review" && toName === "review") {
      const blockers = await getStageGateBlockers(taskId, statusId);
      if (blockers.length > 0) {
        setGateError({ taskId, message: `Complete these items first: ${blockers.map((b) => `"${b.itemName}"`).join(", ")}` });
        return;
      }
      setConfirmModal({
        taskId, statusId,
        title: "Move to Review",
        message: "By moving this task to review, you confirm that you have reviewed the delivery and it meets our standards and requirements.",
        button: "Confirm",
      });
      return;
    }

    const blockers = await getStageGateBlockers(taskId, statusId);
    if (blockers.length > 0) {
      setGateError({ taskId, message: `Complete these items first: ${blockers.map((b) => `"${b.itemName}"`).join(", ")}` });
      return;
    }

    moveTask(taskId, statusId);
  }, [canEdit, canEditProject, taskPermissions, tasksWithOptimistic, sorted, moveTask]);

  const handleDragEnd = useCallback(() => {
    setDraggingTaskId(null);
    setDragOverColumn(null);
  }, []);

  const handleConfirmMove = useCallback(() => {
    if (!confirmModal) return;
    moveTask(confirmModal.taskId, confirmModal.statusId);
    setConfirmModal(null);
  }, [confirmModal, moveTask]);

  const handleDeclineSubmit = async (comment: string, file?: File) => {
    if (!declineModal) return;
    const { taskId, statusId } = declineModal;

    let commentBody = `⚠️ Task declined: ${comment}`;

    if (file) {
      const formData = new FormData();
      formData.append("name", file.name);
      formData.append("contentType", file.type);
      formData.append("sizeBytes", String(file.size));
      formData.append("entityType", "task");
      formData.append("entityId", taskId);

      const createRes = await fetch("/api/files", { method: "POST", body: formData });
      if (createRes.ok) {
        const { id: fileId } = await createRes.json();
        const uploadRes = await fetch(`/api/files/${fileId}/upload`, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (uploadRes.ok) {
          await fetch(`/api/files/${fileId}/complete`, { method: "POST" });
          commentBody += `\n📎 Attached: ${file.name}`;
        }
      }
    }

    await addTaskComment(taskId, commentBody, project.id);
    moveTask(taskId, statusId);
    setDeclineModal(null);
  };

  return (
    <div className="space-y-3">
      {declineModal && (
        <DeclineTaskModal
          fromName={declineModal.fromName}
          toName={declineModal.toName}
          onCancel={() => setDeclineModal(null)}
          onSubmit={handleDeclineSubmit}
        />
      )}

      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full mx-4 space-y-4 shadow-2xl">
            <h3 className="text-lg font-semibold text-foreground">{confirmModal.title}</h3>
            <p className="text-[14px] text-muted-foreground leading-relaxed">{confirmModal.message}</p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmModal(null)}
                className="text-[13px] text-muted-foreground hover:text-foreground px-4 py-2 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmMove}
                className="text-[13px] font-medium text-white bg-amber-600 hover:bg-amber-500 px-5 py-2.5 rounded-xl transition-colors"
              >
                {confirmModal.button}
              </button>
            </div>
          </div>
        </div>
      )}

      {gateError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full mx-4 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
              <h3 className="text-lg font-semibold text-foreground">Cannot Move Task</h3>
            </div>
            <p className="text-[14px] text-muted-foreground leading-relaxed">{gateError.message}</p>
            <div className="flex items-center justify-end pt-2">
              <button
                onClick={() => setGateError(null)}
                className="text-[13px] font-medium text-white bg-destructive hover:bg-destructive/80 px-5 py-2.5 rounded-xl transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-3 pb-2" style={{ gridTemplateColumns: `repeat(${sorted.length + ((tasksByStatus.get("__none__")?.length ?? 0) > 0 ? 1 : 0)}, 1fr)` }}>
        {sorted.map((status, idx) => (
            <KanbanColumn
              key={status.id}
              status={status}
              tasks={tasksByStatus.get(status.id) ?? []}
              projectId={project.id}
              canEdit={canEdit}
              onAddTask={idx === 0 && (canEditProject || !taskPermissions || taskPermissions.stages?.[status.id]?.create) ? () => {
                router.push(`/projects/${project.id}/tasks/new?statusId=${status.id}`);
              } : undefined}
              draggingTaskId={draggingTaskId}
              isDragOver={dragOverColumn === status.id}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
              gateError={gateError}
            />
        ))}

        {(tasksByStatus.get("__none__")?.length ?? 0) > 0 && (
          <KanbanColumn
            status={{ id: "__none__", name: "No Status", color: "#6b7280", order: 999 }}
            tasks={tasksByStatus.get("__none__") ?? []}
            projectId={project.id}
            canEdit={canEdit}
            draggingTaskId={draggingTaskId}
            isDragOver={dragOverColumn === "__none__"}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
            gateError={gateError}
          />
        )}
      </div>
    </div>
  );
}

function DeclineTaskModal({
  fromName,
  toName,
  onCancel,
  onSubmit,
}: {
  fromName: string;
  toName: string;
  onCancel: () => void;
  onSubmit: (comment: string, file?: File) => Promise<void>;
}) {
  const [comment, setComment] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async () => {
    if (!comment.trim() || submitting) return;
    setSubmitting(true);
    await onSubmit(comment.trim(), file || undefined);
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full mx-4 space-y-4 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Decline Task</h3>
            <p className="text-[12px] text-muted-foreground">Return this task from {fromName} back to {toName}</p>
          </div>
        </div>

        <div>
          <label className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
            Reason for declining <span className="text-red-400">*</span>
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Explain what needs to be fixed or changed..."
            rows={4}
            className="w-full text-[13px] text-foreground bg-transparent border border-border rounded-xl px-4 py-3 focus:outline-none focus:border-ring transition-colors placeholder:text-muted-foreground/40 resize-none"
            autoFocus
          />
          <p className="text-[11px] text-muted-foreground/50 mt-1">A comment is required when declining a task</p>
        </div>

        <div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setFile(f);
              e.target.value = "";
            }}
          />
          {file ? (
            <div className="flex items-center gap-2 text-[12px] text-foreground bg-muted/30 rounded-lg px-3 py-2">
              <Paperclip className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="flex-1 truncate">{file.name}</span>
              <button onClick={() => setFile(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <Paperclip className="w-3.5 h-3.5" />
              Attach files
            </button>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={onCancel}
            disabled={submitting}
            className="text-[13px] text-muted-foreground hover:text-foreground px-4 py-2 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!comment.trim() || submitting}
            className="text-[13px] font-medium text-red-400 bg-red-500/15 hover:bg-red-500/25 disabled:opacity-40 disabled:cursor-not-allowed px-5 py-2.5 rounded-xl transition-colors flex items-center gap-2"
          >
            {submitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Undo2 className="w-3.5 h-3.5" />
            )}
            Decline & Return
          </button>
        </div>
      </div>
    </div>
  );
}

const KanbanColumn = memo(function KanbanColumn({
  status,
  tasks,
  projectId,
  canEdit,
  onAddTask,
  draggingTaskId,
  isDragOver,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  gateError,
}: {
  status: TaskStatus;
  tasks: Task[];
  projectId: string;
  canEdit: boolean;
  onAddTask?: () => void;
  draggingTaskId: string | null;
  isDragOver: boolean;
  onDragStart: (e: DragEvent, taskId: string) => void;
  onDragOver: (e: DragEvent, statusId: string) => void;
  onDragLeave: (e: DragEvent) => void;
  onDrop: (e: DragEvent, statusId: string) => void;
  onDragEnd: () => void;
  gateError: { taskId: string; message: string } | null;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: status.color }} />
          <h3 className="text-[12px] font-semibold text-foreground uppercase tracking-wider">{status.name}</h3>
          <span className="text-[11px] text-muted-foreground">{tasks.length}</span>
        </div>
        {canEdit && onAddTask && (
          <button
            onClick={onAddTask}
            className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div
        className={`space-y-2 min-h-[100px] rounded-lg p-2 transition-colors ${
          isDragOver ? "bg-primary/10 ring-1 ring-primary/30" : "bg-muted/30"
        }`}
        onDragOver={(e) => onDragOver(e, status.id)}
        onDragLeave={onDragLeave}
        onDrop={(e) => onDrop(e, status.id)}
      >
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            projectId={projectId}
            canEdit={canEdit}
            isDragging={draggingTaskId === task.id}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            hasGateError={gateError?.taskId === task.id}
          />
        ))}

        {tasks.length === 0 && (
          <div className="py-6 text-center">
            <p className="text-[11px] text-muted-foreground/50">No tasks</p>
          </div>
        )}
      </div>
    </div>
  );
});

const TaskCard = memo(function TaskCard({
  task,
  projectId,
  canEdit,
  isDragging,
  onDragStart,
  onDragEnd,
  hasGateError,
}: {
  task: Task;
  projectId: string;
  canEdit: boolean;
  isDragging: boolean;
  onDragStart: (e: DragEvent, taskId: string) => void;
  onDragEnd: () => void;
  hasGateError: boolean;
}) {
  const router = useRouter();

  const tplData = (() => {
    const tpl = task.checklistItems.find((i) => i.templateItem)?.templateItem?.template;
    return tpl || null;
  })();

  const p = task.priority;
  const priorityColor = p
    ? p <= 3 ? "bg-green-500/20 text-green-400 ring-green-500/30"
    : p <= 6 ? "bg-amber-500/20 text-amber-400 ring-amber-500/30"
    : "bg-red-500/20 text-red-400 ring-red-500/30"
    : "";

  return (
    <div
      draggable={canEdit}
      onDragStart={(e) => onDragStart(e, task.id)}
      onDragEnd={onDragEnd}
      onClick={() => router.push(`/projects/${projectId}/tasks/${task.id}`)}
      className={`rounded-xl border bg-card p-4 group transition-all cursor-pointer min-h-[120px] flex flex-col ${
        isDragging ? "opacity-40 scale-95" : "hover:border-primary/30"
      } ${hasGateError ? "border-destructive/40" : "border-border"}`}
    >
      {tplData && (
        <div className="mb-3">
          <span
            className="inline-flex items-center gap-1 text-[10px] font-medium rounded-md px-1.5 py-0.5 border"
            style={{
              color: tplData.color || "#22d3ee",
              backgroundColor: `${tplData.color || "#22d3ee"}15`,
              borderColor: `${tplData.color || "#22d3ee"}30`,
            }}
          >
            {tplData.icon && <span className="text-[11px]">{tplData.icon}</span>}
            {tplData.name}
          </span>
        </div>
      )}

      <p className="text-[13px] font-medium leading-snug mb-3 text-foreground">
        {task.taskNumber > 0 && <span className="text-muted-foreground/50 mr-1.5">#{task.taskNumber}</span>}
        {task.title}
      </p>

      <div className="flex-1" />
      <div className="flex items-center gap-1.5">
        {p && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ring-1 ${priorityColor}`}>
            P{p}
          </span>
        )}
        <div className="flex-1" />
        {task.assignee && (
          <AssigneeAvatar name={task.assignee.name} />
        )}
      </div>
    </div>
  );
});

function AssigneeAvatar({ name }: { name: string | null }) {
  const initials = name
    ? name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  return (
    <div
      className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center ring-2 ring-card"
      title={name || "Unassigned"}
    >
      <span className="text-[10px] font-bold text-primary">{initials}</span>
    </div>
  );
}

/* ─── Invoices ──────────────────────────────────────────────────────────────── */

function InvoicesSection({ project }: { project: Project }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-[13px] font-medium text-foreground mb-3">
        Invoices <span className="text-muted-foreground font-normal">({project.invoices.length})</span>
      </h3>
      <div className="space-y-2">
        {project.invoices.map((invoice) => (
          <Link
            key={invoice.id}
            href={`/invoices/${invoice.id}`}
            className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50 no-underline hover:bg-muted transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-orange/15 flex items-center justify-center">
                <FileText className="w-3.5 h-3.5 text-orange" />
              </div>
              <div>
                <p className="text-[12px] font-medium text-foreground">{invoice.number}</p>
                <p className="text-[11px] text-muted-foreground">{new Date(invoice.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[12px] font-semibold text-foreground">
                {Number(invoice.total).toLocaleString()} {invoice.currency || "KWD"}
              </p>
              <InvoiceStatusBadge status={invoice.status} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function InvoiceStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    DRAFT: { label: "Draft", className: "bg-muted text-muted-foreground" },
    SENT: { label: "Sent", className: "bg-orange/15 text-orange" },
    ACCEPTED: { label: "Accepted", className: "bg-success/15 text-success" },
    REJECTED: { label: "Rejected", className: "bg-destructive/15 text-destructive" },
    PAID: { label: "Paid", className: "bg-primary/15 text-primary" },
    CANCELLED: { label: "Cancelled", className: "bg-muted text-muted-foreground" },
  };
  const { label, className } = config[status] ?? config.DRAFT;
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${className}`}>
      {label}
    </span>
  );
}

// ─── Assets Panel ───────────────────────────────────────────────────────────────

type Folder = { id: string; name: string; createdAt: Date; _count: { assets: number; children: number } };
type Asset = { id: string; name: string; fileSize: number; contentType: string; r2Key: string; createdAt: Date };

function AssetsPanel({ projectId, canEdit }: { projectId: string; canEdit: boolean }) {
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [contextMenu, setContextMenu] = useState<{ type: "folder" | "asset"; id: string; name: string } | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [moveTarget, setMoveTarget] = useState<{ type: "folder" | "asset"; id: string; name: string } | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [panelDragOver, setPanelDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    setLoading(true);
    const data = await getProjectAssets(projectId, currentFolderId);
    setFolders(data.folders as Folder[]);
    setAssets(data.assets as Asset[]);
    if (currentFolderId) {
      const crumbs = await getFolderBreadcrumbs(currentFolderId);
      setBreadcrumbs(crumbs);
    } else {
      setBreadcrumbs([]);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [currentFolderId]);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    await createFolder(projectId, newFolderName.trim(), currentFolderId);
    setNewFolderName("");
    setShowNewFolder(false);
    loadData();
  };

  const handleUpload = (files: FileList, targetFolderId?: string | null) => {
    const fid = targetFolderId !== undefined ? targetFolderId : currentFolderId;
    uploadManager.enqueue(Array.from(files), projectId, fid);
  };

  const handleDropEntries = async (items: DataTransferItemList, rootFolderId: string | null) => {
    const entries: FileSystemEntry[] = [];
    for (let i = 0; i < items.length; i++) {
      const entry = items[i].webkitGetAsEntry?.();
      if (entry) entries.push(entry);
    }
    await processEntries(entries, rootFolderId);
    loadData();
  };

  const processEntries = async (entries: FileSystemEntry[], parentFolderId: string | null) => {
    for (const entry of entries) {
      if (entry.isFile) {
        const file = await new Promise<File>((resolve) => (entry as FileSystemFileEntry).file(resolve));
        uploadManager.enqueue([file], projectId, parentFolderId);
      } else if (entry.isDirectory) {
        await createFolder(projectId, entry.name, parentFolderId);
        const dirData = await getProjectAssets(projectId, parentFolderId);
        const newFolder = dirData.folders.find((f) => f.name === entry.name);
        if (newFolder) {
          const reader = (entry as FileSystemDirectoryEntry).createReader();
          const children = await new Promise<FileSystemEntry[]>((resolve) => reader.readEntries(resolve));
          await processEntries(children, newFolder.id);
        }
      }
    }
  };

  useEffect(() => {
    return uploadManager.subscribe(() => {
      if (!uploadManager.hasActive()) loadData();
    });
  }, [currentFolderId]);

  const handleDeleteFolder = async (id: string) => {
    if (!confirm("Delete this folder and all its contents?")) return;
    await deleteFolder(id);
    loadData();
  };

  const handleDeleteAsset = async (id: string) => {
    if (!confirm("Delete this file?")) return;
    await deleteAsset(id);
    loadData();
  };

  const handleRename = async () => {
    if (!renaming || !renaming.name.trim()) return;
    if (contextMenu?.type === "folder") {
      await renameFolder(renaming.id, renaming.name);
    } else {
      await renameAsset(renaming.id, renaming.name);
    }
    setRenaming(null);
    setContextMenu(null);
    loadData();
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (contentType: string) => {
    if (contentType.startsWith("image/")) return "🖼️";
    if (contentType.startsWith("video/")) return "🎬";
    if (contentType.startsWith("audio/")) return "🎵";
    if (contentType.includes("pdf")) return "📄";
    return "📎";
  };

  return (
    <div
      className={`space-y-4 min-h-[calc(100vh-120px)] relative ${panelDragOver ? "after:absolute after:inset-0 after:rounded-xl after:border-2 after:border-dashed after:border-primary after:bg-primary/5 after:pointer-events-none after:z-10" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        if (!e.dataTransfer.types.includes("text/plain")) setPanelDragOver(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) setPanelDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setPanelDragOver(false);
        const type = e.dataTransfer.getData("type");
        if (type) return;
        if (e.dataTransfer.items?.length) handleDropEntries(e.dataTransfer.items, currentFolderId);
        else if (e.dataTransfer.files.length > 0) handleUpload(e.dataTransfer.files, currentFolderId);
      }}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        {/* Breadcrumbs */}
        <div className="flex items-center gap-1 text-[12px] flex-1 min-w-0">
          <button
            onClick={() => setCurrentFolderId(null)}
            onDragOver={(e) => { if (currentFolderId) { e.preventDefault(); e.stopPropagation(); } }}
            onDrop={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              const type = e.dataTransfer.getData("type");
              const id = e.dataTransfer.getData("id");
              if (type === "asset" && id) { await moveAsset(id, null); loadData(); }
              else if (type === "folder" && id) { await moveFolder(id, null); loadData(); }
            }}
            className={`hover:text-foreground transition-colors shrink-0 ${!currentFolderId ? "text-foreground font-medium" : "text-muted-foreground"}`}
          >
            All Files
          </button>
          {breadcrumbs.map((crumb) => (
            <span key={crumb.id} className="flex items-center gap-1">
              <ChevronRight className="w-3 h-3 text-muted-foreground/40" />
              <button
                onClick={() => setCurrentFolderId(crumb.id)}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const type = e.dataTransfer.getData("type");
                  const id = e.dataTransfer.getData("id");
                  if (type === "asset" && id) { await moveAsset(id, crumb.id); loadData(); }
                  else if (type === "folder" && id && id !== crumb.id) { await moveFolder(id, crumb.id); loadData(); }
                }}
                className={`hover:text-foreground transition-colors truncate max-w-[120px] ${
                  crumb.id === currentFolderId ? "text-foreground font-medium" : "text-muted-foreground"
                }`}
              >
                {crumb.name}
              </button>
            </span>
          ))}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => { if (e.target.files?.length) handleUpload(e.target.files, currentFolderId); e.target.value = ""; }}
        />
        {canEdit && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowNewFolder(true)}
              className="h-8 px-3 rounded-lg border border-border bg-card text-[12px] text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              New Folder
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-[12px] font-medium flex items-center gap-1.5 hover:bg-primary/90 transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              Upload
            </button>
          </div>
        )}
      </div>

      {/* New folder inline form */}
      {showNewFolder && (
        <div className="flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-amber-400" />
          <input
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreateFolder(); if (e.key === "Escape") setShowNewFolder(false); }}
            placeholder="Folder name..."
            autoFocus
            className="h-8 flex-1 px-3 rounded-lg bg-black border border-border text-[13px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-ring transition-colors"
          />
          <button onClick={handleCreateFolder} className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-[12px] font-medium">Create</button>
          <button onClick={() => setShowNewFolder(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : folders.length === 0 && assets.length === 0 ? (
        <div
          onClick={() => canEdit && fileInputRef.current?.click()}
          className="flex flex-col items-center justify-center py-20 rounded-xl border-2 border-dashed border-border hover:border-muted-foreground/30 cursor-pointer transition-colors"
        >
          <FolderOpen className="w-10 h-10 text-muted-foreground/30 mb-3" />
          <p className="text-[13px] text-muted-foreground/60">No files yet</p>
          <p className="text-[11px] text-muted-foreground/40 mt-1">Drop files or click to upload</p>
        </div>
      ) : (
        <div className="space-y-1">
          {/* Folders */}
          {folders.map((folder) => (
            <div
              key={folder.id}
              draggable={canEdit}
              onDragStart={(e) => { e.dataTransfer.setData("type", "folder"); e.dataTransfer.setData("id", folder.id); }}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverFolderId(folder.id); }}
              onDragLeave={() => setDragOverFolderId(null)}
              onDrop={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                setDragOverFolderId(null);
                const type = e.dataTransfer.getData("type");
                const id = e.dataTransfer.getData("id");
                if (type === "asset" && id) { await moveAsset(id, folder.id); loadData(); }
                else if (type === "folder" && id && id !== folder.id) { await moveFolder(id, folder.id); loadData(); }
                else if (e.dataTransfer.items?.length) {
                  handleDropEntries(e.dataTransfer.items, folder.id);
                }
              }}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer group transition-colors ${
                dragOverFolderId === folder.id ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-muted/30"
              }`}
              onClick={() => setCurrentFolderId(folder.id)}
            >
              <FolderOpen className="w-5 h-5 text-amber-400 shrink-0" />
              {renaming?.id === folder.id ? (
                <input
                  value={renaming.name}
                  onChange={(e) => setRenaming({ ...renaming, name: e.target.value })}
                  onBlur={handleRename}
                  onKeyDown={(e) => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") setRenaming(null); }}
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                  className="flex-1 h-7 px-2 rounded bg-black border border-border text-[13px] text-foreground focus:outline-none focus:border-ring"
                />
              ) : (
                <span className="flex-1 text-[13px] text-foreground truncate">{folder.name}</span>
              )}
              <span className="text-[11px] text-muted-foreground/50">
                {folder._count.assets + folder._count.children} items
              </span>
              <div className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={(e) => e.stopPropagation()}>
                <ItemMenu
                  onRename={() => { setRenaming({ id: folder.id, name: folder.name }); setContextMenu({ type: "folder", id: folder.id, name: folder.name }); }}
                  onDelete={() => handleDeleteFolder(folder.id)}
                  onDownload={() => {
                    const a = document.createElement("a");
                    a.href = `/api/assets/${folder.id}/download-folder`;
                    a.download = `${folder.name}.zip`;
                    a.click();
                  }}
                  onMove={() => setMoveTarget({ type: "folder", id: folder.id, name: folder.name })}
                  canEdit={canEdit}
                />
              </div>
            </div>
          ))}

          {/* Assets */}
          {assets.map((asset) => (
            <div
              key={asset.id}
              draggable={canEdit}
              onDragStart={(e) => { e.dataTransfer.setData("type", "asset"); e.dataTransfer.setData("id", asset.id); }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/30 group transition-colors cursor-grab"
            >
              <span className="text-[16px] shrink-0">{getFileIcon(asset.contentType)}</span>
              {renaming?.id === asset.id ? (
                <input
                  value={renaming.name}
                  onChange={(e) => setRenaming({ ...renaming, name: e.target.value })}
                  onBlur={handleRename}
                  onKeyDown={(e) => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") setRenaming(null); }}
                  autoFocus
                  className="flex-1 h-7 px-2 rounded bg-black border border-border text-[13px] text-foreground focus:outline-none focus:border-ring"
                />
              ) : (
                <span className="flex-1 text-[13px] text-foreground truncate">{asset.name}</span>
              )}
              <span className="text-[11px] text-muted-foreground/50 shrink-0">{formatSize(asset.fileSize)}</span>
              <div className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <ItemMenu
                  onRename={() => { setRenaming({ id: asset.id, name: asset.name }); setContextMenu({ type: "asset", id: asset.id, name: asset.name }); }}
                  onDelete={() => handleDeleteAsset(asset.id)}
                  onDownload={async () => {
                    const parts = asset.r2Key.split("/");
                    const fileId = parts[parts.length - 1]?.replace(/\.[^.]+$/, "") || asset.r2Key;
                    const res = await fetch(`/api/files/${fileId}/download-url`);
                    const data = await res.json();
                    if (data.url) { const a = document.createElement("a"); a.href = data.url; a.download = asset.name; a.target = "_blank"; a.click(); }
                  }}
                  onMove={() => setMoveTarget({ type: "asset", id: asset.id, name: asset.name })}
                  canEdit={canEdit}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {moveTarget && (
        <MoveModal
          projectId={projectId}
          itemType={moveTarget.type}
          itemId={moveTarget.id}
          itemName={moveTarget.name}
          excludeFolderId={moveTarget.type === "folder" ? moveTarget.id : undefined}
          onClose={() => setMoveTarget(null)}
          onMoved={loadData}
        />
      )}
    </div>
  );
}

function ItemMenu({
  onRename,
  onDelete,
  onDownload,
  onMove,
  canEdit,
}: {
  onRename: () => void;
  onDelete: () => void;
  onDownload: () => void;
  onMove?: () => void;
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-30 w-40 rounded-xl bg-black border border-border shadow-xl py-1 overflow-hidden">
          <button
            onClick={() => { setOpen(false); onDownload(); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-foreground hover:bg-muted/40 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Download
          </button>
          {canEdit && (
            <>
              <button
                onClick={() => { setOpen(false); onMove?.(); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-foreground hover:bg-muted/40 transition-colors"
              >
                <FolderInput className="w-3.5 h-3.5" />
                Move to...
              </button>
              <button
                onClick={() => { setOpen(false); onRename(); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-foreground hover:bg-muted/40 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
                Rename
              </button>
              <div className="border-t border-border my-1" />
              <button
                onClick={() => { setOpen(false); onDelete(); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MoveModal({
  projectId,
  itemType,
  itemId,
  itemName,
  excludeFolderId,
  onClose,
  onMoved,
}: {
  projectId: string;
  itemType: "folder" | "asset";
  itemId: string;
  itemName: string;
  excludeFolderId?: string;
  onClose: () => void;
  onMoved: () => void;
}) {
  const [browseFolderId, setBrowseFolderId] = useState<string | null>(null);
  const [browseFolders, setBrowseFolders] = useState<{ id: string; name: string }[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [moving, setMoving] = useState(false);

  const load = async (folderId: string | null) => {
    setLoading(true);
    const data = await getProjectAssets(projectId, folderId);
    const filtered = data.folders.filter((f) => f.id !== excludeFolderId && f.id !== itemId);
    setBrowseFolders(filtered.map((f) => ({ id: f.id, name: f.name })));
    if (folderId) {
      const crumbs = await getFolderBreadcrumbs(folderId);
      setBreadcrumbs(crumbs);
    } else {
      setBreadcrumbs([]);
    }
    setLoading(false);
  };

  useEffect(() => { load(browseFolderId); }, [browseFolderId]);

  const handleMove = async () => {
    setMoving(true);
    if (itemType === "folder") {
      await moveFolder(itemId, browseFolderId);
    } else {
      await moveAsset(itemId, browseFolderId);
    }
    setMoving(false);
    onMoved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="w-[400px] max-h-[500px] rounded-2xl bg-black border border-border shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-[14px] font-semibold text-foreground">Move &quot;{itemName}&quot;</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">Select destination folder</p>
        </div>

        <div className="px-4 py-2 border-b border-border flex items-center gap-1 text-[12px] min-h-[36px]">
          <button
            onClick={() => setBrowseFolderId(null)}
            className={`px-1.5 py-0.5 rounded transition-colors ${!browseFolderId ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground"}`}
          >
            Root
          </button>
          {breadcrumbs.map((crumb) => (
            <span key={crumb.id} className="flex items-center gap-1">
              <ChevronRight className="w-3 h-3 text-muted-foreground/50" />
              <button
                onClick={() => setBrowseFolderId(crumb.id)}
                className={`px-1.5 py-0.5 rounded transition-colors ${browseFolderId === crumb.id ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground"}`}
              >
                {crumb.name}
              </button>
            </span>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2 min-h-[120px] max-h-[300px]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : browseFolders.length === 0 ? (
            <p className="text-center py-8 text-[12px] text-muted-foreground">No subfolders</p>
          ) : (
            browseFolders.map((folder) => (
              <button
                key={folder.id}
                onClick={() => setBrowseFolderId(folder.id)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-foreground hover:bg-muted/30 transition-colors text-left"
              >
                <FolderOpen className="w-4 h-4 text-amber-400 shrink-0" />
                {folder.name}
              </button>
            ))
          )}
        </div>

        <div className="px-4 py-3 border-t border-border flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground truncate max-w-[180px]">
            Move to: <span className="text-foreground font-medium">{breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length - 1].name : "Root"}</span>
          </p>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors rounded-lg">
              Cancel
            </button>
            <button
              onClick={handleMove}
              disabled={moving}
              className="px-4 py-1.5 text-[12px] font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-1.5"
            >
              {moving && <Loader2 className="w-3 h-3 animate-spin" />}
              Move here
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
