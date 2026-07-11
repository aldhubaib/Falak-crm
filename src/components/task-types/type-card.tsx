"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck2, Layers, Pencil, Trash2, X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { updateChecklistTemplate } from "@/actions/settings";
import { cn } from "@/lib/utils";
import { TypeIcon, TYPE_COLORS, TYPE_ICONS, DEFAULT_TYPE_COLOR } from "@/components/task-types/task-type-visuals";
import type { StatusOpt, TaskTypeVM } from "./types";
import { TypeEditor } from "./type-editor";

export function TypeCard({
  type,
  statuses,
  expanded,
  onToggle,
  onDelete,
}: {
  type: TaskTypeVM;
  statuses: StatusOpt[];
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const count = type.sections.reduce((sum, s) => sum + s.fields.length, 0);
  const color = type.color ?? DEFAULT_TYPE_COLOR;

  const setVisual = (data: { icon?: string; color?: string }) =>
    startTransition(async () => {
      await updateChecklistTemplate(type.id, data);
      router.refresh();
    });

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-border/60 bg-surface",
      )}
    >
      <div className="flex w-full items-center gap-3 p-3">
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Edit color and icon"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-md transition-transform hover:scale-105"
              style={{
                backgroundColor: `color-mix(in oklab, ${color} 18%, transparent)`,
                color,
              }}
            >
              <TypeIcon name={type.icon} className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 space-y-3 p-3">
            <div className="space-y-1.5">
              <div className="text-tiny font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Color
              </div>
              <div className="flex flex-wrap gap-1.5">
                {TYPE_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`color ${c}`}
                    onClick={() => setVisual({ color: c })}
                    className={cn(
                      "h-6 w-6 rounded-full border transition-transform",
                      color === c
                        ? "border-foreground scale-110"
                        : "border-transparent hover:scale-110",
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="text-tiny font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Icon
              </div>
              <div className="flex flex-wrap gap-1">
                {Object.keys(TYPE_ICONS).map((name) => {
                  const active = (type.icon ?? "film") === name;
                  return (
                    <button
                      key={name}
                      type="button"
                      aria-label={`icon ${name}`}
                      onClick={() => setVisual({ icon: name })}
                      className={cn(
                        "grid h-8 w-8 place-items-center rounded-md border transition-colors",
                        active
                          ? "border-foreground text-foreground"
                          : "border-border/60 text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <TypeIcon name={name} className="h-3.5 w-3.5" />
                    </button>
                  );
                })}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-2 truncate text-left font-medium"
        >
          <span className="truncate">{type.name}</span>
        </button>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Layers className="h-3.5 w-3.5" />
          {count} {count === 1 ? "field" : "fields"}
        </div>

        {/* Type-level gate: completed tasks of this type go to the publish
            calendar. Flipping it also updates existing tasks. */}
        <label
          className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground"
          title="Completed tasks of this type appear in the publish calendar"
        >
          <CalendarCheck2
            className={cn(
              "h-3.5 w-3.5",
              type.publishToCalendar && "text-primary",
            )}
          />
          <span className="hidden sm:inline">Publish</span>
          <Switch
            checked={type.publishToCalendar}
            onCheckedChange={(v) =>
              startTransition(async () => {
                await updateChecklistTemplate(type.id, { publishToCalendar: v });
                router.refresh();
              })
            }
          />
        </label>

        {expanded ? (
          <>
            <button
              type="button"
              aria-label="Delete type"
              onClick={onDelete}
              className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Close"
              onClick={onToggle}
              className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </>
        ) : (
          <button
            type="button"
            aria-label="Edit type"
            onClick={onToggle}
            className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted/40 hover:text-foreground"
          >
            <Pencil className="h-4 w-4" />
          </button>
        )}
      </div>

      {expanded && <TypeEditor type={type} statuses={statuses} />}
    </div>
  );
}
