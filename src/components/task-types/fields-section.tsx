"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
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
  onMove,
}: {
  section: Section;
  title: string;
  fields: TTField[];
  statuses: StatusOpt[];
  onAdd: (section: Section, patch: FieldPatch) => void;
  onUpdate: (fieldId: string, patch: FieldPatch) => void;
  onDelete: (fieldId: string) => void;
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
                    onDelete(f.id);
                    setEditingId(null);
                  }}
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
    </section>
  );
}
