"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  addChecklistTemplateItem,
  createChecklistSection,
  deleteChecklistTemplateItem,
  reorderChecklistItems,
  reorderChecklistSections,
  setChecklistTemplateItemHidden,
  updateChecklistTemplate,
  updateChecklistTemplateItem,
} from "@/actions/settings";
import type {
  FieldPatch,
  StatusOpt,
  TaskTypeVM,
  TitleLockPatch,
} from "./types";
import { FieldsSection } from "./fields-section";

function buildAddFormData(sectionId: string, patch: FieldPatch): FormData {
  const fd = new FormData();
  fd.set("name", patch.label ?? "New field");
  fd.set("type", patch.kind ?? "text");
  fd.set("sectionId", sectionId);
  fd.set("mandatory", patch.mandatory ? "true" : "false");
  if (patch.options && patch.options.length)
    fd.set("options", JSON.stringify(patch.options));
  if (patch.allowedFormats && patch.allowedFormats.length)
    fd.set("allowedFormats", JSON.stringify(patch.allowedFormats));
  if (patch.allowedFileTypes) fd.set("allowedFileTypes", patch.allowedFileTypes);
  if (patch.aspectRatio) fd.set("aspectRatio", patch.aspectRatio);
  if (patch.visibleFromStageId)
    fd.set("visibleFromStageId", patch.visibleFromStageId);
  if (patch.requiredBeforeStageId)
    fd.set("requiredBeforeStageId", patch.requiredBeforeStageId);
  if (patch.lockedFromStageId)
    fd.set("lockedFromStageId", patch.lockedFromStageId);
  fd.set("neverLock", patch.neverLock ? "true" : "false");
  fd.set("publishCard", patch.publishCard ?? "hidden");
  if (patch.effortUnit) fd.set("effortUnit", patch.effortUnit);
  return fd;
}

function toUpdateData(patch: FieldPatch) {
  return {
    name: patch.label,
    type: patch.kind,
    mandatory: patch.mandatory,
    options:
      patch.options && patch.options.length
        ? JSON.stringify(patch.options)
        : null,
    allowedFormats:
      patch.allowedFormats && patch.allowedFormats.length
        ? JSON.stringify(patch.allowedFormats)
        : null,
    allowedFileTypes: patch.allowedFileTypes ?? null,
    aspectRatio: patch.aspectRatio ?? null,
    visibleFromStageId: patch.visibleFromStageId ?? null,
    requiredBeforeStageId: patch.requiredBeforeStageId ?? null,
    lockedFromStageId: patch.lockedFromStageId ?? null,
    neverLock: patch.neverLock ?? false,
    publishCard: patch.publishCard ?? "hidden",
    effortUnit: patch.effortUnit ?? null,
  };
}

export function TypeEditor({
  type,
  statuses,
}: {
  type: TaskTypeVM;
  statuses: StatusOpt[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(type.name);
  const [actionError, setActionError] = useState<string | null>(null);

  const run = (fn: () => Promise<unknown>): Promise<void> =>
    new Promise((resolve, reject) => {
      startTransition(async () => {
        try {
          setActionError(null);
          await fn();
          router.refresh();
          resolve();
        } catch (err) {
          const message = err instanceof Error ? err.message : "Save failed";
          setActionError(message);
          reject(new Error(message));
        }
      });
    });

  const saveName = () => {
    const v = name.trim();
    setRenaming(false);
    if (v && v !== type.name) run(() => updateChecklistTemplate(type.id, { name: v }));
  };

  const saveTitleLock = (patch: TitleLockPatch) =>
    run(() =>
      updateChecklistTemplate(type.id, {
        titleLockedFromStageId: patch.lockedFromStageId,
        titleNeverLock: patch.neverLock,
        titleLabel: patch.label?.trim() || null,
        titleHelp: patch.help?.trim() || null,
      }),
    );

  const addField = (sectionId: string, patch: FieldPatch) =>
    run(() => addChecklistTemplateItem(type.id, buildAddFormData(sectionId, patch)));

  const updateField = (fieldId: string, patch: FieldPatch) =>
    run(() => updateChecklistTemplateItem(fieldId, toUpdateData(patch)));

  const deleteField = (fieldId: string) =>
    run(() => deleteChecklistTemplateItem(fieldId));

  const toggleFieldHidden = (fieldId: string, hidden: boolean) =>
    run(() => setChecklistTemplateItemHidden(fieldId, hidden));

  const moveField = (
    fieldId: string,
    fromSectionId: string,
    toSectionId: string,
    toIndex: number,
  ) => {
    // Work on a local copy of every section's field list, splice the move,
    // then persist a single GLOBAL order across all sections so downstream
    // sorts (task page, publish card, effort) stay unambiguous.
    const lists = new Map(type.sections.map((s) => [s.id, [...s.fields]]));
    const src = lists.get(fromSectionId);
    const dst = lists.get(toSectionId);
    if (!src || !dst) return;
    const idx = src.findIndex((f) => f.id === fieldId);
    if (idx < 0) return;
    const [moved] = src.splice(idx, 1);
    let insertAt = toIndex;
    if (fromSectionId === toSectionId && idx < toIndex) insertAt = toIndex - 1;
    dst.splice(insertAt, 0, moved);

    let order = 0;
    const items = type.sections.flatMap((s) =>
      (lists.get(s.id) ?? []).map((f) => ({
        id: f.id,
        sectionId: s.id,
        order: order++,
      })),
    );
    run(() => reorderChecklistItems(type.id, items));
  };

  // New sections behave like Delivery (filled during work) — Requirements-like
  // behavior stays with the original section, keeping one clear place to fill
  // fields at creation.
  const addSection = (name: string) =>
    run(() => createChecklistSection(type.id, name, "delivery"));

  const moveSection = (sectionId: string, dir: -1 | 1) => {
    const ids = type.sections.map((s) => s.id);
    const i = ids.indexOf(sectionId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    run(() => reorderChecklistSections(type.id, ids));
  };

  return (
    <div className="space-y-6 border-t border-border/60 p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        {renaming ? (
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveName();
              if (e.key === "Escape") {
                setName(type.name);
                setRenaming(false);
              }
            }}
            className="h-10 max-w-sm"
          />
        ) : (
          <>
            <div className="text-lg font-semibold">{type.name}</div>
            <button
              type="button"
              onClick={() => setRenaming(true)}
              aria-label="Rename"
              className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>

      {actionError && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {actionError}
        </div>
      )}

      {type.sections.map((section, i) => (
        <FieldsSection
          key={section.id}
          section={section}
          statuses={statuses}
          // The built-in Title is pinned to the top of the first section.
          titleLock={
            i === 0
              ? {
                  lockedFromStageId: type.titleLockedFromStageId,
                  neverLock: type.titleNeverLock,
                  label: type.titleLabel,
                  help: type.titleHelp,
                }
              : undefined
          }
          onTitleLockSave={i === 0 ? saveTitleLock : undefined}
          onAdd={addField}
          onUpdate={updateField}
          onDelete={deleteField}
          onToggleHidden={toggleFieldHidden}
          onMove={moveField}
          onMoveUp={i > 0 ? () => moveSection(section.id, -1) : undefined}
          onMoveDown={
            i < type.sections.length - 1
              ? () => moveSection(section.id, 1)
              : undefined
          }
          onSectionChanged={() => router.refresh()}
        />
      ))}

      <AddSectionRow onAdd={addSection} />
    </div>
  );
}

// Inline "add section" flow: just a name, appended after the last section.
function AddSectionRow({ onAdd }: { onAdd: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border/70 py-3 text-xs text-muted-foreground transition-colors hover:border-border hover:bg-surface hover:text-foreground"
      >
        <Plus className="h-3.5 w-3.5" />
        Add section
      </button>
    );
  }

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setName("");
    setOpen(false);
  };

  return (
    <div className="space-y-3 rounded-lg border border-border/60 p-4">
      <div className="text-tiny font-medium uppercase tracking-[0.14em] text-muted-foreground">
        New section
      </div>
      <Input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder="Section name (e.g. Raw Assets)"
        className="h-10 max-w-sm"
      />
      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button size="sm" onClick={submit} disabled={!name.trim()}>
          Add section
        </Button>
      </div>
    </div>
  );
}
