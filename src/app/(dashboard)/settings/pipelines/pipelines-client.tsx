"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, GripVertical, Pencil, Check, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { PageContainer } from "@/components/page-container";
import { SurfaceCard } from "@/components/surface-card";
import { EmptyState } from "@/components/empty-state";
import { IconButton } from "@/components/icon-button";
import {
  createPipeline,
  createStage,
  updateStage,
  deleteStage,
} from "@/actions/settings";
import { cn } from "@/lib/utils";

const DEFAULT_COLORS = [
  "#3b82f6",
  "#22c55e",
  "#ef4444",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
];

const OUTCOME_BADGE: Record<string, string> = {
  OPEN: "bg-muted/50 text-muted-foreground",
  WON: "bg-success/15 text-success",
  LOST: "bg-destructive/15 text-destructive",
};

type Stage = {
  id: string;
  name: string;
  color: string;
  type: string;
  order: number;
};

type Pipeline = {
  id: string;
  name: string;
  stages: Stage[];
};

export function PipelinesClient({ pipelines }: { pipelines: Pipeline[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [newPipelineName, setNewPipelineName] = useState("");

  const addPipeline = () => {
    const v = newPipelineName.trim();
    if (!v) return;
    const fd = new FormData();
    fd.set("name", v);
    startTransition(async () => {
      await createPipeline(fd);
      setNewPipelineName("");
      router.refresh();
    });
  };

  return (
    <PageContainer className="mx-auto w-full max-w-5xl">
      {pipelines.map((p) => (
        <PipelineCard key={p.id} pipeline={p} />
      ))}

      {pipelines.length === 0 && <EmptyState message="No pipelines yet." />}

      <SurfaceCard padding="sm">
        <div className="flex gap-2">
          <Input
            placeholder="New pipeline name"
            value={newPipelineName}
            onChange={(e) => setNewPipelineName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addPipeline()}
            className="flex-1"
          />
          <Button onClick={addPipeline} disabled={pending} size="sm">
            <Plus className="h-4 w-4" />
            Add Pipeline
          </Button>
        </div>
      </SurfaceCard>
    </PageContainer>
  );
}

function PipelineCard({ pipeline }: { pipeline: Pipeline }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const addNewStage = () => {
    const fd = new FormData();
    fd.set("name", "New Stage");
    fd.set("color", "#3b82f6");
    fd.set("type", "OPEN");
    startTransition(async () => {
      await createStage(pipeline.id, fd);
      router.refresh();
    });
  };

  return (
    <SurfaceCard padding="none">
      <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2.5 sm:px-4">
        <span className="text-sm font-semibold">{pipeline.name}</span>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-primary hover:text-primary"
          onClick={addNewStage}
          disabled={pending}
        >
          <Plus className="h-3.5 w-3.5" /> Add Stage
        </Button>
      </div>
      <div className="divide-y divide-border/40">
        {pipeline.stages.map((s) => (
          <StageRow key={s.id} stage={s} />
        ))}
        {pipeline.stages.length === 0 && (
          <div className="px-4 py-6 text-center text-xs text-muted-foreground">
            No stages. Add one to get started.
          </div>
        )}
      </div>
    </SurfaceCard>
  );
}

function StageRow({ stage }: { stage: Stage }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(stage.name);
  const [color, setColor] = useState(stage.color);
  const [type, setType] = useState(stage.type);

  const save = () => {
    const fd = new FormData();
    fd.set("name", name.trim() || stage.name);
    fd.set("color", color);
    fd.set("type", type);
    startTransition(async () => {
      await updateStage(stage.id, fd);
      setEditing(false);
      router.refresh();
    });
  };

  const remove = () => {
    startTransition(async () => {
      await deleteStage(stage.id);
      router.refresh();
    });
  };

  return (
    <div className="group flex items-center gap-3 px-3 py-3 transition-colors hover:bg-surface/70 sm:px-4">
      <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40 transition-opacity group-hover:text-muted-foreground/70" />

      {editing ? (
        <div className="flex shrink-0 items-center gap-1">
          {DEFAULT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label="Set color"
              onClick={() => setColor(c)}
              className={cn(
                "h-4 w-4 rounded-full ring-offset-1 ring-offset-background transition-all hover:scale-110",
                color === c && "ring-2 ring-primary",
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      ) : (
        <span
          className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: stage.color }}
        />
      )}

      {editing ? (
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") {
              setName(stage.name);
              setEditing(false);
            }
          }}
          className="h-8 max-w-xs rounded-md border-border/60 bg-background/60"
        />
      ) : (
        <span className="min-w-0 flex-1 truncate text-left text-sm">
          {stage.name}
        </span>
      )}

      {!editing && <div className="flex-1" />}

      <SearchableSelect
        disabled={!editing}
        value={type}
        onValueChange={(v) => setType(v)}
        align="end"
        searchPlaceholder="Search…"
        className={cn(
          "h-6 w-auto gap-1.5 rounded-md border-0 px-2 text-tiny font-medium uppercase tracking-wide shadow-none [&>svg]:opacity-60 disabled:cursor-default disabled:opacity-100",
          !editing && "[&>svg]:hidden",
          OUTCOME_BADGE[type] ?? OUTCOME_BADGE.OPEN,
        )}
        contentClassName="w-36 min-w-36"
        options={[
          { value: "OPEN", label: "open" },
          { value: "WON", label: "won" },
          { value: "LOST", label: "lost" },
        ]}
      />

      <IconButton
        aria-label={editing ? "Save stage" : "Edit stage"}
        className={cn(
          "h-7 w-7 text-muted-foreground transition-opacity hover:text-primary",
          editing
            ? "opacity-100 text-primary"
            : "opacity-0 group-hover:opacity-100",
        )}
        onClick={() => (editing ? save() : setEditing(true))}
      >
        {editing ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <Pencil className="h-3.5 w-3.5" />
        )}
      </IconButton>

      {!editing && (
        <IconButton
          aria-label="Delete stage"
          className="h-7 w-7 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive hover:text-destructive-foreground group-hover:opacity-100"
          onClick={remove}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </IconButton>
      )}
    </div>
  );
}
