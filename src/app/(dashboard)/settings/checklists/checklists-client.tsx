"use client";

import { useState } from "react";
import {
  createChecklistTemplate,
  updateChecklistTemplate,
  deleteChecklistTemplate,
  addChecklistTemplateItem,
  deleteChecklistTemplateItem,
  updateChecklistTemplateItem,
} from "@/actions/settings";
import { ArrowLeft, Plus, Trash2, X, GripVertical, Pencil } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type TaskStatus = { id: string; name: string; color: string; order: number };
type TemplateItem = {
  id: string;
  name: string;
  type: string;
  role: string;
  options: string | null;
  mandatory: boolean;
  phase: string;
  allowedFileTypes: string | null;
  allowedFormats: string | null;
  aspectRatio: string | null;
  order: number;
  visibleFromStage: TaskStatus | null;
  requiredBeforeStage: TaskStatus | null;
};
type Template = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  description: string | null;
  items: TemplateItem[];
};

const TYPE_LABELS: Record<string, string> = {
  text: "Text",
  textarea: "Text Area",
  select: "Dropdown",
  file_upload: "File",
  audio: "Audio",
  video: "Video",
  image: "Image",
  document: "Document",
  link: "Link",
  yes_no: "Yes / No",
  checkbox: "Checkbox",
  mention: "Mention",
  copyright: "Copyright",
};

const FILE_TYPES = ["audio", "video", "image", "document", "file_upload"];

const FORMAT_OPTIONS: Record<string, string[]> = {
  image: ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "tiff"],
  video: ["mp4", "mov", "webm", "avi", "mkv", "m4v"],
  audio: ["mp3", "wav", "ogg", "aac", "m4a", "flac", "wma"],
};

const HAS_ASPECT_RATIO = ["image", "video"];

const TEMPLATE_COLORS = [
  "#22d3ee", "#3b82f6", "#8b5cf6", "#c084fc",
  "#ec4899", "#f43f5e", "#f97316", "#eab308",
  "#22c55e", "#14b8a6", "#6b7280", "#ffffff",
];

const TEMPLATE_ICONS = [
  "🎬", "🎥", "📸", "🎵", "🎙️", "📝", "📄", "📊",
  "🎨", "✏️", "📐", "🖥️", "📱", "🌐", "📢", "💡",
  "⭐", "🔥", "🚀", "💎", "🎯", "📌", "🏷️", "📁",
];

const ASPECT_RATIOS = [
  { value: "16:9", label: "16:9 — Landscape" },
  { value: "9:16", label: "9:16 — Portrait / Stories" },
  { value: "1:1", label: "1:1 — Square" },
  { value: "4:5", label: "4:5 — Portrait" },
  { value: "4:3", label: "4:3 — Classic" },
  { value: "3:4", label: "3:4 — Portrait Classic" },
  { value: "21:9", label: "21:9 — Ultrawide" },
];

export function ChecklistsClient({
  templates,
  taskStatuses,
}: {
  templates: Template[];
  taskStatuses: TaskStatus[];
}) {
  const [activeTabId, setActiveTabId] = useState<string | null>(templates[0]?.id ?? null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");

  const activeTemplate = templates.find((t) => t.id === activeTabId);

  const handleNameSave = async () => {
    setEditingName(false);
    if (activeTemplate && nameValue.trim() && nameValue.trim() !== activeTemplate.name) {
      await updateChecklistTemplate(activeTemplate.id, { name: nameValue.trim() });
    }
  };

  return (
    <div className="p-6">
      {/* Back nav */}
      <div className="flex items-center gap-3 mb-4">
        <Link
          href="/settings"
          className="w-icon-btn h-icon-btn rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
        >
          <ArrowLeft className="w-icon-sm h-icon-sm" />
        </Link>
        <p className="text-secondary text-muted-foreground">These questions apply to all projects. Changes here affect every project immediately.</p>
      </div>

      {/* Template tabs */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {templates.map((t) => {
          const isActive = activeTabId === t.id;
          const tc = t.color || "#3b82f6";
          return (
            <button
              key={t.id}
              onClick={() => { setActiveTabId(t.id); setEditingName(false); }}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-body font-medium transition-all border ${
                isActive
                  ? "border-opacity-40"
                  : "bg-muted/30 text-muted-foreground border-border hover:bg-muted/50 hover:text-foreground"
              }`}
              style={isActive ? { backgroundColor: `${tc}15`, color: tc, borderColor: `${tc}40` } : undefined}
            >
              {t.icon && <span className="text-body">{t.icon}</span>}
              {t.name}
              <span className="text-label" style={isActive ? { color: `${tc}80` } : undefined}>
                {t.items.length}
              </span>
            </button>
          );
        })}

        {showNewForm ? (
          <form
            action={async (formData) => {
              await createChecklistTemplate(formData);
              setShowNewForm(false);
            }}
            className="inline-flex items-center gap-2"
          >
            <input
              name="name"
              placeholder="Type name..."
              required
              autoFocus
              className="h-input px-3 rounded-xl bg-black border border-border text-body text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-ring transition-colors w-44"
            />
            <Button type="submit" size="sm">Create</Button>
            <button type="button" onClick={() => setShowNewForm(false)} className="text-muted-foreground hover:text-foreground">
              <X className="w-icon-md h-icon-md" />
            </button>
          </form>
        ) : (
          <button
            onClick={() => setShowNewForm(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-body font-medium text-muted-foreground border border-dashed border-border hover:bg-muted/30 hover:text-foreground transition-colors"
          >
            <Plus className="w-icon-sm h-icon-sm" />
          </button>
        )}
      </div>

      {/* Active template content */}
      {activeTemplate ? (
        <div>
          {/* Template header with name edit + icon/color + delete */}
          <div className="flex items-center gap-3 mb-4">
            {editingName ? (
              <input
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onBlur={handleNameSave}
                onKeyDown={(e) => { if (e.key === "Enter") handleNameSave(); if (e.key === "Escape") setEditingName(false); }}
                autoFocus
                className="text-body font-medium text-foreground bg-black border border-border rounded-lg px-2 py-1 focus:outline-none focus:border-ring transition-colors"
              />
            ) : (
              <button
                onClick={() => { setNameValue(activeTemplate.name); setEditingName(true); }}
                className="text-secondary text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <Pencil className="w-icon-sm h-icon-sm" /> Rename
              </button>
            )}
            <div className="flex-1" />
            <form action={async () => {
              if (confirm("Delete this template and all its items?")) {
                await deleteChecklistTemplate(activeTemplate.id);
                setActiveTabId(templates.filter((t) => t.id !== activeTemplate.id)[0]?.id ?? null);
              }
            }}>
              <button type="submit" className="text-secondary text-muted-foreground hover:text-destructive flex items-center gap-1">
                <Trash2 className="w-icon-sm h-icon-sm" /> Delete type
              </button>
            </form>
          </div>

          {/* Icon & Color */}
          <TemplateAppearance template={activeTemplate} />

          {/* Question list grouped by phase */}
          {(["create", "delivery"] as const).map((phase) => {
            const phaseItems = activeTemplate.items.filter((i) => (i.phase || "create") === phase);
            let counter = phase === "create"
              ? 0
              : activeTemplate.items.filter((i) => (i.phase || "create") === "create").length;
            return (
              <div key={phase} className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <h3 className={`text-secondary font-semibold uppercase tracking-wider ${
                    phase === "create" ? "text-primary" : "text-amber-400"
                  }`}>
                    {phase === "create" ? "Create" : "Delivery"}
                  </h3>
                  <div className="flex-1 border-t border-border" />
                  <span className="text-label text-muted-foreground/50">{phaseItems.length} fields</span>
                </div>
                <div className="space-y-2">
                  {phaseItems.map((item) => {
                    counter++;
                    return (
                      <QuestionRow key={item.id} item={item} index={counter} taskStatuses={taskStatuses} />
                    );
                  })}
                  {phaseItems.length === 0 && (
                    <p className="text-secondary text-muted-foreground/40 py-3 text-center">No fields in this group yet</p>
                  )}
                </div>
              </div>
            );
          })}

          {/* Add question form */}
          <AddQuestionForm
            templateId={activeTemplate.id}
            taskStatuses={taskStatuses}
          />
        </div>
      ) : (
        <div className="text-center py-16 text-muted-foreground text-body">
          {templates.length === 0
            ? "No task types yet. Create one to get started."
            : "Select a type to manage its questions."}
        </div>
      )}
    </div>
  );
}

function TemplateAppearance({ template }: { template: Template }) {
  const [showIcons, setShowIcons] = useState(false);
  const [showColors, setShowColors] = useState(false);

  return (
    <div className="flex items-center gap-4 mb-6 p-3 rounded-xl bg-muted/20 border border-border">
      {/* Icon picker */}
      <div className="relative">
        <button
          onClick={() => { setShowIcons(!showIcons); setShowColors(false); }}
          className="w-10 h-10 rounded-xl border border-border bg-black flex items-center justify-center text-lg hover:border-primary/30 transition-colors"
          title="Choose icon"
        >
          {template.icon || "📁"}
        </button>
        {showIcons && (
          <div className="absolute top-12 left-0 z-20 p-2 rounded-xl bg-black border border-border shadow-xl grid grid-cols-8 gap-1 w-[280px]">
            {TEMPLATE_ICONS.map((icon) => (
              <button
                key={icon}
                onClick={async () => {
                  await updateChecklistTemplate(template.id, { icon });
                  setShowIcons(false);
                }}
                className={`w-icon-btn h-icon-btn rounded-lg flex items-center justify-center text-subheading hover:bg-muted transition-colors ${
                  template.icon === icon ? "bg-primary/15 ring-1 ring-primary/30" : ""
                }`}
              >
                {icon}
              </button>
            ))}
            {template.icon && (
              <button
                onClick={async () => {
                  await updateChecklistTemplate(template.id, { icon: null });
                  setShowIcons(false);
                }}
                className="w-icon-btn h-icon-btn rounded-lg flex items-center justify-center text-label text-muted-foreground hover:bg-muted transition-colors col-span-8 mt-1 border-t border-border pt-1"
              >
                Remove icon
              </button>
            )}
          </div>
        )}
      </div>

      {/* Color picker */}
      <div className="relative">
        <label className="text-label font-medium text-muted-foreground uppercase tracking-wider block mb-1">Color</label>
        <div className="flex items-center gap-1">
          {TEMPLATE_COLORS.map((c) => (
            <button
              key={c}
              onClick={async () => {
                await updateChecklistTemplate(template.id, { color: c });
              }}
              className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                template.color === c ? "border-white scale-110" : "border-transparent"
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      {/* Preview */}
      <div className="flex-1 flex items-center justify-end">
        <span
          className="inline-flex items-center gap-1.5 text-secondary font-medium rounded-md px-2 py-1 border"
          style={{
            color: template.color || "#22d3ee",
            backgroundColor: `${template.color || "#22d3ee"}10`,
            borderColor: `${template.color || "#22d3ee"}30`,
          }}
        >
          {template.icon && <span>{template.icon}</span>}
          {template.name}
        </span>
      </div>
    </div>
  );
}

function QuestionRow({
  item,
  index,
  taskStatuses,
}: {
  item: TemplateItem;
  index: number;
  taskStatuses: TaskStatus[];
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <EditQuestionForm
        item={item}
        taskStatuses={taskStatuses}
        onClose={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:bg-card/80 transition-colors group">
      <GripVertical className="w-icon-sm h-icon-sm text-muted-foreground/30 shrink-0 cursor-grab" />
      <span className="text-secondary text-muted-foreground/50 w-6">{index}.</span>
      <div className="flex-1 min-w-0">
        <span className="text-body text-foreground">{item.name}</span>
        {item.type === "select" && item.options && (
          <p className="text-label text-muted-foreground/50 mt-0.5 truncate">
            {JSON.parse(item.options).join(", ")}
          </p>
        )}
        {(() => {
          const hints: string[] = [];
          if (item.allowedFormats) {
            const fmts: string[] = JSON.parse(item.allowedFormats);
            if (fmts.length > 0) hints.push(fmts.map((f) => `.${f}`).join(", "));
          }
          if (item.aspectRatio) hints.push(item.aspectRatio);
          return hints.length > 0 ? (
            <p className="text-label text-muted-foreground/50 mt-0.5 truncate">{hints.join(" · ")}</p>
          ) : null;
        })()}
      </div>

      {(() => {
        const displayType = item.type === "file_upload" && item.allowedFileTypes
          ? item.allowedFileTypes
          : item.type;
        return (
          <span className="inline-flex items-center gap-1.5 text-label px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
            {FILE_TYPES.includes(displayType) && <FileTypeIcon category={displayType} />}
            {TYPE_LABELS[displayType] || displayType}
          </span>
        );
      })()}

      <span className={`text-label px-1.5 py-0.5 rounded font-medium ${
        item.mandatory
          ? "bg-red-500/15 text-red-400"
          : "bg-muted text-muted-foreground"
      }`}>
        {item.mandatory ? "Mandatory" : "Optional"}
      </span>

      {item.requiredBeforeStage && (
        <span className="text-label px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 font-medium">
          Before transition
        </span>
      )}

      <button
        onClick={() => setEditing(true)}
        className="w-icon-btn h-icon-btn rounded flex items-center justify-center text-muted-foreground/40 hover:text-foreground transition-colors opacity-100 [@media(pointer:fine)]:opacity-0 [@media(pointer:fine)]:group-hover:opacity-100"
      >
        <Pencil className="w-icon-sm h-icon-sm" />
      </button>
      <form action={deleteChecklistTemplateItem.bind(null, item.id)} onClick={(e) => e.stopPropagation()}>
        <button
          type="submit"
          className="w-icon-btn h-icon-btn rounded flex items-center justify-center text-muted-foreground/40 hover:text-destructive transition-colors opacity-100 [@media(pointer:fine)]:opacity-0 [@media(pointer:fine)]:group-hover:opacity-100"
        >
          <Trash2 className="w-icon-sm h-icon-sm" />
        </button>
      </form>
    </div>
  );
}

function EditQuestionForm({
  item,
  taskStatuses,
  onClose,
}: {
  item: TemplateItem;
  taskStatuses: TaskStatus[];
  onClose: () => void;
}) {
  const initialType = (() => {
    if (item.type !== "file_upload" || !item.allowedFileTypes) return item.type;
    const ft = item.allowedFileTypes.toLowerCase();
    if (["audio", "video", "image", "document"].includes(ft)) return ft;
    const audioExts = ["mp3", "wav", "ogg", "aac", "m4a", "flac"];
    const videoExts = ["mp4", "webm", "mov", "avi", "mkv"];
    const imageExts = ["jpg", "jpeg", "png", "gif", "webp", "svg"];
    if (audioExts.some((e) => ft.includes(e))) return "audio";
    if (videoExts.some((e) => ft.includes(e))) return "video";
    if (imageExts.some((e) => ft.includes(e))) return "image";
    return "document";
  })();
  const [name, setName] = useState(item.name);
  const [type, setType] = useState(initialType);
  const [phase, setPhase] = useState(item.phase || "create");
  const [mandatory, setMandatory] = useState(item.mandatory);
  const [gateId, setGateId] = useState(item.requiredBeforeStage?.id || "");
  const [visibleFromId, setVisibleFromId] = useState(item.visibleFromStage?.id || "");
  const [options, setOptions] = useState<string[]>(
    item.options ? JSON.parse(item.options) : []
  );
  const [allowedFormats, setAllowedFormats] = useState<string[]>(
    item.allowedFormats ? JSON.parse(item.allowedFormats) : []
  );
  const [aspectRatio, setAspectRatio] = useState(item.aspectRatio || "");
  const [saving, setSaving] = useState(false);

  const isFileType = FILE_TYPES.includes(type);
  const formatList = FORMAT_OPTIONS[type] || [];
  const showAspectRatio = HAS_ASPECT_RATIO.includes(type);

  const handleSave = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    await updateChecklistTemplateItem(item.id, {
      name: name.trim(),
      type: isFileType ? "file_upload" : type,
      allowedFileTypes: isFileType && type !== "file_upload" ? type : null,
      allowedFormats: formatList.length > 0 && allowedFormats.length > 0 ? JSON.stringify(allowedFormats) : null,
      aspectRatio: showAspectRatio && aspectRatio ? aspectRatio : null,
      visibleFromStageId: visibleFromId || null,
      requiredBeforeStageId: gateId || null,
      mandatory,
      phase,
      options: type === "select" && options.length > 0 ? JSON.stringify(options) : null,
    });
    setSaving(false);
    onClose();
  };

  return (
    <div className="p-4 rounded-xl bg-muted/30 border border-primary/30 space-y-3">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Question text"
        required
        className="w-full h-input px-3 rounded-lg bg-black border border-border text-body text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-ring transition-colors"
        autoFocus
      />

      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[140px]">
          <label className="text-label font-medium text-muted-foreground uppercase tracking-wider block mb-1">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full h-input px-2 rounded-lg bg-black border border-border text-secondary text-foreground focus:outline-none focus:border-ring transition-colors"
          >
            <option value="text">Text</option>
            <option value="textarea">Text Area</option>
            <option value="select">Dropdown</option>
            <option value="audio">Audio</option>
            <option value="video">Video</option>
            <option value="image">Image</option>
            <option value="document">Document</option>
            <option value="link">Link</option>
            <option value="yes_no">Yes / No</option>
            <option value="checkbox">Checkbox</option>
            <option value="mention">Mention</option>
            <option value="copyright">Copyright</option>
          </select>
        </div>

        <div className="flex-1 min-w-[140px]">
          <label className="text-label font-medium text-muted-foreground uppercase tracking-wider block mb-1">Visible From</label>
          <select
            value={visibleFromId}
            onChange={(e) => setVisibleFromId(e.target.value)}
            className="w-full h-input px-2 rounded-lg bg-black border border-border text-secondary text-foreground focus:outline-none focus:border-ring transition-colors"
          >
            <option value="">Always</option>
            {taskStatuses.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div className="flex-1 min-w-[140px]">
          <label className="text-label font-medium text-muted-foreground uppercase tracking-wider block mb-1">Required Before</label>
          <select
            value={gateId}
            onChange={(e) => setGateId(e.target.value)}
            className="w-full h-input px-2 rounded-lg bg-black border border-border text-secondary text-foreground focus:outline-none focus:border-ring transition-colors"
          >
            <option value="">No gate</option>
            {taskStatuses.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      {formatList.length > 0 && (
        <div>
          <label className="text-label font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">Allowed Formats</label>
          <div className="flex flex-wrap gap-1.5">
            {formatList.map((fmt) => {
              const selected = allowedFormats.includes(fmt);
              return (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => setAllowedFormats(selected ? allowedFormats.filter((f) => f !== fmt) : [...allowedFormats, fmt])}
                  className={`px-2.5 py-1 rounded-lg text-secondary font-medium border transition-colors ${
                    selected
                      ? "bg-primary/15 text-primary border-primary/30"
                      : "bg-black text-muted-foreground border-border hover:text-foreground hover:border-border/80"
                  }`}
                >
                  .{fmt}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setAllowedFormats(allowedFormats.length === formatList.length ? [] : [...formatList])}
              className="px-2.5 py-1 rounded-lg text-label font-medium text-muted-foreground/60 hover:text-foreground border border-dashed border-border transition-colors"
            >
              {allowedFormats.length === formatList.length ? "Clear all" : "Select all"}
            </button>
          </div>
          {allowedFormats.length === 0 && (
            <p className="text-label text-muted-foreground/40 mt-1">No restriction — all {type} formats accepted</p>
          )}
        </div>
      )}

      {showAspectRatio && (
        <div>
          <label className="text-label font-medium text-muted-foreground uppercase tracking-wider block mb-1">Aspect Ratio</label>
          <select
            value={aspectRatio}
            onChange={(e) => setAspectRatio(e.target.value)}
            className="w-full h-input px-2 rounded-lg bg-black border border-border text-secondary text-foreground focus:outline-none focus:border-ring transition-colors"
          >
            <option value="">Any</option>
            {ASPECT_RATIOS.map((ar) => (
              <option key={ar.value} value={ar.value}>{ar.label}</option>
            ))}
          </select>
        </div>
      )}

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-secondary text-foreground cursor-pointer">
          <input type="checkbox" checked={mandatory} onChange={(e) => setMandatory(e.target.checked)} className="rounded" />
          Mandatory
        </label>
        <div className="flex rounded-lg border border-border overflow-hidden">
          {(["create", "delivery"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPhase(p)}
              className={`px-3 py-1 text-secondary font-medium transition-colors ${
                phase === p
                  ? p === "create" ? "bg-primary/15 text-primary" : "bg-amber-500/15 text-amber-400"
                  : "bg-black text-muted-foreground hover:text-foreground"
              }`}
            >
              {p === "create" ? "Create" : "Delivery"}
            </button>
          ))}
        </div>
      </div>

      {type === "select" && (
        <OptionsEditor options={options} onChange={setOptions} />
      )}

      <div className="flex items-center gap-2 justify-end">
        <button type="button" onClick={onClose} className="text-secondary text-muted-foreground hover:text-foreground px-3 py-1.5">
          Cancel
        </button>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}

function AddQuestionForm({
  templateId,
  taskStatuses,
}: {
  templateId: string;
  taskStatuses: TaskStatus[];
}) {
  const [type, setType] = useState("text");
  const [phase, setPhase] = useState("create");
  const [mandatory, setMandatory] = useState(false);
  const [gateId, setGateId] = useState("");
  const [options, setOptions] = useState<string[]>([]);
  const [allowedFormats, setAllowedFormats] = useState<string[]>([]);
  const [aspectRatio, setAspectRatio] = useState("");

  const isFileType = FILE_TYPES.includes(type);
  const formatList = FORMAT_OPTIONS[type] || [];
  const showAspectRatio = HAS_ASPECT_RATIO.includes(type);

  return (
    <form
      action={async (formData) => {
        formData.set("type", isFileType ? "file_upload" : type);
        formData.set("allowedFileTypes", isFileType && type !== "file_upload" ? type : "");
        formData.set("mandatory", mandatory ? "true" : "false");
        formData.set("phase", phase);
        if (type === "select" && options.length > 0) {
          formData.set("options", JSON.stringify(options));
        }
        if (formatList.length > 0 && allowedFormats.length > 0) {
          formData.set("allowedFormats", JSON.stringify(allowedFormats));
        }
        if (showAspectRatio && aspectRatio) formData.set("aspectRatio", aspectRatio);
        await addChecklistTemplateItem(templateId, formData);
        setType("text");
        setPhase("create");
        setMandatory(false);
        setGateId("");
        setOptions([]);
        setAllowedFormats([]);
        setAspectRatio("");
      }}
      className="mt-4 p-4 rounded-xl border border-border bg-card space-y-3"
    >
      <div className="flex items-center gap-2">
        <input
          name="name"
          placeholder="Add a question..."
          required
          className="flex-1 h-input px-3 rounded-lg bg-black border border-border text-body text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-ring transition-colors"
        />
        <select
          name="type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="h-input px-2 rounded-lg bg-black border border-border text-secondary text-foreground focus:outline-none focus:border-ring transition-colors"
        >
          <option value="text">Text</option>
          <option value="textarea">Text Area</option>
          <option value="select">Dropdown</option>
          <option value="audio">Audio</option>
          <option value="video">Video</option>
          <option value="image">Image</option>
          <option value="document">Document</option>
          <option value="link">Link</option>
          <option value="yes_no">Yes / No</option>
          <option value="checkbox">Checkbox</option>
          <option value="mention">Mention</option>
          <option value="copyright">Copyright</option>
        </select>
        <div className="flex rounded-lg border border-border overflow-hidden">
          {(["create", "delivery"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPhase(p)}
              className={`px-3 min-h-touch text-secondary font-medium transition-colors ${
                phase === p
                  ? p === "create" ? "bg-primary/15 text-primary" : "bg-amber-500/15 text-amber-400"
                  : "bg-black text-muted-foreground hover:text-foreground"
              }`}
            >
              {p === "create" ? "Create" : "Delivery"}
            </button>
          ))}
        </div>
      </div>

      {type === "select" && (
        <OptionsEditor options={options} onChange={setOptions} />
      )}

      {formatList.length > 0 && (
        <div>
          <label className="text-label font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">Allowed Formats</label>
          <div className="flex flex-wrap gap-1.5">
            {formatList.map((fmt) => {
              const selected = allowedFormats.includes(fmt);
              return (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => setAllowedFormats(selected ? allowedFormats.filter((f) => f !== fmt) : [...allowedFormats, fmt])}
                  className={`px-2.5 py-1 rounded-lg text-secondary font-medium border transition-colors ${
                    selected
                      ? "bg-primary/15 text-primary border-primary/30"
                      : "bg-black text-muted-foreground border-border hover:text-foreground hover:border-border/80"
                  }`}
                >
                  .{fmt}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setAllowedFormats(allowedFormats.length === formatList.length ? [] : [...formatList])}
              className="px-2.5 py-1 rounded-lg text-label font-medium text-muted-foreground/60 hover:text-foreground border border-dashed border-border transition-colors"
            >
              {allowedFormats.length === formatList.length ? "Clear all" : "Select all"}
            </button>
          </div>
          {allowedFormats.length === 0 && (
            <p className="text-label text-muted-foreground/40 mt-1">No restriction — all {type} formats accepted</p>
          )}
        </div>
      )}

      {showAspectRatio && (
        <div>
          <label className="text-label font-medium text-muted-foreground uppercase tracking-wider block mb-1">Aspect Ratio</label>
          <select
            value={aspectRatio}
            onChange={(e) => setAspectRatio(e.target.value)}
            className="w-full h-input px-2 rounded-lg bg-black border border-border text-secondary text-foreground focus:outline-none focus:border-ring transition-colors"
          >
            <option value="">Any</option>
            {ASPECT_RATIOS.map((ar) => (
              <option key={ar.value} value={ar.value}>{ar.label}</option>
            ))}
          </select>
        </div>
      )}

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-secondary text-foreground cursor-pointer">
          <input type="checkbox" checked={mandatory} onChange={(e) => setMandatory(e.target.checked)} className="rounded" />
          Mandatory
        </label>
        <label className="flex items-center gap-2 text-secondary text-foreground cursor-pointer">
          <input type="checkbox" checked={!!gateId} onChange={(e) => setGateId(e.target.checked ? taskStatuses[1]?.id || "" : "")} className="rounded" />
          Required before transition
        </label>

        {gateId && (
          <select
            name="requiredBeforeStageId"
            value={gateId}
            onChange={(e) => setGateId(e.target.value)}
            className="h-input px-2 rounded-lg bg-black border border-border text-secondary text-foreground focus:outline-none focus:border-ring transition-colors"
          >
            {taskStatuses.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}

        <div className="flex-1" />
        <Button type="submit" size="sm" className="gap-1.5">
          <Plus className="w-icon-sm h-icon-sm" />
          Add Question
        </Button>
      </div>
    </form>
  );
}

function OptionsEditor({
  options,
  onChange,
}: {
  options: string[];
  onChange: (opts: string[]) => void;
}) {
  const [input, setInput] = useState("");

  const addOption = () => {
    if (input.trim() && !options.includes(input.trim())) {
      onChange([...options, input.trim()]);
      setInput("");
    }
  };

  return (
    <div>
      <label className="text-label font-medium text-muted-foreground uppercase tracking-wider block mb-1">Dropdown Options</label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {options.map((opt, i) => (
          <span key={i} className="inline-flex items-center gap-1 text-secondary bg-muted px-2 py-0.5 rounded-lg text-foreground">
            {opt}
            <button type="button" onClick={() => onChange(options.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-foreground">
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOption(); } }}
          placeholder="Add option..."
          className="flex-1 h-input px-3 rounded-lg bg-black border border-border text-secondary text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-ring transition-colors"
        />
        <button type="button" onClick={addOption} className="text-secondary text-primary hover:text-primary/80 px-2">
          Add
        </button>
      </div>
    </div>
  );
}

function FileTypeIcon({ category }: { category: string }) {
  const cat = category.trim().toLowerCase();
  if (cat === "audio") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-purple-400">
        {[3, 6, 9, 12, 15, 18, 21].map((x, i) => {
          const h = [6, 10, 14, 12, 16, 8, 4][i];
          return <rect key={x} x={x - 1} y={12 - h / 2} width="2" height={h} rx="1" fill="currentColor" />;
        })}
      </svg>
    );
  }
  if (cat === "video") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-blue-400">
        <rect x="2" y="5" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
        <path d="M16 10l5-3v10l-5-3V10z" fill="currentColor" opacity="0.6" />
      </svg>
    );
  }
  if (cat === "image") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-green-400">
        <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
        <circle cx="8.5" cy="8.5" r="2" fill="currentColor" opacity="0.5" />
        <path d="M3 16l5-4 3 3 4-3 6 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (cat === "document") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-amber-400">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="currentColor" strokeWidth="2" />
        <path d="M14 2v6h6" stroke="currentColor" strokeWidth="2" />
        <line x1="8" y1="13" x2="16" y2="13" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
        <line x1="8" y1="17" x2="13" y2="17" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
      </svg>
    );
  }
  return null;
}
