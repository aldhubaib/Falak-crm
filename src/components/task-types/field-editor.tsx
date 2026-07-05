"use client";

import { useMemo, useState } from "react";
import { Check, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { normalizeFormats } from "@/lib/formats";
import { ASPECTS, FILE_CATEGORIES, FORMATS, KIND_LABELS, KINDS } from "./constants";
import type { FieldPatch, StatusOpt, TTField } from "./types";

type Draft = {
  label: string;
  kind: string;
  mandatory: boolean;
  options: string[];
  allowedFormats: string[];
  allowedFileTypes: string | null;
  aspectRatio: string | null;
  visibleFromStageId: string | null;
  requiredBeforeStageId: string | null;
  lockedFromStageId: string | null;
  neverLock: boolean;
};

function toDraft(f: Partial<TTField>): Draft {
  return {
    label: f.label ?? "",
    kind: f.kind ?? "text",
    mandatory: !!f.mandatory,
    options: f.options ?? [],
    // Normalize stored formats (".png"/"png"/dupes) so they match the dotted
    // FORMATS chips — otherwise saved picks render unselected and re-saving
    // stacks duplicates.
    allowedFormats: normalizeFormats(f.allowedFormats ?? []),
    allowedFileTypes: f.allowedFileTypes ?? null,
    aspectRatio: f.aspectRatio ?? null,
    visibleFromStageId: f.visibleFromStageId ?? null,
    requiredBeforeStageId: f.requiredBeforeStageId ?? null,
    lockedFromStageId: f.lockedFromStageId ?? null,
    neverLock: !!f.neverLock,
  };
}

function LabeledField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 text-xxs font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      {children}
    </div>
  );
}

export function FieldEditor({
  field,
  statuses,
  onCancel,
  onSave,
  onDelete,
}: {
  field: Partial<TTField>;
  statuses: StatusOpt[];
  onCancel: () => void;
  onSave: (patch: FieldPatch) => void;
  onDelete?: () => void;
}) {
  const initial = useMemo(() => toDraft(field), [field]);
  const [draft, setDraft] = useState<Draft>(initial);

  const isFile = draft.kind === "file_upload";
  const category = draft.allowedFileTypes ?? "";
  const formats = isFile && category in FORMATS ? FORMATS[category] : [];
  const supportsAspect = isFile && (category === "image" || category === "video");
  const allSelected = formats.length > 0 && formats.every((f) => draft.allowedFormats.includes(f));
  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(initial),
    [draft, initial],
  );

  const setField = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));

  const toggleFormat = (f: string) => {
    const current = draft.allowedFormats;
    setField({
      allowedFormats: current.includes(f)
        ? current.filter((x) => x !== f)
        : [...current, f],
    });
  };

  return (
    <div className="space-y-4 p-4">
      <Input
        autoFocus
        value={draft.label}
        onChange={(e) => setField({ label: e.target.value })}
        placeholder="Field name"
        className="h-10"
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <LabeledField label="Type">
          <Select
            value={draft.kind}
            onValueChange={(v) => {
              const patch: Partial<Draft> = { kind: v };
              if (v !== "file_upload") {
                patch.allowedFormats = [];
                patch.allowedFileTypes = null;
                patch.aspectRatio = null;
              }
              if (v !== "select") patch.options = [];
              setField(patch);
            }}
          >
            <SelectTrigger className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KINDS.map((k) => (
                <SelectItem key={k} value={k}>
                  {KIND_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </LabeledField>
        <LabeledField label="Visible From">
          <Select
            value={draft.visibleFromStageId ?? "always"}
            onValueChange={(v) =>
              setField({ visibleFromStageId: v === "always" ? null : v })
            }
          >
            <SelectTrigger className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="always">Always</SelectItem>
              {statuses.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </LabeledField>
        <LabeledField label="Required Before">
          <Select
            value={draft.requiredBeforeStageId ?? "no_gate"}
            onValueChange={(v) =>
              setField({ requiredBeforeStageId: v === "no_gate" ? null : v })
            }
          >
            <SelectTrigger className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="no_gate">No gate</SelectItem>
              {statuses.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </LabeledField>
        <LabeledField label="Locked From">
          <Select
            value={
              draft.neverLock ? "never" : (draft.lockedFromStageId ?? "auto")
            }
            onValueChange={(v) =>
              setField(
                v === "never"
                  ? { neverLock: true, lockedFromStageId: null }
                  : v === "auto"
                    ? { neverLock: false, lockedFromStageId: null }
                    : { neverLock: false, lockedFromStageId: v },
              )
            }
          >
            <SelectTrigger className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto</SelectItem>
              <SelectItem value="never">Never</SelectItem>
              {statuses.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </LabeledField>
      </div>

      {draft.kind === "select" && (
        <LabeledField label="Options (one per line)">
          <textarea
            value={draft.options.join("\n")}
            onChange={(e) =>
              setField({
                options: e.target.value
                  .split("\n")
                  .map((o) => o.trim())
                  .filter(Boolean),
              })
            }
            rows={3}
            placeholder={"Option A\nOption B"}
            className="w-full rounded-md border border-border/60 bg-background/60 px-3 py-2 text-sm outline-none focus-visible:border-ring"
          />
        </LabeledField>
      )}

      {isFile && (
        <LabeledField label="File Type">
          <div className="flex flex-wrap gap-1.5">
            {FILE_CATEGORIES.map((c) => {
              const active = category === c.value;
              return (
                <button
                  key={c.value || "any"}
                  type="button"
                  onClick={() =>
                    setField({
                      allowedFileTypes: c.value || null,
                      allowedFormats: [],
                      aspectRatio: null,
                    })
                  }
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs",
                    active
                      ? "bg-primary/20 text-primary"
                      : "bg-muted/30 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </LabeledField>
      )}

      {formats.length > 0 && (
        <LabeledField label="Allowed Formats">
          <div className="flex flex-wrap items-center gap-1.5">
            {formats.map((f) => {
              const active = draft.allowedFormats.includes(f);
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => toggleFormat(f)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs",
                    active
                      ? "bg-primary/20 text-primary"
                      : "bg-muted/30 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {f}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() =>
                setField({ allowedFormats: allSelected ? [] : [...formats] })
              }
              className="ml-1 text-xs text-muted-foreground hover:text-foreground"
            >
              {allSelected ? "Clear" : "Select all"}
            </button>
          </div>
        </LabeledField>
      )}

      {supportsAspect && (
        <LabeledField label="Aspect Ratio">
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setField({ aspectRatio: null })}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs",
                !draft.aspectRatio
                  ? "bg-primary/20 text-primary"
                  : "bg-muted/30 text-muted-foreground hover:text-foreground",
              )}
            >
              Any
            </button>
            {ASPECTS.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setField({ aspectRatio: a })}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs",
                  draft.aspectRatio === a
                    ? "bg-primary/20 text-primary"
                    : "bg-muted/30 text-muted-foreground hover:text-foreground",
                )}
              >
                {a}
              </button>
            ))}
          </div>
        </LabeledField>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={draft.mandatory}
            onCheckedChange={(v) => setField({ mandatory: !!v })}
          />
          Mandatory
        </label>
        <div className="flex items-center gap-2">
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Delete field"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={onCancel} aria-label="Cancel">
            <X className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            onClick={() =>
              onSave({
                label: draft.label,
                kind: draft.kind,
                mandatory: draft.mandatory,
                options: draft.options,
                allowedFormats: normalizeFormats(draft.allowedFormats),
                allowedFileTypes: draft.allowedFileTypes,
                aspectRatio: draft.aspectRatio,
                visibleFromStageId: draft.visibleFromStageId,
                requiredBeforeStageId: draft.requiredBeforeStageId,
                lockedFromStageId: draft.lockedFromStageId,
                neverLock: draft.neverLock,
              })
            }
            disabled={!draft.label.trim() || !dirty}
            aria-label="Save"
          >
            <Check className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
