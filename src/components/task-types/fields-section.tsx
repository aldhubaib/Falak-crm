"use client";

import { useState } from "react";
import { Eye, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getChecklistTemplateItemUsage } from "@/actions/settings";
import { cn } from "@/lib/utils";
import type { Section } from "./constants";
import type { FieldPatch, StatusOpt, TTField } from "./types";
import { FieldRow } from "./field-row";
import { FieldEditor } from "./field-editor";

export function FieldsSection({
  section,
  title,
  fields,
  statuses,
  onAdd,
  onUpdate,
  onDelete,
  onToggleHidden,
  onMove,
}: {
  section: Section;
  title: string;
  fields: TTField[];
  statuses: StatusOpt[];
  onAdd: (section: Section, patch: FieldPatch) => void;
  onUpdate: (fieldId: string, patch: FieldPatch) => void;
  onDelete: (fieldId: string) => void;
  onToggleHidden: (fieldId: string, hidden: boolean) => void;
  onMove: (
    fieldId: string,
    from: Section,
    to: Section,
    toIndex: number,
  ) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [over, setOver] = useState(false);
  // Delete guard: deleting checks usage first — fields with answers on tasks
  // can only be hidden (data preserved), empty ones need an explicit confirm.
  const [deleteTarget, setDeleteTarget] = useState<TTField | null>(null);
  const [usage, setUsage] = useState<number | null>(null);

  const requestDelete = (f: TTField) => {
    setDeleteTarget(f);
    setUsage(null);
    getChecklistTemplateItemUsage(f.id)
      .then((u) => setUsage(u.tasksWithData))
      .catch(() => setUsage(0));
  };

  const handleDropAt = (toIndex: number, e: React.DragEvent) => {
    const raw = e.dataTransfer.getData("application/x-field");
    if (!raw) return;
    try {
      const { id, section: from } = JSON.parse(raw) as {
        id: string;
        section: Section;
      };
      onMove(id, from, section, toIndex);
    } catch {
      /* ignore */
    }
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-tiny font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {title}
        </div>
        <div className="flex items-center gap-3">
          <div className="text-tiny text-muted-foreground">
            {fields.length} fields
          </div>
          {!adding && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              aria-label="Add field"
              className="grid h-6 w-6 place-items-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          handleDropAt(fields.length, e);
        }}
        className={cn(
          "overflow-hidden rounded-lg border border-border/60 transition-colors",
          over && "border-primary/60 bg-primary/5",
        )}
      >
        {adding && (
          <div className={cn(fields.length > 0 && "border-b border-border/40")}>
            <FieldEditor
              // Delivery fields default to showing on the publish card — they
              // are the deliverables the publisher needs.
              field={{ kind: "text", publishCard: section === "delivery" ? "expanded" : "hidden" }}
              statuses={statuses}
              onCancel={() => setAdding(false)}
              onSave={(patch) => {
                onAdd(section, patch);
                setAdding(false);
              }}
            />
          </div>
        )}

        {fields.map((f, i) => {
          const isEditing = editingId === f.id;
          return (
            <div
              key={f.id}
              className={cn(
                "border-b border-border/40 last:border-b-0",
                isEditing && "bg-background/40",
              )}
            >
              {isEditing ? (
                <FieldEditor
                  field={f}
                  statuses={statuses}
                  onCancel={() => setEditingId(null)}
                  onSave={(patch) => {
                    onUpdate(f.id, patch);
                    setEditingId(null);
                  }}
                  onDelete={() => {
                    requestDelete(f);
                    setEditingId(null);
                  }}
                  onToggleHidden={
                    f.hidden ? () => onToggleHidden(f.id, false) : undefined
                  }
                />
              ) : (
                <FieldRow
                  index={i}
                  field={f}
                  section={section}
                  onEdit={() => setEditingId(f.id)}
                  onDropAt={handleDropAt}
                />
              )}
            </div>
          );
        })}

        {fields.length === 0 && !adding && (
          <div className="p-6 text-center text-xs text-muted-foreground">
            {over ? "Drop here" : "No fields yet."}
          </div>
        )}
      </div>

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {usage === null
                ? `Delete "${deleteTarget?.label}"?`
                : usage > 0
                  ? `"${deleteTarget?.label}" can't be deleted`
                  : `Delete "${deleteTarget?.label}"?`}
            </DialogTitle>
            <DialogDescription>
              {usage === null ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="size-3.5 animate-spin" />
                  Checking if any tasks have data in this field…
                </span>
              ) : usage > 0 ? (
                <>
                  {usage} task{usage === 1 ? " has" : "s have"} data in this
                  field. You can hide it instead — it disappears from tasks and
                  cards, but the answers are kept and you can unhide it later.
                </>
              ) : (
                <>
                  No task has data in this field. It will be removed from the
                  task type and from all existing tasks. This can&apos;t be
                  undone.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            {usage !== null &&
              (usage > 0 ? (
                <Button
                  onClick={() => {
                    if (deleteTarget) onToggleHidden(deleteTarget.id, true);
                    setDeleteTarget(null);
                  }}
                >
                  <Eye className="mr-1.5 size-3.5" />
                  Hide field
                </Button>
              ) : (
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (deleteTarget) onDelete(deleteTarget.id);
                    setDeleteTarget(null);
                  }}
                >
                  Delete field
                </Button>
              ))}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
