"use client";

import { useState, useRef } from "react";
import { updateProjectTemplates, updateProjectStatus, updateProjectThumbnail, updateProjectDescription, updateProjectName, updateProjectRequirePublishing } from "@/actions/projects";
import { ArrowLeft, ClipboardCheck, ChevronDown, ChevronRight, Upload, CheckSquare, Shield, Activity, ImageIcon, Trash2, Loader2, FileText, CheckCircle2 } from "lucide-react";
import Link from "next/link";

type TaskStatus = { id: string; name: string; color: string; order: number };
type ProjectStatus = { id: string; name: string; color: string; order: number };

type TemplateItem = {
  id: string;
  name: string;
  type: string;
  role: string;
  requiredBeforeStage: TaskStatus | null;
};

type Template = {
  id: string;
  name: string;
  description: string | null;
  items: TemplateItem[];
};

type ProjectData = {
  id: string;
  name: string;
  description: string | null;
  requirePublishing: boolean;
  statusId: string | null;
  thumbnailId: string | null;
  projectTemplates: { templateId: string }[];
};

export function ProjectSettingsClient({
  project,
  allTemplates,
  taskStatuses,
  projectStatuses,
}: {
  project: ProjectData;
  allTemplates: Template[];
  taskStatuses: TaskStatus[];
  projectStatuses: ProjectStatus[];
}) {
  const [projectName, setProjectName] = useState(project.name);
  const [editingName, setEditingName] = useState(false);
  const [currentStatusId, setCurrentStatusId] = useState<string | null>(project.statusId);
  const [linkedIds, setLinkedIds] = useState<string[]>(
    project.projectTemplates.map((pt) => pt.templateId)
  );
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleToggle = async (templateId: string) => {
    if (saving) return;
    setSaving(true);
    const next = linkedIds.includes(templateId)
      ? linkedIds.filter((x) => x !== templateId)
      : [...linkedIds, templateId];
    setLinkedIds(next);
    await updateProjectTemplates(project.id, next);
    setSaving(false);
  };

  return (
    <div className="p-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3 h-12 mb-8">
        <Link
          href={`/projects/${project.id}`}
          className="w-icon-btn h-icon-btn rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
        >
          <ArrowLeft className="w-icon-sm h-icon-sm" />
        </Link>
        <div className="flex-1 min-w-0">
          {editingName ? (
            <input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              onBlur={async () => {
                setEditingName(false);
                if (projectName.trim() && projectName.trim() !== project.name) {
                  await updateProjectName(project.id, projectName);
                } else {
                  setProjectName(project.name);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                if (e.key === "Escape") { setProjectName(project.name); setEditingName(false); }
              }}
              autoFocus
              className="text-lg font-semibold text-foreground bg-black border border-border rounded-lg px-2 py-0.5 w-full focus:outline-none focus:border-ring transition-colors"
            />
          ) : (
            <h1
              onClick={() => setEditingName(true)}
              className="text-lg font-semibold text-foreground cursor-pointer hover:text-primary transition-colors truncate"
              title="Click to rename"
            >
              {projectName}
            </h1>
          )}
          <p className="text-sub text-muted-foreground">Project Settings</p>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-8">
        {/* Project Status */}
        <SettingsSection
          icon={<Activity className="w-4 h-4" />}
          title="Project Status"
          description="Set the current status of this project."
        >
          <div className="flex flex-wrap gap-2">
            {projectStatuses.map((status) => (
              <button
                key={status.id}
                onClick={async () => {
                  setCurrentStatusId(status.id);
                  await updateProjectStatus(project.id, status.id);
                }}
                className={`px-3 py-1.5 rounded-lg text-sub font-medium transition-colors ${
                  currentStatusId === status.id
                    ? "ring-2 ring-offset-1 ring-offset-background"
                    : "hover:opacity-80"
                }`}
                style={{
                  backgroundColor: `${status.color}20`,
                  color: status.color,
                  ...(currentStatusId === status.id ? { ringColor: status.color } : {}),
                }}
              >
                {status.name}
              </button>
            ))}
          </div>
        </SettingsSection>

        {/* Description */}
        <DescriptionSection projectId={project.id} initialDescription={project.description} />

        {/* Require Publishing */}
        <RequirePublishingSection projectId={project.id} initialValue={project.requirePublishing} />

        {/* Thumbnail */}
        <ThumbnailSection projectId={project.id} thumbnailId={project.thumbnailId} />

        {/* Checklist Templates Section */}
        <SettingsSection
          icon={<ClipboardCheck className="w-4 h-4" />}
          title="Checklist Templates"
          description="Select which checklist templates apply to tasks in this project. When a new task is created, all items from linked templates will be added automatically."
        >
          {allTemplates.length === 0 ? (
            <div className="text-body text-muted-foreground py-4">
              No templates available.{" "}
              <Link href="/settings/checklists" className="text-primary hover:underline">
                Create one in Settings
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {allTemplates.map((template) => {
                const linked = linkedIds.includes(template.id);
                const expanded = expandedId === template.id;
                return (
                  <div
                    key={template.id}
                    className={`rounded-xl border transition-colors ${
                      linked ? "border-primary/40 bg-primary/5" : "border-border bg-card"
                    }`}
                  >
                    <div className="flex items-center gap-3 p-3">
                      <button
                        onClick={() => handleToggle(template.id)}
                        disabled={saving}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                          linked
                            ? "bg-primary border-primary"
                            : "border-muted-foreground/40 hover:border-primary"
                        }`}
                      >
                        {linked && (
                          <svg className="w-3 h-3 text-primary-foreground" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>
                      <div
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => setExpandedId(expanded ? null : template.id)}
                      >
                        <div className="flex items-center gap-2">
                          <h4 className="text-body font-medium text-foreground">{template.name}</h4>
                          <span className="text-label text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {template.items.length} item{template.items.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                        {template.description && (
                          <p className="text-sub text-muted-foreground mt-0.5">{template.description}</p>
                        )}
                      </div>
                      <button
                        onClick={() => setExpandedId(expanded ? null : template.id)}
                        className="w-icon-btn h-icon-btn rounded flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {expanded ? <ChevronDown className="w-icon-sm h-icon-sm" /> : <ChevronRight className="w-icon-sm h-icon-sm" />}
                      </button>
                    </div>

                    {expanded && template.items.length > 0 && (
                      <div className="px-3 pb-3 pt-0 border-t border-border/50 mt-0">
                        <div className="space-y-1 pt-2">
                          {template.items.map((item) => (
                            <div key={item.id} className="flex items-center gap-2.5 py-1 px-2 rounded-lg">
                              <div className="w-4 h-4 flex items-center justify-center text-muted-foreground">
                                {item.type === "file_upload" ? (
                                  <Upload className="w-3 h-3" />
                                ) : (
                                  <CheckSquare className="w-3 h-3" />
                                )}
                              </div>
                              <span className="flex-1 text-sub text-foreground">{item.name}</span>
                              <RoleBadge role={item.role} />
                              {item.requiredBeforeStage && (
                                <span className="text-label px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 font-medium">
                                  Before: {item.requiredBeforeStage.name}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </SettingsSection>
      </div>
    </div>
  );
}

function RequirePublishingSection({ projectId, initialValue }: { projectId: string; initialValue: boolean }) {
  const [value, setValue] = useState(initialValue);

  const handleToggle = async (val: boolean) => {
    setValue(val);
    await updateProjectRequirePublishing(projectId, val);
  };

  return (
    <SettingsSection
      icon={<CheckSquare className="w-4 h-4" />}
      title="Require Publishing"
      description="When enabled, completed tasks must go through a publishing step before they are finalized."
    >
      <div className="flex gap-2">
        {([false, true] as const).map((opt) => (
          <button
            key={String(opt)}
            onClick={() => handleToggle(opt)}
            className={`px-4 py-2 rounded-xl text-body font-medium border transition-colors ${
              value === opt
                ? "bg-primary/15 text-primary border-primary/30"
                : "bg-muted/30 text-muted-foreground border-border hover:text-foreground"
            }`}
          >
            {opt ? "Yes" : "No"}
          </button>
        ))}
      </div>
    </SettingsSection>
  );
}

function DescriptionSection({ projectId, initialDescription }: { projectId: string; initialDescription: string | null }) {
  const [value, setValue] = useState(initialDescription || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setSaved(false);
    await updateProjectDescription(projectId, value);
    setSaving(false);
    setSaved(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setSaved(false), 3000);
  };

  return (
    <SettingsSection
      icon={<FileText className="w-4 h-4" />}
      title="Project Description"
      description="Add a description to help your team understand this project."
    >
      <textarea
        value={value}
        onChange={(e) => { setValue(e.target.value); setSaved(false); }}
        placeholder="Describe this project..."
        rows={4}
        className="w-full text-body text-foreground placeholder:text-muted-foreground/40 rounded-xl px-4 py-3 bg-black border border-border focus:outline-none focus:border-ring transition-colors resize-none"
      />
      <div className="flex items-center justify-end gap-2 mt-2">
        {saved && (
          <span className="flex items-center gap-1 text-sub text-green-400">
            <CheckCircle2 className="w-3.5 h-3.5" /> Saved
          </span>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-sub font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </SettingsSection>
  );
}

function ThumbnailSection({ projectId, thumbnailId }: { projectId: string; thumbnailId: string | null }) {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [currentId, setCurrentId] = useState(thumbnailId);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useState(() => {
    if (!currentId) return;
    fetch(`/api/files/${currentId}/download-url`)
      .then((r) => r.json())
      .then((data) => { if (data.url) setPreviewUrl(data.url); })
      .catch(() => {});
  });

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const res = await fetch("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          sizeBytes: file.size,
          contentType: file.type,
          entityType: "project_thumbnail",
          entityId: projectId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      await fetch(`/api/files/${data.id}/upload`, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      await fetch(`/api/files/${data.id}/complete`, { method: "POST" });
      await updateProjectThumbnail(projectId, data.id);

      setCurrentId(data.id);
      const dlRes = await fetch(`/api/files/${data.id}/download-url`);
      const dlData = await dlRes.json();
      if (dlData.url) setPreviewUrl(dlData.url);
    } catch (err) {
      console.error("Thumbnail upload failed:", err);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    await updateProjectThumbnail(projectId, null);
    setCurrentId(null);
    setPreviewUrl(null);
  };

  return (
    <SettingsSection
      icon={<ImageIcon className="w-4 h-4" />}
      title="Project Thumbnail"
      description="Upload a cover image for this project."
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUpload(file);
          e.target.value = "";
        }}
      />

      {uploading ? (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-6 justify-center">
          <Loader2 className="w-5 h-5 text-primary animate-spin" />
          <span className="text-body text-muted-foreground">Uploading...</span>
        </div>
      ) : previewUrl ? (
        <div className="relative rounded-xl overflow-hidden border border-border group">
          <img src={previewUrl} alt="Project thumbnail" loading="lazy" className="w-full aspect-square object-cover" />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-sub text-white bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors"
            >
              Replace
            </button>
            <button
              onClick={handleRemove}
              className="text-sub text-white bg-red-500/40 hover:bg-red-500/60 px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border hover:border-muted-foreground/30 hover:bg-muted/20 py-10 cursor-pointer transition-colors"
        >
          <Upload className="w-6 h-6 text-muted-foreground/40" />
          <span className="text-sub text-muted-foreground/60">Click to upload a thumbnail image</span>
        </button>
      )}
    </SettingsSection>
  );
}

function SettingsSection({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-muted-foreground">{icon}</span>
        <h2 className="text-subheading font-semibold text-foreground">{title}</h2>
      </div>
      <p className="text-sub text-muted-foreground mb-4">{description}</p>
      {children}
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const config: Record<string, { label: string; className: string }> = {
    any: { label: "Anyone", className: "bg-muted text-muted-foreground" },
    creator: { label: "Creator", className: "bg-blue-500/15 text-blue-400" },
    assignee: { label: "Assignee", className: "bg-purple-500/15 text-purple-400" },
  };
  const { label, className } = config[role] || config.any;
  return (
    <span className={`text-label px-1.5 py-0.5 rounded font-medium inline-flex items-center gap-0.5 ${className}`}>
      <Shield className="w-2.5 h-2.5" />
      {label}
    </span>
  );
}
