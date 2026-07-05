"use client";

import { Pencil, Play, ShieldCheck, Trash2, Users } from "lucide-react";
import { SurfaceCard } from "@/components/surface-card";
import { RoleEditor, type RoleDTO, type TaskStageDTO } from "./role-editor";

export function RoleCard({
  role,
  stages,
  count,
  expanded,
  onToggle,
  onClose,
  onDelete,
  onTest,
}: {
  role: RoleDTO;
  stages: TaskStageDTO[];
  count: number;
  expanded: boolean;
  onToggle: () => void;
  onClose: () => void;
  onDelete: () => void;
  onTest: () => void;
}) {
  return (
    <SurfaceCard padding="none" className="overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-surface/70"
      >
        <ShieldCheck className="h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1 truncate font-medium">{role.name}</div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          {count}
        </div>
        <div className="flex items-center gap-1">
          {expanded && (
            <>
              <span
                role="button"
                aria-label="Test"
                onClick={(e) => {
                  e.stopPropagation();
                  onTest();
                }}
                className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              >
                <Play className="h-4 w-4" />
              </span>
              <span
                role="button"
                aria-label="Edit"
                className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              >
                <Pencil className="h-4 w-4" />
              </span>
            </>
          )}
          <span
            role="button"
            aria-label="Delete role"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </span>
        </div>
      </button>

      {expanded && <RoleEditor role={role} stages={stages} onClose={onClose} />}
    </SurfaceCard>
  );
}
