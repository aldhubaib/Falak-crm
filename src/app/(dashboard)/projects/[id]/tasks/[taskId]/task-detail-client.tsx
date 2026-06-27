"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { updateTask, deleteTask, setChecklistItemAttachment, removeChecklistItemAttachment, saveChecklistItemText, syncTaskTemplates, createFullTask } from "@/actions/projects";
import { ArrowLeft, Trash2, Save, Loader2, Paperclip, CheckCircle2, AlertCircle, ChevronDown, Download } from "lucide-react";
import { TaskComments } from "@/components/task-comments";
import { HeaderActions } from "@/components/header-actions";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/components/permissions-provider";
import { useRouter } from "next/navigation";

async function uploadFileDirect(
  file: File,
  entityType: string,
  entityId: string
): Promise<string | null> {
  const contentType = file.type || "application/octet-stream";
  const createRes = await fetch("/api/files", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: file.name,
      sizeBytes: file.size,
      contentType,
      entityType,
      entityId,
    }),
  });
  const data = await createRes.json();
  if (!createRes.ok) return null;

  if (data.uploadUrl) {
    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", data.uploadUrl);
        xhr.setRequestHeader("Content-Type", contentType);
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const etag = xhr.getResponseHeader("ETag") || '"single"';
            fetch(`/api/files/${data.id}/parts/1`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ etag }),
            }).catch(() => {});
            resolve();
          } else {
            reject(new Error(`Upload failed: ${xhr.status}`));
          }
        };
        xhr.onerror = () => reject(new Error("Network error"));
        xhr.send(file);
      });
    } catch {
      await fetch(`/api/files/${data.id}/upload`, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": contentType },
      });
    }
  } else if (data.parts && data.parts.length > 0) {
    const partSize = data.partSize || 10 * 1024 * 1024;
    for (const part of data.parts as { number: number; url: string }[]) {
      const start = (part.number - 1) * partSize;
      const end = Math.min(part.number * partSize, file.size);
      const blob = file.slice(start, end);
      await new Promise<void>((resolve, reject) => {
        const pxhr = new XMLHttpRequest();
        pxhr.open("PUT", part.url);
        pxhr.setRequestHeader("Content-Type", contentType);
        pxhr.onload = () => {
          if (pxhr.status >= 200 && pxhr.status < 300) {
            const etag = pxhr.getResponseHeader("ETag") || `"part-${part.number}"`;
            fetch(`/api/files/${data.id}/parts/${part.number}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ etag }),
            }).catch(() => {});
            resolve();
          } else {
            reject(new Error(`Part ${part.number} failed: ${pxhr.status}`));
          }
        };
        pxhr.onerror = () => reject(new Error(`Part ${part.number}: network error`));
        pxhr.send(blob);
      });
    }
  }

  await fetch(`/api/files/${data.id}/complete`, { method: "POST" });
  return data.id;
}

type ChecklistItem = {
  id: string;
  name: string;
  type: string;
  role: string;
  options: string | null;
  allowedFileTypes: string | null;
  allowedFormats: string | null;
  aspectRatio: string | null;
  mandatory: boolean;
  phase: string;
  visibleFromStageId: string | null;
  requiredBeforeStageId: string | null;
  completed: boolean;
  attachmentId: string | null;
  textValue: string | null;
  completedAt: Date | null;
  order: number;
  templateItem: {
    template: { id: string; name: string; icon: string | null; color: string | null };
  } | null;
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
  status: { id: string; name: string; color: string } | null;
  service: { name: string } | null;
  assignee: { id: string; name: string | null; email: string } | null;
  project: { id: string; name: string; dealId: string | null };
  checklistItems: ChecklistItem[];
};

type TaskStatus = { id: string; name: string; color: string; order: number };
type TemplateItem = {
  id: string;
  name: string;
  type: string;
  role: string;
  options: string | null;
  allowedFileTypes: string | null;
  allowedFormats: string | null;
  aspectRatio: string | null;
  mandatory: boolean;
  phase: string;
  visibleFromStageId: string | null;
  requiredBeforeStageId: string | null;
  order: number;
};
type AvailableTemplate = { id: string; name: string; itemCount: number; items: TemplateItem[] };

export function TaskDetailClient({
  task,
  projectId: propProjectId,
  initialStatusId,
  taskStatuses,
  availableTemplates,
}: {
  task: Task | null;
  projectId: string;
  initialStatusId: string;
  taskStatuses: TaskStatus[];
  availableTemplates: AvailableTemplate[];
}) {
  const router = useRouter();
  const permissions = usePermissions();
  const isNew = !task;
  const projectId = task?.project.id ?? propProjectId;

  const tp = permissions.taskPermissions;
  const currentStatusId = isNew ? initialStatusId : (task?.status?.id ?? "");
  const stagePerms = tp?.stages?.[currentStatusId];

  const canEditModule = permissions.projects === "full";
  const canCreate = canEditModule || stagePerms?.create === true;
  const canModify = canEditModule || stagePerms?.modify === true;
  const canDelete = canEditModule || stagePerms?.delete === true;
  const canEdit = isNew ? canCreate : canModify;

  const [title, setTitle] = useState(task?.title ?? "");
  const [priority, setPriority] = useState<number | null>(task?.priority ?? null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [newTemplateId, setNewTemplateId] = useState<string | null>(null);
  const [newAnswers, setNewAnswers] = useState<Record<string, string>>({});

  const activeTemplateId = isNew
    ? newTemplateId
    : (() => {
        const ids = [...new Set(
          task.checklistItems
            .map((i) => i.templateItem?.template.id)
            .filter((id): id is string => !!id)
        )];
        return ids[0] ?? null;
      })();

  const [pendingFiles, setPendingFiles] = useState<Record<string, File>>({});

  const handleTemplateSelect = async (templateId: string) => {
    if (isNew) {
      setNewTemplateId(templateId === newTemplateId ? null : templateId);
      setNewAnswers({});
      setPendingFiles({});
      return;
    }
    if (syncing) return;
    setSyncing(true);
    const next = templateId === activeTemplateId ? [] : [templateId];
    await syncTaskTemplates(task.id, next, projectId);
    router.refresh();
    setSyncing(false);
  };

  const currentStageOrder = task?.status
    ? taskStatuses.find((s) => s.id === task.status!.id)?.order ?? -1
    : taskStatuses.find((s) => s.id === initialStatusId)?.order ?? -1;

  const checklistItems = task?.checklistItems ?? [];

  const selectedTemplate = isNew && newTemplateId
    ? availableTemplates.find((t) => t.id === newTemplateId)
    : null;
  const newModeItems = useMemo(() => selectedTemplate?.items.filter((item) => {
    if ((item.phase || "create") !== "create") return false;
    if (!item.visibleFromStageId) return true;
    const visibleFromOrder = taskStatuses.find((s) => s.id === item.visibleFromStageId)?.order ?? 0;
    return currentStageOrder >= visibleFromOrder;
  }) ?? [], [selectedTemplate, taskStatuses, currentStageOrder]);

  const visibleItems = useMemo(() => checklistItems.filter((item) => {
    if (!item.visibleFromStageId) return true;
    const visibleFromOrder = taskStatuses.find((s) => s.id === item.visibleFromStageId)?.order ?? 0;
    return currentStageOrder >= visibleFromOrder;
  }), [checklistItems, taskStatuses, currentStageOrder]);

  const [localCompletions, setLocalCompletions] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    for (const item of checklistItems) {
      if (item.type === "file_upload") map[item.id] = !!item.attachmentId;
      else if (item.type === "textarea") map[item.id] = !!item.textValue?.trim();
      else if (item.type === "mention" || item.type === "copyright") {
        const parsed = (() => { try { return JSON.parse(item.textValue || "{}"); } catch { return {}; } })();
        map[item.id] = parsed.enabled === true ? !!parsed.text : true;
      }
      else map[item.id] = item.completed;
    }
    return map;
  });

  const markItemComplete = (id: string, done: boolean) => {
    setSaved(false);
    setLocalCompletions((prev) => ({ ...prev, [id]: done }));
  };

  const totalCount = visibleItems.length;
  const mandatoryItems = useMemo(() => visibleItems.filter((i) => i.mandatory), [visibleItems]);
  const allMandatoryFilled = mandatoryItems.every((i) => localCompletions[i.id]);
  const titleValid = title.trim().length > 0 && title.trim() !== "Untitled Task";
  const hasTemplates = !!activeTemplateId;

  const newModeMandatoryItems = newModeItems.filter((i) => i.mandatory);
  const allNewMandatoryFilled = newModeMandatoryItems.every((i) => {
    if (i.type === "file_upload") return !!pendingFiles[i.id];
    if (i.type === "mention" || i.type === "copyright") {
      const raw = newAnswers[i.id];
      if (!raw) return true;
      const parsed = (() => { try { return JSON.parse(raw); } catch { return {}; } })();
      return parsed.enabled ? !!parsed.text : true;
    }
    return !!newAnswers[i.id]?.trim();
  });

  const canSaveForm = isNew
    ? hasTemplates && titleValid && allNewMandatoryFilled
    : titleValid && allMandatoryFilled;

  const [showValidation, setShowValidation] = useState(false);

  const missingFields: string[] = [];
  if (showValidation) {
    if (!titleValid) missingFields.push("Task title");
    if (isNew) {
      if (!hasTemplates) missingFields.push("Template selection");
      for (const item of newModeMandatoryItems) {
        if (item.type === "file_upload") {
          if (!pendingFiles[item.id]) missingFields.push(item.name);
        } else if (item.type === "mention" || item.type === "copyright") {
          const raw = newAnswers[item.id];
          if (raw) {
            const parsed = (() => { try { return JSON.parse(raw); } catch { return {}; } })();
            if (parsed.enabled && !parsed.text) missingFields.push(item.name);
          }
        } else {
          if (!newAnswers[item.id]?.trim()) missingFields.push(item.name);
        }
      }
    } else {
      for (const item of mandatoryItems) {
        if (!localCompletions[item.id]) missingFields.push(item.name);
      }
    }
  }

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef({ title: task?.title ?? "", priority: task?.priority ?? null });

  useEffect(() => {
    if (isNew || !task) return;
    const titleChanged = title.trim() !== lastSavedRef.current.title;
    const priorityChanged = priority !== lastSavedRef.current.priority;
    if (!titleChanged && !priorityChanged) return;
    if (!titleValid) return;

    setSaved(false);
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      const updates: Parameters<typeof updateTask>[1] = {};
      if (title.trim() !== lastSavedRef.current.title) updates.title = title.trim();
      if (priority !== lastSavedRef.current.priority) updates.priority = priority;
      if (Object.keys(updates).length === 0) return;

      setSaving(true);
      try {
        await updateTask(task.id, updates);
        lastSavedRef.current = { title: title.trim(), priority };
        setSaved(true);
      } finally {
        setSaving(false);
      }
    }, 800);

    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [title, priority, isNew, task, titleValid]);

  const handleSave = async () => {
    if (saving) return;
    if (!canSaveForm) {
      setShowValidation(true);
      return;
    }
    setShowValidation(false);
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    setSaving(true);
    try {
      if (isNew) {
        const result = await createFullTask({
          projectId,
          title: title.trim(),
          statusId: initialStatusId,
          priority,
          templateIds: newTemplateId ? [newTemplateId] : [],
          answers: newAnswers,
        });
        if (result.ok) {
          if (Object.keys(pendingFiles).length > 0) {
            const taskRes = await fetch(`/api/tasks/${result.data.id}/checklist-items`);
            const items: { id: string; templateItemId: string }[] = await taskRes.json();

            await Promise.all(
              Object.entries(pendingFiles).map(async ([templateItemId, file]) => {
                const checklistItem = items.find((i) => i.templateItemId === templateItemId);
                if (!checklistItem) return;
                const attachmentId = await uploadFileDirect(file, "checklist_item", checklistItem.id);
                if (attachmentId) {
                  await setChecklistItemAttachment(checklistItem.id, attachmentId, projectId);
                }
              })
            );
          }
          router.replace(`/projects/${projectId}/tasks/${result.data.id}`);
        }
      } else {
        const updates: Parameters<typeof updateTask>[1] = {};
        if (title.trim() !== task.title) updates.title = title.trim();
        if (priority !== task.priority) updates.priority = priority;
        if (Object.keys(updates).length > 0) {
          await updateTask(task.id, updates);
        }
        router.refresh();
        setSaved(true);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-full flex flex-col">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-6 h-12 border-b border-border/50 shrink-0">
        <Link
          href={`/projects/${projectId}`}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-[13px]">Back</span>
        </Link>
        <span className="text-muted-foreground/30">/</span>
        <span className="text-[13px] text-foreground font-medium truncate">{isNew ? "New Task" : task?.taskNumber ? `Task #${task.taskNumber}` : "Task"}</span>
        <div className="flex-1" />
        {canEdit && (
          <div className="flex items-center gap-2 shrink-0">
            {isNew ? (
              <Button
                size="sm"
                disabled={saving}
                onClick={handleSave}
                className="gap-1.5"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {saving ? "Creating..." : "Create"}
              </Button>
            ) : (
              <span className="flex items-center gap-1.5 text-[12px] px-3 py-1.5">
                {saving ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                    <span className="text-muted-foreground">Saving...</span>
                  </>
                ) : saved ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-green-400" />
                    <span className="text-green-400">Saved</span>
                  </>
                ) : null}
              </span>
            )}
            {!isNew && canDelete && (
              <button
                onClick={async () => {
                  if (!confirm("Delete this task?")) return;
                  await deleteTask(task.id, projectId, task.project.dealId || undefined);
                  router.push(`/projects/${projectId}`);
                }}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
        <HeaderActions />
      </div>

      {showValidation && missingFields.length > 0 && (
        <div className="mx-6 mt-3 flex items-start gap-3 rounded-xl px-4 py-3 bg-red-500/10 border border-red-500/20">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-[13px] text-red-400 font-medium">Please fill in the required fields:</p>
            <ul className="mt-1 space-y-0.5">
              {missingFields.map((f) => (
                <li key={f} className="text-[12px] text-red-400/80">• {f}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Centered content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto py-10 px-6 space-y-8">

          {/* Template Tabs */}
          {canEdit && availableTemplates.length > 0 && (
            <TemplateTabs
              templates={availableTemplates}
              activeId={activeTemplateId}
              onSelect={handleTemplateSelect}
              syncing={syncing}
            />
          )}

          {/* Title — only after a template is selected */}
          {hasTemplates && (
            canEdit ? (
              <>
                <label className="text-[12px] font-medium text-muted-foreground -mb-6 block">
                  {availableTemplates.find((t) => t.id === activeTemplateId)?.name} Name
                </label>
                <input
                  value={title}
                  onChange={(e) => { setSaved(false); setTitle(e.target.value); }}
                  placeholder="What needs to be done?"
                  className="w-full text-xl font-semibold text-foreground bg-transparent border border-border rounded-xl px-4 py-3 focus:outline-none focus:border-ring transition-colors placeholder:text-muted-foreground/40"
                />
              </>
            ) : (
              <h1 className="text-xl font-semibold text-foreground">{task?.title}</h1>
            )
          )}

          {/* Priority — only after a template is selected */}
          {hasTemplates && (
            <div>
              <label className="text-[12px] font-medium text-muted-foreground mb-2 block">Priority</label>
              <div className="flex gap-1.5">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    onClick={() => { if (!canEdit) return; setSaved(false); setPriority(priority === n ? null : n); }}
                    disabled={!canEdit}
                    className={`w-9 h-9 rounded-lg text-[13px] font-medium transition-colors ${
                      priority === n
                        ? n <= 3
                          ? "bg-green-500/20 text-green-400 ring-1 ring-green-500/40"
                          : n <= 6
                          ? "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/40"
                          : "bg-red-500/20 text-red-400 ring-1 ring-red-500/40"
                        : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                    } disabled:cursor-default`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              {!priority && (
                <p className="text-[11px] text-muted-foreground/50 mt-1.5">No priority selected</p>
              )}
            </div>
          )}

          {/* Fields — new mode */}
          {isNew && newModeItems.length > 0 && (
            <div className="space-y-6">
              <label className="text-[12px] font-medium text-muted-foreground block">
                {selectedTemplate?.name} Questions
              </label>
              <div className="space-y-5">
                {newModeItems.map((item, idx) => (
                  <NewModeField
                    key={item.id}
                    item={item}
                    index={idx + 1}
                    value={newAnswers[item.id] ?? ""}
                    onChange={(val) => setNewAnswers((prev) => ({ ...prev, [item.id]: val }))}
                    pendingFile={pendingFiles[item.id]}
                    onFileSelect={(file) => setPendingFiles((prev) => {
                      const next = { ...prev };
                      if (file) next[item.id] = file;
                      else delete next[item.id];
                      return next;
                    })}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Checklist — edit mode grouped by phase */}
          {!isNew && totalCount > 0 && (
            <div className="space-y-6">
              {(["create", "delivery"] as const).map((phase) => {
                const phaseItems = visibleItems.filter((i) => (i.phase || "create") === phase);
                if (phaseItems.length === 0) return null;
                const firstStatusOrder = taskStatuses[0]?.order ?? 0;
                const createLocked = phase === "create" && currentStageOrder > firstStatusOrder;
                return (
                  <div key={phase}>
                    <div className="flex items-center gap-2 mb-3">
                      <h3 className={`text-[12px] font-semibold uppercase tracking-wider ${
                        phase === "create" ? "text-primary" : "text-amber-400"
                      }`}>
                        {phase === "create" ? "Create" : "Delivery"}
                      </h3>
                      {createLocked && (
                        <span className="text-[10px] text-muted-foreground/50 bg-muted/30 px-2 py-0.5 rounded">Locked</span>
                      )}
                      <div className="flex-1 border-t border-border" />
                    </div>
                    <div className={`rounded-xl bg-card border border-border p-4 space-y-3 ${createLocked ? "opacity-70" : ""}`}>
                      {phaseItems.map((item) => (
                        <ChecklistItemRow
                          key={item.id}
                          item={item}
                          projectId={projectId}
                          canEdit={canEdit && !createLocked}
                          onComplete={(done) => markItemComplete(item.id, done)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Comments — only for existing tasks */}
          {!isNew && task && (
            <TaskComments taskId={task.id} projectId={projectId} />
          )}

        </div>
      </div>
    </div>
  );
}

function NewModeField({
  item,
  index,
  value,
  onChange,
  pendingFile,
  onFileSelect,
}: {
  item: TemplateItem;
  index: number;
  value: string;
  onChange: (val: string) => void;
  pendingFile?: File;
  onFileSelect?: (file: File | null) => void;
}) {
  const options: string[] = item.options ? JSON.parse(item.options) : [];
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const handleFileValidation = useCallback(async (file: File) => {
    setFileError(null);
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!validateFileType(file, item.allowedFileTypes)) {
      setFileError(`"${file.name}" is not a valid ${item.allowedFileTypes} file.`);
      return;
    }
    const formatErr = validateFormat(file, item.allowedFormats);
    if (formatErr) {
      setFileError(`".${ext}" is not allowed. ${formatErr}`);
      return;
    }
    const arErr = await validateAspectRatio(file, item.aspectRatio);
    if (arErr) {
      setFileError(arErr);
      return;
    }
    onFileSelect?.(file);
  }, [item.allowedFileTypes, item.allowedFormats, item.aspectRatio, onFileSelect]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        <span className="text-[12px] text-muted-foreground/50">{index}.</span>
        <span className="text-[13px] font-medium text-foreground flex-1">{item.name}</span>
        {item.mandatory && (
          <span className="text-[10px] text-red-400">*</span>
        )}
        {item.allowedFileTypes && (
          <span className="text-[10px] text-muted-foreground/50">{item.allowedFileTypes}</span>
        )}
      </div>

      {item.type === "text" && (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Type your answer..."
          className="w-full text-[13px] text-foreground placeholder:text-muted-foreground/40 rounded-xl px-4 py-3 bg-transparent border border-border focus:outline-none focus:border-ring transition-colors"
        />
      )}

      {item.type === "textarea" && (
        <textarea
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = e.target.scrollHeight + "px";
          }}
          ref={(el) => {
            if (el && value) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }
          }}
          placeholder="Type your answer..."
          rows={2}
          className="w-full text-[13px] text-foreground placeholder:text-muted-foreground/40 rounded-xl px-4 py-3 bg-transparent border border-border focus:outline-none focus:border-ring transition-colors resize-none overflow-hidden"
        />
      )}

      {item.type === "select" && (
        <div className="relative">
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full text-[13px] text-foreground rounded-xl px-4 py-3 bg-transparent border border-border focus:outline-none focus:border-ring transition-colors appearance-none cursor-pointer"
          >
            <option value="" className="bg-black">Select...</option>
            {options.map((opt) => (
              <option key={opt} value={opt} className="bg-black">{opt}</option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground absolute right-3 top-3.5 pointer-events-none" />
        </div>
      )}

      {item.type === "link" && (
        <input
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://..."
          className="w-full text-[13px] text-foreground placeholder:text-muted-foreground/40 rounded-xl px-4 py-3 bg-transparent border border-border focus:outline-none focus:border-ring transition-colors"
        />
      )}

      {item.type === "yes_no" && (
        <div className="flex gap-2">
          {["Yes", "No"].map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(value === opt ? "" : opt)}
              className={`flex-1 py-2.5 rounded-xl text-[13px] font-medium transition-all border ${
                value === opt
                  ? opt === "Yes"
                    ? "bg-green-500/15 text-green-400 border-green-500/30"
                    : "bg-red-500/15 text-red-400 border-red-500/30"
                  : "bg-transparent border-border text-muted-foreground hover:bg-muted/30 hover:text-foreground"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {(item.type === "mention" || item.type === "copyright") && (() => {
        const parsed = (() => { try { return JSON.parse(value || "{}"); } catch { return {}; } })();
        const enabled = parsed.enabled === true;
        const text = parsed.text || "";
        const update = (e: boolean, t: string) => onChange(JSON.stringify({ enabled: e, text: t }));
        return (
          <div className="space-y-2">
            <div className="flex gap-2">
              {["Yes", "No"].map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => update(opt === "Yes", opt === "No" ? "" : text)}
                  className={`flex-1 py-2.5 rounded-xl text-[13px] font-medium transition-all border ${
                    (opt === "Yes" && enabled) || (opt === "No" && !enabled)
                      ? opt === "Yes"
                        ? "bg-green-500/15 text-green-400 border-green-500/30"
                        : "bg-red-500/15 text-red-400 border-red-500/30"
                      : "bg-transparent border-border text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
            {enabled && (
              item.type === "mention" ? (
                <input
                  type="text"
                  value={text}
                  onChange={(e) => update(true, e.target.value)}
                  placeholder="Enter account name (e.g. @username)"
                  className="w-full text-[13px] text-foreground placeholder:text-muted-foreground/40 rounded-xl px-4 py-3 bg-transparent border border-border focus:outline-none focus:border-ring transition-colors"
                />
              ) : (
                <textarea
                  value={text}
                  onChange={(e) => { update(true, e.target.value); e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
                  placeholder="Enter copyright text"
                  rows={1}
                  className="w-full text-[13px] text-foreground placeholder:text-muted-foreground/40 rounded-xl px-4 py-3 bg-transparent border border-border focus:outline-none focus:border-ring transition-colors resize-none overflow-hidden"
                  ref={(el) => { if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; } }}
                />
              )
            )}
          </div>
        );
      })()}

      {item.type === "file_upload" && (() => {
        const cat = getAllowedCategory(item.allowedFileTypes);
        const constraints = getConstraintLabel(item);
        return (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept={getAcceptString(item.allowedFileTypes)}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileValidation(file);
                e.target.value = "";
              }}
            />
            {fileError && (
              <div className="flex items-start gap-2 rounded-xl px-3 py-2 bg-red-500/10 border border-red-500/20">
                <AlertCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
                <span className="text-[11px] text-red-400">{fileError}</span>
              </div>
            )}
            {pendingFile ? (
              <div className="rounded-xl border border-green-500/30 bg-green-500/5 overflow-hidden">
                <FilePreview file={pendingFile} />
                <div className="flex items-center gap-3 px-4 py-3">
                  <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                  <span className="text-[12px] text-green-400 font-medium flex-1 truncate">{pendingFile.name}</span>
                  <button
                    type="button"
                    onClick={() => { onFileSelect?.(null); setFileError(null); }}
                    className="text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleFileValidation(file);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed overflow-hidden cursor-pointer transition-colors ${
                  cat ? "py-5 gap-3" : "py-4 gap-3 flex-row px-4"
                } ${
                  dragOver
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/30 hover:bg-muted/20"
                }`}
              >
                {cat ? (
                  <>
                    <div className="w-full px-6">
                      <FilePlaceholder category={cat} />
                    </div>
                    <span className="text-[12px] text-muted-foreground/50">
                      {dragOver ? "Drop file here" : `Drop ${cat} file or click to attach`}
                    </span>
                  </>
                ) : (
                  <>
                    <Paperclip className={`w-4 h-4 shrink-0 ${dragOver ? "text-primary" : "text-muted-foreground/40"}`} />
                    <span className="text-[12px] text-muted-foreground/60">
                      {dragOver ? "Drop file here" : "Drop file or click to attach"}
                    </span>
                  </>
                )}
                {constraints && (
                  <span className="text-[10px] text-muted-foreground/40">{constraints}</span>
                )}
              </div>
            )}
          </>
        );
      })()}

      {item.type === "checkbox" && (
        <label className="flex items-center gap-3 px-1 cursor-pointer">
          <input
            type="checkbox"
            checked={value === "true"}
            onChange={(e) => onChange(e.target.checked ? "true" : "")}
            className="rounded"
          />
          <span className="text-[13px] text-foreground">Done</span>
        </label>
      )}
    </div>
  );
}

function TemplateTabs({
  templates,
  activeId,
  onSelect,
  syncing,
}: {
  templates: AvailableTemplate[];
  activeId: string | null;
  onSelect: (id: string) => void;
  syncing: boolean;
}) {
  return (
    <div>
      <label className="text-[12px] font-medium text-muted-foreground mb-3 block">Type</label>
      <div className="flex flex-wrap gap-2">
        {templates.map((t) => {
          const isActive = activeId === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => !syncing && onSelect(t.id)}
              disabled={syncing}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium transition-all border ${
                isActive
                  ? "bg-primary/15 text-primary border-primary/30"
                  : "bg-muted/30 text-muted-foreground border-border hover:bg-muted/50 hover:text-foreground"
              } disabled:opacity-50`}
            >
              {t.name}
              <span className={`text-[10px] ${isActive ? "text-primary/60" : "text-muted-foreground/50"}`}>
                {t.itemCount}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AudioWaveform({ src }: { src: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    const audioCtx = new AudioContext();

    fetch(src)
      .then((r) => r.arrayBuffer())
      .then((buf) => audioCtx.decodeAudioData(buf))
      .then((audioBuffer) => {
        if (cancelled) return;
        const data = audioBuffer.getChannelData(0);
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.scale(dpr, dpr);

        const barCount = Math.floor(w / 3);
        const samplesPerBar = Math.floor(data.length / barCount);
        const barWidth = 2;
        const gap = 1;
        const midY = h / 2;

        ctx.clearRect(0, 0, w, h);
        for (let i = 0; i < barCount; i++) {
          let sum = 0;
          for (let j = 0; j < samplesPerBar; j++) {
            sum += Math.abs(data[i * samplesPerBar + j]);
          }
          const amp = sum / samplesPerBar;
          const barH = Math.max(2, amp * h * 0.9);
          const x = i * (barWidth + gap);
          ctx.fillStyle = "#c084fc";
          ctx.fillRect(x, midY - barH / 2, barWidth, barH);
        }
        setReady(true);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      audioCtx.close();
    };
  }, [src]);

  return (
    <div className="relative w-full">
      <canvas
        ref={canvasRef}
        className="w-full"
        style={{ height: 80, opacity: ready ? 1 : 0, transition: "opacity 0.3s" }}
      />
      {!ready && <EmptyAudioPlaceholder />}
    </div>
  );
}

function EmptyAudioPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center py-6 gap-2">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/30">
        <rect x="9" y="2" width="6" height="12" rx="3" />
        <path d="M5 10a7 7 0 0 0 14 0" />
        <line x1="12" y1="17" x2="12" y2="21" />
        <line x1="8" y1="21" x2="16" y2="21" />
      </svg>
      <span className="text-[11px] text-muted-foreground/40">Audio</span>
    </div>
  );
}

function EmptyVideoPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center py-6 gap-2">
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="text-muted-foreground/30">
        <rect x="4" y="10" width="30" height="24" rx="3" stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="M34 18l10-5v18l-10-5V18z" fill="currentColor" opacity="0.5" />
        <circle cx="15" cy="22" r="4" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.4" />
        <path d="M13.5 22l1.5 1.5 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.4" />
      </svg>
      <span className="text-[11px] text-muted-foreground/40">Video</span>
    </div>
  );
}

function EmptyImagePlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center py-6 gap-2">
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="text-muted-foreground/30">
        <rect x="6" y="8" width="36" height="28" rx="3" stroke="currentColor" strokeWidth="2" fill="none" />
        <circle cx="16" cy="18" r="3" fill="currentColor" opacity="0.4" />
        <path d="M6 30l10-8 6 5 8-6 12 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
      </svg>
      <span className="text-[11px] text-muted-foreground/40">Image</span>
    </div>
  );
}

function FilePlaceholder({ category }: { category: "audio" | "video" | "image" | "document" | null }) {
  if (category === "audio") return <EmptyAudioPlaceholder />;
  if (category === "video") return <EmptyVideoPlaceholder />;
  if (category === "image") return <EmptyImagePlaceholder />;
  return null;
}

function FilePreview({ file }: { file: File }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const objUrl = URL.createObjectURL(file);
    setUrl(objUrl);
    return () => URL.revokeObjectURL(objUrl);
  }, [file]);

  if (!url) return null;

  if (file.type.startsWith("image/")) {
    return (
      <div className="p-2 flex justify-center bg-black/20">
        <img src={url} alt={file.name} loading="lazy" className="max-h-48 rounded-lg object-contain" />
      </div>
    );
  }

  if (file.type.startsWith("audio/")) {
    return (
      <div className="p-3 bg-black/20 space-y-2">
        <AudioWaveform src={url} />
        <audio controls className="w-full h-10" src={url}>
          Your browser does not support audio.
        </audio>
      </div>
    );
  }

  if (file.type.startsWith("video/")) {
    return (
      <div className="p-2 bg-black/20">
        <video controls className="w-full max-h-64 rounded-lg" src={url}>
          Your browser does not support video.
        </video>
      </div>
    );
  }

  return null;
}

const CATEGORY_ACCEPT_MAP: Record<string, string> = {
  audio: "audio/*",
  video: "video/*",
  image: "image/*",
  document: ".pdf,.doc,.docx,.xls,.xlsx,.pptx,.txt",
};

const CATEGORY_MIME_PREFIX: Record<string, string> = {
  audio: "audio/",
  video: "video/",
  image: "image/",
};

function getAcceptString(allowedFileTypes: string | null): string | undefined {
  if (!allowedFileTypes) return undefined;
  const parts = allowedFileTypes.split(",").map((t) => t.trim().toLowerCase());
  const accepts = parts.map((p) => CATEGORY_ACCEPT_MAP[p] || `.${p}`);
  return accepts.join(",");
}

function validateFileType(file: File, allowedFileTypes: string | null): boolean {
  if (!allowedFileTypes) return true;
  const parts = allowedFileTypes.split(",").map((t) => t.trim().toLowerCase());
  for (const p of parts) {
    const prefix = CATEGORY_MIME_PREFIX[p];
    if (prefix && file.type.startsWith(prefix)) return true;
    if (p === "document") {
      const docExts = ["pdf", "doc", "docx", "xls", "xlsx", "pptx", "txt"];
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (ext && docExts.includes(ext)) return true;
    }
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === p) return true;
  }
  return false;
}

function validateFormat(file: File, allowedFormats: string | null): string | null {
  if (!allowedFormats) return null;
  const formats: string[] = JSON.parse(allowedFormats);
  if (formats.length === 0) return null;
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  if (formats.includes(ext)) return null;
  return `Allowed formats: ${formats.map((f) => `.${f}`).join(", ")}`;
}

function validateAspectRatio(
  file: File,
  aspectRatio: string | null,
): Promise<string | null> {
  if (!aspectRatio) return Promise.resolve(null);
  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");
  if (!isImage && !isVideo) return Promise.resolve(null);

  const [rw, rh] = aspectRatio.split(":").map(Number);
  if (!rw || !rh) return Promise.resolve(null);
  const target = rw / rh;
  const tolerance = 0.05;

  return new Promise((resolve) => {
    if (isImage) {
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(img.src);
        const actual = img.naturalWidth / img.naturalHeight;
        if (Math.abs(actual - target) / target > tolerance) {
          resolve(`Aspect ratio must be ${aspectRatio} (file is ${img.naturalWidth}×${img.naturalHeight})`);
        } else {
          resolve(null);
        }
      };
      img.onerror = () => { URL.revokeObjectURL(img.src); resolve(null); };
      img.src = URL.createObjectURL(file);
    } else {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(video.src);
        const actual = video.videoWidth / video.videoHeight;
        if (Math.abs(actual - target) / target > tolerance) {
          resolve(`Aspect ratio must be ${aspectRatio} (file is ${video.videoWidth}×${video.videoHeight})`);
        } else {
          resolve(null);
        }
      };
      video.onerror = () => { URL.revokeObjectURL(video.src); resolve(null); };
      video.src = URL.createObjectURL(file);
    }
  });
}

function getConstraintLabel(item: { allowedFormats: string | null; aspectRatio: string | null }): string | null {
  const parts: string[] = [];
  if (item.allowedFormats) {
    const fmts: string[] = JSON.parse(item.allowedFormats);
    if (fmts.length > 0) parts.push(fmts.map((f) => `.${f}`).join(", "));
  }
  if (item.aspectRatio) parts.push(item.aspectRatio);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function getFileCategory(fileNameOrType: string): "image" | "audio" | "video" | "other" {
  if (fileNameOrType.startsWith("image/")) return "image";
  if (fileNameOrType.startsWith("audio/")) return "audio";
  if (fileNameOrType.startsWith("video/")) return "video";
  const ext = fileNameOrType.split(".").pop()?.toLowerCase() || "";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(ext)) return "image";
  if (["mp3", "wav", "ogg", "aac", "m4a", "flac", "wma"].includes(ext)) return "audio";
  if (["mp4", "webm", "mov", "avi", "mkv", "m4v"].includes(ext)) return "video";
  return "other";
}

const AUDIO_EXTS = ["mp3", "wav", "ogg", "aac", "m4a", "flac", "wma"];
const VIDEO_EXTS = ["mp4", "webm", "mov", "avi", "mkv", "m4v"];
const IMAGE_EXTS = ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"];
const DOC_EXTS = ["pdf", "doc", "docx", "xls", "xlsx", "pptx", "txt"];

function getAllowedCategory(allowedFileTypes: string | null): "audio" | "video" | "image" | "document" | null {
  if (!allowedFileTypes) return null;
  const parts = allowedFileTypes.split(",").map((t) => t.trim().toLowerCase());
  if (parts.includes("audio") || parts.some((p) => AUDIO_EXTS.includes(p))) return "audio";
  if (parts.includes("video") || parts.some((p) => VIDEO_EXTS.includes(p))) return "video";
  if (parts.includes("image") || parts.some((p) => IMAGE_EXTS.includes(p))) return "image";
  if (parts.includes("document") || parts.some((p) => DOC_EXTS.includes(p))) return "document";
  return null;
}

function ChecklistItemRow({
  item,
  projectId,
  canEdit,
  onComplete,
}: {
  item: ChecklistItem;
  projectId: string;
  canEdit: boolean;
  onComplete: (done: boolean) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [typeError, setTypeError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasFile = !!item.attachmentId;

  useEffect(() => {
    if (!hasFile || !item.attachmentId) return;
    let cancelled = false;
    fetch(`/api/files/${item.attachmentId}/download-url`)
      .then((r) => r.json())
      .then((data) => { if (!cancelled && data.url) setPreviewUrl(data.url); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [item.attachmentId, hasFile]);

  const handleFileUpload = useCallback(async (file: File) => {
    setUploading(true);
    try {
      const attachmentId = await uploadFileDirect(file, "checklist_item", item.id);
      if (!attachmentId) throw new Error("Upload failed");

      await setChecklistItemAttachment(item.id, attachmentId, projectId);
      setUploadedFileName(file.name);

      const dlRes = await fetch(`/api/files/${attachmentId}/download-url`);
      const dlData = await dlRes.json();
      if (dlData.url) setPreviewUrl(dlData.url);

      onComplete(true);
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploading(false);
    }
  }, [item.id, projectId, onComplete]);

  const tryUpload = useCallback(async (file: File) => {
    setTypeError(null);
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!validateFileType(file, item.allowedFileTypes)) {
      setTypeError(`"${file.name}" is not a valid ${item.allowedFileTypes} file.`);
      return;
    }
    const formatErr = validateFormat(file, item.allowedFormats);
    if (formatErr) {
      setTypeError(`".${ext}" is not allowed. ${formatErr}`);
      return;
    }
    const arErr = await validateAspectRatio(file, item.aspectRatio);
    if (arErr) { setTypeError(arErr); return; }
    handleFileUpload(file);
  }, [item.allowedFileTypes, item.allowedFormats, item.aspectRatio, handleFileUpload]);

  const displayName = uploadedFileName || "File uploaded";
  const fileCategory = uploadedFileName
    ? getFileCategory(uploadedFileName)
    : getAllowedCategory(item.allowedFileTypes) || "other";

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        <span className="text-[13px] font-medium text-foreground flex-1">
          {item.name}
          {item.mandatory && <span className="text-red-400 ml-1">*</span>}
        </span>
        {item.allowedFileTypes && (
          <span className="text-[10px] text-muted-foreground/50">{item.allowedFileTypes}</span>
        )}
      </div>

      {item.type === "text" && (
        <TextAreaField item={item} projectId={projectId} canEdit={canEdit} onComplete={onComplete} singleLine />
      )}

      {item.type === "textarea" && (
        <TextAreaField item={item} projectId={projectId} canEdit={canEdit} onComplete={onComplete} />
      )}

      {item.type === "select" && (
        <SelectField item={item} projectId={projectId} canEdit={canEdit} onComplete={onComplete} />
      )}

      {item.type === "link" && (
        <LinkField item={item} projectId={projectId} canEdit={canEdit} onComplete={onComplete} />
      )}

      {item.type === "yes_no" && (
        <YesNoField item={item} projectId={projectId} canEdit={canEdit} onComplete={onComplete} />
      )}

      {(item.type === "mention" || item.type === "copyright") && (
        <MentionCopyrightField item={item} projectId={projectId} canEdit={canEdit} onComplete={onComplete} />
      )}

      {item.type === "file_upload" && (() => {
        const cat = getAllowedCategory(item.allowedFileTypes);
        const constraints = getConstraintLabel(item);
        return (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept={getAcceptString(item.allowedFileTypes)}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) tryUpload(file);
                e.target.value = "";
              }}
            />

            {typeError && (
              <div className="flex items-center gap-2 rounded-lg px-3 py-2 bg-red-500/10 border border-red-500/20">
                <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                <span className="text-[11px] text-red-400">{typeError}</span>
              </div>
            )}

            {uploading ? (
              <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
                <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
                <span className="text-[12px] text-muted-foreground">Uploading...</span>
              </div>
            ) : hasFile ? (
              <div className="rounded-xl border border-green-500/30 bg-green-500/5 overflow-hidden">
                {previewUrl && fileCategory === "image" && (
                  <div className="p-2 flex justify-center bg-black/20">
                    <img src={previewUrl} alt={displayName} loading="lazy" className="max-h-48 rounded-lg object-contain" />
                  </div>
                )}
                {previewUrl && fileCategory === "audio" && (
                  <div className="p-3 bg-black/20 space-y-2">
                    <AudioWaveform src={previewUrl} />
                    <audio controls className="w-full h-10" src={previewUrl}>
                      Your browser does not support audio.
                    </audio>
                  </div>
                )}
                {previewUrl && fileCategory === "video" && (
                  <div className="p-2 bg-black/20">
                    <video controls className="w-full max-h-64 rounded-lg" src={previewUrl}>
                      Your browser does not support video.
                    </video>
                  </div>
                )}

                <div className="flex items-center gap-3 px-4 py-3">
                  <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                  <span className="text-[12px] text-green-400 font-medium flex-1 min-w-0 truncate">{displayName}</span>
                  <div className="flex items-center gap-3 shrink-0">
                    {previewUrl && (
                      <a
                        href={previewUrl}
                        download={uploadedFileName || "file"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-primary transition-colors"
                        title="Download"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    )}
                    {canEdit && (
                      <>
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
                        >
                          Replace
                        </button>
                        <button
                          onClick={async () => {
                            await removeChecklistItemAttachment(item.id, projectId);
                            setPreviewUrl(null);
                            setUploadedFileName(null);
                            onComplete(false);
                          }}
                          className="text-muted-foreground hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file && canEdit) tryUpload(file);
                }}
                onClick={() => canEdit && fileInputRef.current?.click()}
                className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed overflow-hidden cursor-pointer transition-colors ${
                  cat ? "py-5 gap-3" : "py-4 gap-3 flex-row px-4"
                } ${
                  dragOver
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/30 hover:bg-muted/20"
                }`}
              >
                {cat ? (
                  <>
                    <div className="w-full px-6">
                      <FilePlaceholder category={cat} />
                    </div>
                    <span className="text-[12px] text-muted-foreground/50">
                      {dragOver ? "Drop file here" : `Drop ${cat} file or click to attach`}
                    </span>
                  </>
                ) : (
                  <>
                    <Paperclip className={`w-4 h-4 shrink-0 ${dragOver ? "text-primary" : "text-muted-foreground/40"}`} />
                    <span className="text-[12px] text-muted-foreground/60">
                      {dragOver ? "Drop file here" : "Drop file or click to attach"}
                    </span>
                  </>
                )}
                {constraints && (
                  <span className="text-[10px] text-muted-foreground/40">{constraints}</span>
                )}
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
}

function TextAreaField({
  item,
  projectId,
  canEdit,
  onComplete,
  singleLine,
}: {
  item: ChecklistItem;
  projectId: string;
  canEdit: boolean;
  onComplete: (done: boolean) => void;
  singleLine?: boolean;
}) {
  const [value, setValue] = useState(item.textValue || "");
  const [saved, setSaved] = useState(!!item.textValue);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const autoResize = useCallback(() => {
    if (singleLine) return;
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [singleLine]);

  const handleSave = async () => {
    if (value === (item.textValue || "")) return;
    await saveChecklistItemText(item.id, value, projectId);
    const done = !!value.trim();
    setSaved(done);
    onComplete(done);
  };

  useEffect(() => {
    if (!singleLine) autoResize();
  }, [singleLine, autoResize, value]);

  if (singleLine) {
    return (
      <div className="relative">
        <input
          value={value}
          onChange={(e) => { if (!canEdit) return; setValue(e.target.value); setSaved(false); }}
          onBlur={handleSave}
          placeholder={canEdit ? "Type your answer..." : ""}
          readOnly={!canEdit}
          className={`w-full text-[13px] text-foreground placeholder:text-muted-foreground/40 rounded-xl px-4 py-3 focus:outline-none transition-colors ${
            !canEdit ? "cursor-text select-text opacity-80" : ""
          } ${
            saved && value.trim()
              ? "bg-green-500/5 border border-green-500/30"
              : "bg-transparent border border-border focus:border-ring"
          }`}
        />
        {saved && value.trim() && !canEdit && (
          <button
            onClick={() => { navigator.clipboard.writeText(value); }}
            className="absolute top-2.5 right-3 text-muted-foreground hover:text-foreground transition-colors"
            title="Copy text"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
          </button>
        )}
        {saved && value.trim() && canEdit && (
          <CheckCircle2 className="w-4 h-4 text-green-400 absolute top-3 right-3" />
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => { if (!canEdit) return; setValue(e.target.value); setSaved(false); autoResize(); }}
        onBlur={handleSave}
        placeholder={canEdit ? "Type your answer..." : ""}
        rows={2}
        readOnly={!canEdit}
        className={`w-full text-[13px] text-foreground placeholder:text-muted-foreground/40 rounded-xl px-4 py-3 focus:outline-none transition-colors resize-none ${
          !canEdit ? "cursor-text select-text opacity-80" : ""
        } ${
          saved && value.trim()
            ? "bg-green-500/5 border border-green-500/30"
            : "bg-transparent border border-border focus:border-ring"
        }`}
      />
      {saved && value.trim() && !canEdit && (
        <button
          onClick={() => { navigator.clipboard.writeText(value); }}
          className="absolute top-2.5 right-3 text-muted-foreground hover:text-foreground transition-colors"
          title="Copy text"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
        </button>
      )}
      {saved && value.trim() && canEdit && (
        <CheckCircle2 className="w-4 h-4 text-green-400 absolute top-3 right-3" />
      )}
    </div>
  );
}

function SelectField({
  item,
  projectId,
  canEdit,
  onComplete,
}: {
  item: ChecklistItem;
  projectId: string;
  canEdit: boolean;
  onComplete: (done: boolean) => void;
}) {
  const options: string[] = item.options ? JSON.parse(item.options) : [];
  const [value, setValue] = useState(item.textValue || "");
  const [saved, setSaved] = useState(!!item.textValue);

  const handleChange = async (val: string) => {
    setValue(val);
    await saveChecklistItemText(item.id, val, projectId);
    const done = !!val;
    setSaved(done);
    onComplete(done);
  };

  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        disabled={!canEdit}
        className={`w-full text-[13px] text-foreground rounded-xl px-4 py-3 focus:outline-none transition-colors disabled:opacity-60 appearance-none cursor-pointer ${
          saved && value
            ? "bg-green-500/5 border border-green-500/30"
            : "bg-transparent border border-border focus:border-ring"
        }`}
      >
        <option value="" className="bg-black">Select...</option>
        {options.map((opt) => (
          <option key={opt} value={opt} className="bg-black">{opt}</option>
        ))}
      </select>
      <ChevronDown className="w-3.5 h-3.5 text-muted-foreground absolute right-3 top-3.5 pointer-events-none" />
      {saved && value && (
        <CheckCircle2 className="w-4 h-4 text-green-400 absolute top-3 right-8" />
      )}
    </div>
  );
}

function LinkField({
  item,
  projectId,
  canEdit,
  onComplete,
}: {
  item: ChecklistItem;
  projectId: string;
  canEdit: boolean;
  onComplete: (done: boolean) => void;
}) {
  const [value, setValue] = useState(item.textValue || "");
  const [saved, setSaved] = useState(!!item.textValue);

  const handleSave = async () => {
    if (value === (item.textValue || "")) return;
    await saveChecklistItemText(item.id, value, projectId);
    const done = !!value.trim();
    setSaved(done);
    onComplete(done);
  };

  return (
    <div className="relative">
      <input
        type="url"
        value={value}
        onChange={(e) => { setValue(e.target.value); setSaved(false); }}
        onBlur={handleSave}
        placeholder="https://..."
        disabled={!canEdit}
        className={`w-full text-[13px] text-foreground placeholder:text-muted-foreground/40 rounded-xl px-4 py-3 focus:outline-none transition-colors disabled:opacity-60 ${
          saved && value.trim()
            ? "bg-green-500/5 border border-green-500/30"
            : "bg-transparent border border-border focus:border-ring"
        }`}
      />
      {saved && value.trim() && (
        <CheckCircle2 className="w-4 h-4 text-green-400 absolute top-3 right-3" />
      )}
    </div>
  );
}

function YesNoField({
  item,
  projectId,
  canEdit,
  onComplete,
}: {
  item: ChecklistItem;
  projectId: string;
  canEdit: boolean;
  onComplete: (done: boolean) => void;
}) {
  const [value, setValue] = useState(item.textValue || "");

  const handleSelect = async (val: string) => {
    const next = val === value ? "" : val;
    setValue(next);
    await saveChecklistItemText(item.id, next, projectId);
    onComplete(!!next);
  };

  return (
    <div className="flex gap-2">
      {["Yes", "No"].map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => canEdit && handleSelect(opt)}
          disabled={!canEdit}
          className={`flex-1 py-2.5 rounded-xl text-[13px] font-medium transition-all border ${
            value === opt
              ? opt === "Yes"
                ? "bg-green-500/15 text-green-400 border-green-500/30"
                : "bg-red-500/15 text-red-400 border-red-500/30"
              : "bg-transparent border-border text-muted-foreground hover:bg-muted/30 hover:text-foreground"
          } disabled:opacity-60`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function MentionCopyrightField({
  item,
  projectId,
  canEdit,
  onComplete,
}: {
  item: ChecklistItem;
  projectId: string;
  canEdit: boolean;
  onComplete: (done: boolean) => void;
}) {
  const parsed = (() => { try { return JSON.parse(item.textValue || "{}"); } catch { return {}; } })();
  const [enabled, setEnabled] = useState<boolean>(parsed.enabled === true);
  const [text, setText] = useState<string>(parsed.text || "");

  const save = async (e: boolean, t: string) => {
    const val = JSON.stringify({ enabled: e, text: t });
    await saveChecklistItemText(item.id, val, projectId);
    onComplete(e ? !!t : true);
  };

  const handleToggle = async (opt: string) => {
    if (!canEdit) return;
    const next = opt === "Yes";
    setEnabled(next);
    if (!next) setText("");
    await save(next, next ? text : "");
  };

  const handleTextChange = (val: string) => {
    setText(val);
  };

  const handleTextBlur = async () => {
    await save(enabled, text);
  };

  const isMention = item.type === "mention";

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {["Yes", "No"].map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => handleToggle(opt)}
            disabled={!canEdit}
            className={`flex-1 py-2.5 rounded-xl text-[13px] font-medium transition-all border ${
              (opt === "Yes" && enabled) || (opt === "No" && !enabled)
                ? opt === "Yes"
                  ? "bg-green-500/15 text-green-400 border-green-500/30"
                  : "bg-red-500/15 text-red-400 border-red-500/30"
                : "bg-transparent border-border text-muted-foreground hover:bg-muted/30 hover:text-foreground"
            } disabled:opacity-60`}
          >
            {opt}
          </button>
        ))}
      </div>
      {enabled && (
        isMention ? (
          <input
            type="text"
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            onBlur={handleTextBlur}
            disabled={!canEdit}
            placeholder="Enter account name (e.g. @username)"
            className="w-full text-[13px] text-foreground placeholder:text-muted-foreground/40 rounded-xl px-4 py-3 bg-transparent border border-border focus:outline-none focus:border-ring transition-colors disabled:opacity-60"
          />
        ) : (
          <textarea
            value={text}
            onChange={(e) => { handleTextChange(e.target.value); e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
            onBlur={handleTextBlur}
            disabled={!canEdit}
            placeholder="Enter copyright text"
            rows={1}
            className="w-full text-[13px] text-foreground placeholder:text-muted-foreground/40 rounded-xl px-4 py-3 bg-transparent border border-border focus:outline-none focus:border-ring transition-colors resize-none overflow-hidden disabled:opacity-60"
            ref={(el) => { if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; } }}
          />
        )
      )}
    </div>
  );
}
