"use client";

import { useState } from "react";
import { Check, Eye, Loader2, Lock, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { getChecklistTemplateItemUsage } from "@/actions/settings";
import { cn } from "@/lib/utils";
import type { Section } from "./constants";
import type { FieldPatch, StatusOpt, TitleLockPatch, TTField } from "./types";
import { FieldRow } from "./field-row";
import { FieldEditor } from "./field-editor";

export function FieldsSection({
  section,
  title,
  fields,
  statuses,
  titleLock,
  onTitleLockSave,
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
  /** Built-in Title lock rule — renders a pinned, non-deletable Title row. */
  titleLock?: TitleLockPatch;
  onTitleLockSave?: (patch: TitleLockPatch) => void;
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
        {titleLock && onTitleLockSave && (
          <div
            className={cn(
              (fields.length > 0 || adding) && "border-b border-border/40",
            )}
          >
            <TitleLockRow
              lock={titleLock}
              statuses={statuses}
              onSave={onTitleLockSave}
            />
          </div>
        )}

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

/**
 * Pinned row for the built-in task Title. It can't be deleted, hidden, or
 * reordered — every task has a title — but its lock stage is configurable
 * with the same semantics as regular fields (Auto = locks after Todo), and
 * its label + helper text can be renamed to fit the task type. Rendering
 * only: tasks still store a plain title.
 */
function TitleLockRow({
  lock,
  statuses,
  onSave,
}: {
  lock: TitleLockPatch;
  statuses: StatusOpt[];
  onSave: (patch: TitleLockPatch) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<TitleLockPatch>(lock);

  const displayLabel = lock.label?.trim() || "Title";
  const lockLabel = lock.neverLock
    ? "Never locks"
    : lock.lockedFromStageId
      ? `Locks from ${statuses.find((s) => s.id === lock.lockedFromStageId)?.name ?? "a removed stage"}`
      : "Locks after Todo";

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(lock);
          setEditing(true);
        }}
        aria-label="Edit title field"
        className="group flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-background/40"
      >
        <span className="grid h-6 w-4 shrink-0 place-items-center text-muted-foreground/40">
          <Lock className="h-3.5 w-3.5" />
        </span>
        <span className="w-5 shrink-0 text-xs text-muted-foreground">•</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm">{displayLabel}</div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">
            Built-in title · {lockLabel}
          </div>
        </div>
      </button>
    );
  }

  const dirty =
    draft.neverLock !== lock.neverLock ||
    draft.lockedFromStageId !== lock.lockedFromStageId ||
    (draft.label?.trim() || "") !== (lock.label?.trim() || "") ||
    (draft.help?.trim() || "") !== (lock.help?.trim() || "");

  return (
    <div className="space-y-4 bg-background/40 p-4">
      <div className="text-sm font-medium">Title field</div>
      <p className="text-xs text-muted-foreground">
        The task title is built in — it can&apos;t be deleted or hidden, and
        tasks always store it as the title. You can rename how it appears on
        the task form and choose the stage from which it becomes read-only.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <div className="mb-1 text-xxs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Label
          </div>
          <Input
            value={draft.label ?? ""}
            onChange={(e) => setDraft({ ...draft, label: e.target.value })}
            placeholder="Task Title"
            className="h-10"
          />
        </div>
        <div>
          <div className="mb-1 text-xxs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Locked From
          </div>
          <SearchableSelect
            value={
              draft.neverLock ? "never" : (draft.lockedFromStageId ?? "auto")
            }
            onValueChange={(v) =>
              setDraft(
                v === "never"
                  ? { ...draft, neverLock: true, lockedFromStageId: null }
                  : v === "auto"
                    ? { ...draft, neverLock: false, lockedFromStageId: null }
                    : { ...draft, neverLock: false, lockedFromStageId: v },
              )
            }
            searchPlaceholder="Search stages…"
            className="h-10"
            options={[
              { value: "auto", label: "Auto (after Todo)" },
              { value: "never", label: "Never" },
              ...statuses.map((s) => ({ value: s.id, label: s.name })),
            ]}
          />
        </div>
      </div>
      <div>
        <div className="mb-1 text-xxs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Helper Text
        </div>
        <Input
          value={draft.help ?? ""}
          onChange={(e) => setDraft({ ...draft, help: e.target.value })}
          placeholder="A short, clear summary of what needs to be done."
          className="h-10"
        />
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setEditing(false)}
          aria-label="Cancel"
        >
          <X className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          onClick={() => {
            onSave(draft);
            setEditing(false);
          }}
          disabled={!dirty}
          aria-label="Save"
        >
          <Check className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
