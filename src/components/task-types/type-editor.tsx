"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  addChecklistTemplateItem,
  deleteChecklistTemplateItem,
  reorderChecklistItems,
  setChecklistTemplateItemHidden,
  updateChecklistTemplate,
  updateChecklistTemplateItem,
} from "@/actions/settings";
import type { Section } from "./constants";
import type { FieldPatch, StatusOpt, TaskTypeVM } from "./types";
import { FieldsSection } from "./fields-section";

function buildAddFormData(section: Section, patch: FieldPatch): FormData {
  const fd = new FormData();
  fd.set("name", patch.label ?? "New field");
  fd.set("type", patch.kind ?? "text");
  fd.set("phase", section);
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

  const run = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      await fn();
      router.refresh();
    });

  const saveName = () => {
    const v = name.trim();
    setRenaming(false);
    if (v && v !== type.name) run(() => updateChecklistTemplate(type.id, { name: v }));
  };

  const addField = (section: Section, patch: FieldPatch) =>
    run(() => addChecklistTemplateItem(type.id, buildAddFormData(section, patch)));

  const updateField = (fieldId: string, patch: FieldPatch) =>
    run(() => updateChecklistTemplateItem(fieldId, toUpdateData(patch)));

  const deleteField = (fieldId: string) =>
    run(() => deleteChecklistTemplateItem(fieldId));

  const toggleFieldHidden = (fieldId: string, hidden: boolean) =>
    run(() => setChecklistTemplateItemHidden(fieldId, hidden));

  const moveField = (
    fieldId: string,
    from: Section,
    to: Section,
    toIndex: number,
  ) => {
    const req = [...type.requirementFields];
    const del = [...type.deliveryFields];
    const src = from === "create" ? req : del;
    const dst = to === "create" ? req : del;
    const idx = src.findIndex((f) => f.id === fieldId);
    if (idx < 0) return;
    const [moved] = src.splice(idx, 1);
    let insertAt = toIndex;
    if (from === to && idx < toIndex) insertAt = toIndex - 1;
    dst.splice(insertAt, 0, moved);

    const items = [
      ...req.map((f, i) => ({ id: f.id, phase: "create", order: i })),
      ...del.map((f, i) => ({ id: f.id, phase: "delivery", order: i })),
    ];
    run(() => reorderChecklistItems(type.id, items));
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

      <FieldsSection
        section="create"
        title="Requirements"
        fields={type.requirementFields}
        statuses={statuses}
        onAdd={addField}
        onUpdate={updateField}
        onDelete={deleteField}
        onToggleHidden={toggleFieldHidden}
        onMove={moveField}
      />
      <FieldsSection
        section="delivery"
        title="Delivery"
        fields={type.deliveryFields}
        statuses={statuses}
        onAdd={addField}
        onUpdate={updateField}
        onDelete={deleteField}
        onToggleHidden={toggleFieldHidden}
        onMove={moveField}
      />
    </div>
  );
}
