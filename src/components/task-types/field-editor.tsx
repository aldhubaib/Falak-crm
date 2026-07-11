"use client";

import { useMemo, useState } from "react";
import { Check, Eye, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { cn } from "@/lib/utils";
import { normalizeFormats } from "@/lib/formats";
import {
  ASPECTS,
  FILE_CATEGORIES,
  FORMATS,
  KIND_LABELS,
  KINDS,
  MEASURED_UNIT_OPTION_LABELS,
  isFileKind,
  measuredUnitFor,
} from "./constants";
import type { FieldPatch, StatusOpt, TTField } from "./types";

type Draft = {
  label: string;
  kind: string;
  mandatory: boolean;
  // Raw textarea content — parsed into the options array only on save, so
  // typing Enter (a trailing empty line) isn't filtered away mid-edit.
  optionsText: string;
  allowedFormats: string[];
  allowedFileTypes: string | null;
  aspectRatio: string | null;
  visibleFromStageId: string | null;
  requiredBeforeStageId: string | null;
  lockedFromStageId: string | null;
  neverLock: boolean;
  publishCard: string;
  effortUnit: string;
  // Raw input text so partial numbers ("1.") survive while typing.
  qtyPerVideoMinuteText: string;
};

function toDraft(f: Partial<TTField>): Draft {
  return {
    label: f.label ?? "",
    kind: f.kind ?? "text",
    mandatory: !!f.mandatory,
    optionsText: (f.options ?? []).join("\n"),
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
    publishCard: f.publishCard ?? "hidden",
    effortUnit: f.effortUnit ?? "",
    qtyPerVideoMinuteText:
      f.qtyPerVideoMinute != null ? String(f.qtyPerVideoMinute) : "",
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
  onToggleHidden,
}: {
  field: Partial<TTField>;
  statuses: StatusOpt[];
  onCancel: () => void;
  onSave: (patch: FieldPatch) => void;
  onDelete?: () => void;
  /** Present only for hidden fields — restores (unhides) the field. */
  onToggleHidden?: () => void;
}) {
  const initial = useMemo(() => toDraft(field), [field]);
  const [draft, setDraft] = useState<Draft>(initial);

  const isFile = isFileKind(draft.kind);
  const measuredUnit = measuredUnitFor(draft.kind, draft.allowedFileTypes);
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
          <SearchableSelect
            value={draft.kind}
            onValueChange={(v) => {
              const patch: Partial<Draft> = { kind: v };
              if (!isFileKind(v)) {
                patch.allowedFormats = [];
                patch.allowedFileTypes = null;
                patch.aspectRatio = null;
              }
              if (v !== "select") patch.optionsText = "";
              // Effort follows the field type: a measured unit that no longer
              // matches falls back to what the new type supports.
              const nextMeasured = measuredUnitFor(
                v,
                isFileKind(v) ? draft.allowedFileTypes : null,
              );
              if (
                draft.effortUnit &&
                draft.effortUnit !== "fixed" &&
                draft.effortUnit !== nextMeasured
              ) {
                patch.effortUnit = nextMeasured ?? "fixed";
                if (nextMeasured !== "words") patch.qtyPerVideoMinuteText = "";
              }
              setField(patch);
            }}
            searchPlaceholder="Search types…"
            className="h-10"
            options={KINDS.map((k) => ({ value: k, label: KIND_LABELS[k] }))}
          />
        </LabeledField>
        <LabeledField label="Visible From">
          <SearchableSelect
            value={draft.visibleFromStageId ?? "always"}
            onValueChange={(v) =>
              setField({ visibleFromStageId: v === "always" ? null : v })
            }
            searchPlaceholder="Search stages…"
            className="h-10"
            options={[
              { value: "always", label: "Always" },
              ...statuses.map((s) => ({ value: s.id, label: s.name })),
            ]}
          />
          {field.phase === "delivery" && (
            <p className="mt-1 text-xxs leading-relaxed text-muted-foreground">
              Applies to open tasks only. Delivery-section fields (like this one)
              are filled during work — they don&apos;t appear on the new-task form.
            </p>
          )}
        </LabeledField>
        <LabeledField label="Required Before">
          <SearchableSelect
            value={draft.requiredBeforeStageId ?? "no_gate"}
            onValueChange={(v) =>
              setField({ requiredBeforeStageId: v === "no_gate" ? null : v })
            }
            searchPlaceholder="Search stages…"
            className="h-10"
            options={[
              { value: "no_gate", label: "Never" },
              ...statuses.map((s) => ({ value: s.id, label: s.name })),
            ]}
          />
        </LabeledField>
        <LabeledField label="Locked From">
          <SearchableSelect
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
            searchPlaceholder="Search stages…"
            className="h-10"
            options={[
              { value: "auto", label: "Auto" },
              { value: "never", label: "Never" },
              ...statuses.map((s) => ({ value: s.id, label: s.name })),
            ]}
          />
        </LabeledField>
      </div>

      {draft.kind === "select" && (
        <LabeledField label="Options (one per line)">
          <textarea
            value={draft.optionsText}
            onChange={(e) => setField({ optionsText: e.target.value })}
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
                  onClick={() => {
                    const patch: Partial<Draft> = {
                      allowedFileTypes: c.value || null,
                      allowedFormats: [],
                      aspectRatio: null,
                    };
                    const nextMeasured = measuredUnitFor(
                      draft.kind,
                      c.value || null,
                    );
                    if (
                      draft.effortUnit &&
                      draft.effortUnit !== "fixed" &&
                      draft.effortUnit !== nextMeasured
                    ) {
                      patch.effortUnit = nextMeasured ?? "fixed";
                      patch.qtyPerVideoMinuteText = "";
                    }
                    setField(patch);
                  }}
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

      <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <LabeledField label="Effort">
          <SearchableSelect
            value={draft.effortUnit || "none"}
            onValueChange={(v) => {
              const unit = v === "none" ? "" : v;
              setField({
                effortUnit: unit,
                ...(unit === "words" ? {} : { qtyPerVideoMinuteText: "" }),
              });
            }}
            searchPlaceholder="Search…"
            className="h-10"
            options={[
              { value: "none", label: "Not counted" },
              // The measured option follows the field itself: text → words,
              // audio file → audio length, video file → video length.
              ...(measuredUnit
                ? [
                    {
                      value: measuredUnit,
                      label: MEASURED_UNIT_OPTION_LABELS[measuredUnit],
                    },
                  ]
                : []),
              {
                value: "fixed",
                label:
                  draft.kind === "multi_file"
                    ? "Fixed cost (per file)"
                    : "Fixed cost (per item)",
              },
            ]}
          />
        </LabeledField>
        {draft.effortUnit === "words" && (
          <LabeledField label="Expected Words per Video Minute">
            <Input
              type="number"
              min={0}
              step="any"
              value={draft.qtyPerVideoMinuteText}
              onChange={(e) => setField({ qtyPerVideoMinuteText: e.target.value })}
              placeholder="e.g. 206"
              className="h-10"
            />
            <div className="mt-1 text-xxs text-muted-foreground">
              Only for predictions before the text is written: a 2-min planned
              video expects 2 × this many words.
            </div>
          </LabeledField>
        )}
        {(draft.effortUnit === "audio_min" || draft.effortUnit === "video_min") && (
          <div className="pt-5 text-xxs text-muted-foreground sm:col-span-1 lg:col-span-2">
            {draft.kind === "multi_file"
              ? "Effort = combined upload length × the doer's title rate (min per video min). Before upload, a 2-minute video is assumed."
              : "Effort = uploaded file length × the doer's title rate (min per video min). Before upload, a 2-minute video is assumed."}
          </div>
        )}
        {draft.effortUnit === "fixed" && (
          <div className="pt-5 text-xxs text-muted-foreground sm:col-span-1 lg:col-span-2">
            {draft.kind === "multi_file"
              ? "Charged once per uploaded file — the minutes per file are set per title in Settings → Titles."
              : "Same effort every time, regardless of content — the minutes are set per title in Settings → Titles."}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={draft.mandatory}
              onCheckedChange={(v) => setField({ mandatory: !!v })}
            />
            Mandatory
          </label>
          <div
            className="flex items-center gap-2 text-sm"
            title="Where this field's value appears on the publish calendar card: hidden, only when the card is opened, or always (below the title even when collapsed)"
          >
            Publish card
            <SearchableSelect
              value={draft.publishCard}
              onValueChange={(v) => setField({ publishCard: v })}
              searchPlaceholder="Search…"
              className="h-8 w-36"
              contentClassName="w-44 min-w-44"
              options={[
                { value: "hidden", label: "Hidden" },
                { value: "expanded", label: "When expanded" },
                { value: "always", label: "Always visible" },
              ]}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onToggleHidden && (
            <Button
              variant="outline"
              size="sm"
              onClick={onToggleHidden}
              title="This field is hidden — restore it on all tasks"
            >
              <Eye className="mr-1.5 h-3.5 w-3.5" />
              Unhide
            </Button>
          )}
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
                options: draft.optionsText
                  .split("\n")
                  .map((o) => o.trim())
                  .filter(Boolean),
                allowedFormats: normalizeFormats(draft.allowedFormats),
                allowedFileTypes: draft.allowedFileTypes,
                aspectRatio: draft.aspectRatio,
                visibleFromStageId: draft.visibleFromStageId,
                requiredBeforeStageId: draft.requiredBeforeStageId,
                lockedFromStageId: draft.lockedFromStageId,
                neverLock: draft.neverLock,
                publishCard: draft.publishCard,
                effortUnit: draft.effortUnit || null,
                // Only words need a prediction ratio; audio/video predict 1:1
                // from the planned video length, fixed is always quantity 1.
                qtyPerVideoMinute:
                  draft.effortUnit === "words" &&
                  Number.parseFloat(draft.qtyPerVideoMinuteText) > 0
                    ? Number.parseFloat(draft.qtyPerVideoMinuteText)
                    : null,
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
