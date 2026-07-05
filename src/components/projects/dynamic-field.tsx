"use client";

import { useEffect, useRef, useState } from "react";
import {
  Mic,
  Video as VideoIcon,
  Image as ImageIcon,
  FileText,
  Paperclip,
  CircleCheck,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { dotExt, normalizeFormats } from "@/lib/formats";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type CreateField = {
  id: string;
  name: string;
  type: string;
  mandatory: boolean;
  options: string[];
  allowedFileTypes: string | null;
  allowedFormats: string[];
  aspectRatio: string | null;
};

export type FieldAnswer =
  | { kind: "text"; value: string }
  | { kind: "yesno"; value: "yes" | "no" | null; text?: string; file?: File | null }
  | { kind: "file"; file: File | null };

const YESNO_KINDS = new Set(["yes_no", "mention", "copyright", "checkbox"]);

export function isFileField(type: string) {
  return type === "file_upload";
}
export function isYesNoField(type: string) {
  return YESNO_KINDS.has(type);
}

export function isFieldFilled(
  field: CreateField,
  answer: FieldAnswer | undefined,
): boolean {
  if (!answer) return false;
  if (isFileField(field.type)) {
    return answer.kind === "file" && answer.file !== null;
  }
  if (isYesNoField(field.type)) {
    if (answer.kind !== "yesno" || answer.value === null) return false;
    if (answer.value === "yes") {
      const followUp = yesFollowUp(field.type);
      if (followUp?.text && !(answer.text ?? "").trim()) return false;
    }
    return true;
  }
  return answer.kind === "text" && answer.value.trim().length > 0;
}

// Follow-up inputs revealed when a Yes/No field is answered "Yes". Mention asks
// for an account name; Copyright asks for the copyright text plus an optional
// file. Other yes/no kinds have no follow-up.
export function yesFollowUp(
  type: string,
): { text?: { placeholder: string }; file?: { accept: string } } | null {
  if (type === "mention")
    return { text: { placeholder: "Enter account name (e.g. @username)" } };
  if (type === "copyright")
    return {
      text: { placeholder: "Enter copyright text" },
      file: { accept: "Any file" },
    };
  return null;
}

export type YesNoParsed = { value: "yes" | "no" | null; text: string };

// Yes/No answers are stored in the checklist item's textValue. Plain toggles use
// "yes"/"no"; follow-up answers use JSON so the value and text stay distinct.
export function parseYesNo(raw: string | null | undefined): YesNoParsed {
  if (!raw) return { value: null, text: "" };
  if (raw === "yes") return { value: "yes", text: "" };
  if (raw === "no") return { value: "no", text: "" };
  try {
    const o = JSON.parse(raw) as { v?: string; t?: string };
    if (o?.v === "yes" || o?.v === "no")
      return { value: o.v, text: o.t ?? "" };
  } catch {
    // not JSON — treat as a plain "yes" with text
  }
  return { value: "yes", text: raw };
}

export function serializeYesNo(
  value: "yes" | "no" | null,
  text: string,
): string {
  if (value === "yes")
    return text.trim() ? JSON.stringify({ v: "yes", t: text }) : "yes";
  if (value === "no") return "no";
  return "";
}

export function DynamicField({
  field,
  index,
  answer,
  onChange,
}: {
  field: CreateField;
  index: number;
  answer: FieldAnswer | undefined;
  onChange: (v: FieldAnswer) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-foreground">
        <span className="grid size-5 place-items-center rounded-md bg-surface text-tiny text-muted-foreground">
          {index}
        </span>
        {field.name}
        {field.mandatory && <span className="text-destructive">*</span>}
      </label>
      <FieldControl field={field} answer={answer} onChange={onChange} />
    </div>
  );
}

function FieldControl({
  field,
  answer,
  onChange,
}: {
  field: CreateField;
  answer: FieldAnswer | undefined;
  onChange: (v: FieldAnswer) => void;
}) {
  if (isFileField(field.type)) {
    return <FileDrop field={field} answer={answer} onChange={onChange} />;
  }

  if (isYesNoField(field.type)) {
    const cur =
      answer?.kind === "yesno"
        ? answer
        : { kind: "yesno" as const, value: null, text: "", file: null };
    const value = cur.value;
    const followUp = yesFollowUp(field.type);
    const setYesno = (
      patch: Partial<{
        value: "yes" | "no" | null;
        text: string;
        file: File | null;
      }>,
    ) =>
      onChange({
        kind: "yesno",
        value: patch.value !== undefined ? patch.value : cur.value,
        text: patch.text !== undefined ? patch.text : (cur.text ?? ""),
        file: patch.file !== undefined ? patch.file : (cur.file ?? null),
      });
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setYesno({ value: "yes" })}
            className={cn(
              "h-11 rounded-md border text-sm font-medium transition-colors",
              value === "yes"
                ? "border-green-500/60 bg-green-500/10 text-green-400"
                : "border-border/60 bg-surface text-muted-foreground hover:text-foreground",
            )}
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => setYesno({ value: "no", text: "", file: null })}
            className={cn(
              "h-11 rounded-md border text-sm font-medium transition-colors",
              value === "no"
                ? "border-destructive/60 bg-destructive/10 text-destructive"
                : "border-border/60 bg-surface text-muted-foreground hover:text-foreground",
            )}
          >
            No
          </button>
        </div>
        {value === "yes" && followUp?.text && (
          <Input
            placeholder={`${followUp.text.placeholder} *`}
            value={cur.text ?? ""}
            onChange={(e) => setYesno({ text: e.target.value })}
            className={cn(
              "h-11 rounded-xl border-border/60 bg-background/60",
              !cur.text?.trim() && "border-destructive/50",
            )}
          />
        )}
        {value === "yes" && followUp?.file && (
          <YesnoFileDrop
            accept={followUp.file.accept}
            file={cur.file ?? null}
            onChange={(f) => setYesno({ file: f })}
            required={!cur.file}
          />
        )}
      </div>
    );
  }

  if (field.type === "select") {
    const value = answer?.kind === "text" ? answer.value : "";
    return (
      <Select
        value={value || undefined}
        onValueChange={(v) => onChange({ kind: "text", value: v })}
      >
        <SelectTrigger className="h-11 rounded-xl border-border/60 bg-background/60">
          <SelectValue placeholder="Select an option…" />
        </SelectTrigger>
        <SelectContent>
          {field.options.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (field.type === "number") {
    const value = answer?.kind === "text" ? answer.value : "";
    return (
      <Input
        type="number"
        placeholder="Enter a number…"
        value={value}
        onChange={(e) => onChange({ kind: "text", value: e.target.value })}
        className="h-11 rounded-xl border-border/60 bg-background/60"
      />
    );
  }

  if (field.type === "textarea") {
    const value = answer?.kind === "text" ? answer.value : "";
    return (
      <Textarea
        placeholder="Type your answer…"
        value={value}
        onChange={(e) => onChange({ kind: "text", value: e.target.value })}
        className="min-h-20 rounded-xl border-border/60 bg-background/60"
      />
    );
  }

  // text, link, and any unknown kind → single-line input
  const value = answer?.kind === "text" ? answer.value : "";
  return (
    <Input
      placeholder={field.type === "link" ? "https://…" : "Type your answer…"}
      value={value}
      onChange={(e) => onChange({ kind: "text", value: e.target.value })}
      className="h-11 rounded-xl border-border/60 bg-background/60"
    />
  );
}

export function categoryIcon(category: string | null) {
  switch (category) {
    case "audio":
      return Mic;
    case "video":
      return VideoIcon;
    case "image":
      return ImageIcon;
    case "document":
      return FileText;
    default:
      return Paperclip;
  }
}

// Extensions are stored inconsistently across editors (some with a leading dot,
// some without). Normalize to a leading-dot form so `accept` and validation work
// regardless of how the field was saved. Re-exported from lib/formats for the
// existing import sites.
export { dotExt, normalizeFormats };

// Canonical extension set per file category. Used to enforce extensions even when
// a field only picks a category (audio/video/image/document) and no explicit
// formats. Union of the extensions offered by both field editors.
export const CATEGORY_EXTENSIONS: Record<string, string[]> = {
  audio: [".mp3", ".wav", ".ogg", ".aac", ".m4a", ".flac", ".wma"],
  video: [".mp4", ".mov", ".webm", ".mkv", ".avi", ".m4v"],
  image: [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".bmp", ".tiff"],
  document: [
    ".pdf", ".doc", ".docx", ".txt", ".rtf",
    ".ppt", ".pptx", ".xls", ".xlsx", ".csv",
  ],
};

// Effective allowed extensions for a file field: the explicitly chosen formats
// when present, otherwise the category's full extension set. Empty = no
// restriction (a generic file upload).
export function allowedExtsFor(
  category: string | null,
  formats: string[],
): string[] {
  const explicit = normalizeFormats(formats);
  if (explicit.length > 0) return explicit;
  if (category && CATEGORY_EXTENSIONS[category]) return CATEGORY_EXTENSIONS[category];
  return [];
}

export function validateFile(
  file: File,
  category: string | null,
  formats: string[],
): string | null {
  const ext = "." + (file.name.split(".").pop() ?? "").toLowerCase();
  const allowed = allowedExtsFor(category, formats);
  if (allowed.length > 0 && !allowed.includes(ext)) {
    return `File must be ${allowed.join(", ")}`;
  }
  return null;
}

// Measures an image/video's pixel dimensions in the browser. Resolves null
// when the file can't be decoded (we don't block those — the format check
// already ran).
function mediaDimensions(
  file: File,
): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const done = (dims: { width: number; height: number } | null) => {
      URL.revokeObjectURL(url);
      resolve(dims);
    };
    if (file.type.startsWith("image/")) {
      const img = new Image();
      img.onload = () =>
        done({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => done(null);
      img.src = url;
    } else if (file.type.startsWith("video/")) {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () =>
        done({ width: video.videoWidth, height: video.videoHeight });
      video.onerror = () => done(null);
      video.src = url;
    } else {
      done(null);
    }
  });
}

// Full client-side validation: extension/format check plus, when the field
// pins an aspect ratio, the actual pixel dimensions of the image/video.
// A 2% tolerance absorbs rounding (e.g. 1080×1920 vs 1082×1920 exports).
export async function validateFileFull(
  file: File,
  category: string | null,
  formats: string[],
  aspectRatio: string | null,
): Promise<string | null> {
  const formatError = validateFile(file, category, formats);
  if (formatError) return formatError;

  if (!aspectRatio) return null;
  const [w, h] = aspectRatio.split(":").map(Number);
  if (!w || !h) return null;

  const dims = await mediaDimensions(file);
  if (!dims || !dims.width || !dims.height) return null;

  const expected = w / h;
  const actual = dims.width / dims.height;
  if (Math.abs(actual - expected) / expected > 0.02) {
    return `File must be ${aspectRatio} — this file is ${dims.width}×${dims.height}`;
  }
  return null;
}

function FilePreview({ file }: { file: File }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  if (!url) return null;

  if (file.type.startsWith("image/")) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={file.name}
        className="mb-2 max-h-64 rounded"
      />
    );
  }

  if (file.type.startsWith("video/")) {
    return (
      <video
        controls
        src={url}
        className="mb-2 max-h-64 w-full max-w-md rounded"
      />
    );
  }

  if (file.type.startsWith("audio/")) {
    return (
      <audio controls src={url} className="mb-2 w-full max-w-md" />
    );
  }

  return null;
}

function YesnoFileDrop({
  accept,
  file,
  onChange,
  required,
}: {
  accept?: string;
  file: File | null;
  onChange: (f: File | null) => void;
  required?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  if (file) {
    return (
      <div className="rounded-xl border border-green-500/50 bg-green-500/5 px-3 py-2 text-sm">
        <FilePreview file={file} />
        <div className="flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-2 text-green-400">
            <Paperclip className="h-4 w-4 shrink-0" />
            <span className="truncate text-foreground">{file.name}</span>
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label="Remove file"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted/40 hover:text-foreground"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }
  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex w-full items-center gap-2 rounded-xl border border-dashed px-3 py-3 text-left text-sm text-muted-foreground transition-colors hover:border-border hover:bg-surface",
          required ? "border-destructive/50 bg-surface/40" : "border-border/70 bg-surface/40",
        )}
      >
        <Paperclip className="h-4 w-4" />
        <span>
          Attach file{required && <span className="ml-1 text-destructive">*</span>}
        </span>
        {accept && (
          <span className="ml-auto text-xs text-muted-foreground/70">{accept}</span>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          if (f) onChange(f);
          e.target.value = "";
        }}
      />
    </>
  );
}

function FileDrop({
  field,
  answer,
  onChange,
}: {
  field: CreateField;
  answer: FieldAnswer | undefined;
  onChange: (v: FieldAnswer) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const category = field.allowedFileTypes;
  const formats = normalizeFormats(field.allowedFormats);
  const Icon = categoryIcon(category);
  const label = category
    ? category.charAt(0).toUpperCase() + category.slice(1)
    : "File";
  const dropText = `Drop ${category ?? ""} file or click to attach`.replace(
    /\s+/g,
    " ",
  );
  const accepts = allowedExtsFor(category, field.allowedFormats);
  const accept = accepts.length > 0 ? accepts.join(",") : undefined;

  const file = answer?.kind === "file" ? answer.file : null;

  const handlePick = async (picked: File | null) => {
    if (!picked) return;
    const err = await validateFileFull(
      picked,
      category,
      formats,
      field.aspectRatio,
    );
    if (err) {
      setError(err);
      onChange({ kind: "file", file: null });
      return;
    }
    setError(null);
    onChange({ kind: "file", file: picked });
  };

  if (file) {
    return (
      <div className="rounded-xl border border-green-500/50 bg-green-500/5 p-4">
        <FilePreview file={file} />
        <div className="mt-2 flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <CircleCheck className="h-4 w-4 shrink-0 text-green-400" />
            <span className="truncate text-sm text-foreground">{file.name}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setError(null);
              onChange({ kind: "file", file: null });
              if (inputRef.current) inputRef.current.value = "";
            }}
            aria-label="Remove file"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted/40 hover:text-foreground"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-1 pl-6 text-tiny text-muted-foreground">
          Ready to upload — starts after the task is created.
        </div>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
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
        {(formats.length > 0 || field.aspectRatio) && (
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {formats.map((f) => (
              <span
                key={f}
                className="rounded-md bg-muted/40 px-2 py-0.5 text-tiny text-muted-foreground"
              >
                {f}
              </span>
            ))}
            {field.aspectRatio && (
              <span className="rounded-md bg-muted/40 px-2 py-0.5 text-tiny text-muted-foreground">
                {field.aspectRatio}
              </span>
            )}
          </div>
        )}
      </button>
      {error && <div className="mt-1.5 text-xs text-destructive">{error}</div>}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => handlePick(e.target.files?.[0] ?? null)}
      />
    </>
  );
}
