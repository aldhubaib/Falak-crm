"use client";

import { useState } from "react";
import { GripVertical, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { KIND_LABELS, type Section } from "./constants";
import type { TTField } from "./types";

export function FieldRow({
  index,
  field,
  section,
  onEdit,
  onDropAt,
}: {
  index: number;
  field: TTField;
  section: Section;
  onEdit: () => void;
  onDropAt: (toIndex: number, e: React.DragEvent) => void;
}) {
  const [over, setOver] = useState(false);
  const subline = [
    KIND_LABELS[field.kind] ?? field.kind,
    field.mandatory ? "Required" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData(
          "application/x-field",
          JSON.stringify({ id: field.id, section }),
        );
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setOver(false);
        onDropAt(index, e);
      }}
      onClick={onEdit}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onEdit()}
      aria-label={`Edit ${field.label}`}
      className={cn(
        "group flex w-full cursor-pointer items-center gap-3 p-3 text-left transition-colors hover:bg-background/40",
        over && "bg-primary/5",
      )}
    >
      <span
        aria-label="Drag to reorder"
        onClick={(e) => e.stopPropagation()}
        className="grid h-6 w-4 shrink-0 cursor-grab place-items-center text-muted-foreground/40 hover:text-muted-foreground active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </span>
      <span className="w-5 shrink-0 text-xs text-muted-foreground">{index + 1}.</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm">{field.label}</div>
        {subline && (
          <div className="mt-0.5 truncate text-xs text-muted-foreground">{subline}</div>
        )}
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onEdit();
        }}
        aria-label={`Edit ${field.label}`}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-muted/40 hover:text-foreground group-hover:opacity-100 focus:opacity-100"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
