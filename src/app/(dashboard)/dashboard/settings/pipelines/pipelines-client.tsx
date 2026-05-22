"use client";

import { useState } from "react";
import { createPipeline, createStage, updateStage, deleteStage } from "@/actions/settings";
import { ArrowLeft, Plus, Trash2, X, GripVertical } from "lucide-react";
import Link from "next/link";

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
  isDefault: boolean;
  stages: Stage[];
};

export function PipelinesClient({ pipelines }: { pipelines: Pipeline[] }) {
  const [showNewPipeline, setShowNewPipeline] = useState(false);

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 h-12 mb-6">
        <Link
          href="/dashboard/settings"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-lg font-semibold text-foreground">Pipelines & Stages</h1>
        <button
          onClick={() => setShowNewPipeline(true)}
          className="ml-auto h-8 px-3 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 transition-colors flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          New Pipeline
        </button>
      </div>

      {showNewPipeline && (
        <form
          action={async (formData) => {
            await createPipeline(formData);
            setShowNewPipeline(false);
          }}
          className="rounded-xl border border-border bg-card p-4 mb-4 flex items-center gap-3"
        >
          <input
            name="name"
            placeholder="Pipeline name"
            required
            className="flex-1 h-9 px-3 rounded-lg bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button type="submit" className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium">Create</button>
          <button type="button" onClick={() => setShowNewPipeline(false)} className="h-9 px-3 rounded-lg bg-muted text-muted-foreground text-[13px]">Cancel</button>
        </form>
      )}

      <div className="space-y-6">
        {pipelines.map((pipeline) => (
          <PipelineCard key={pipeline.id} pipeline={pipeline} />
        ))}
      </div>
    </div>
  );
}

function PipelineCard({ pipeline }: { pipeline: Pipeline }) {
  const [showAddStage, setShowAddStage] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-[14px] font-medium text-foreground">{pipeline.name}</h3>
          {pipeline.isDefault && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/15 text-primary">Default</span>
          )}
        </div>
        <button
          onClick={() => setShowAddStage(true)}
          className="text-[11px] text-primary hover:text-primary/80 flex items-center gap-1"
        >
          <Plus className="w-3 h-3" /> Add Stage
        </button>
      </div>

      {showAddStage && (
        <form
          action={async (formData) => {
            await createStage(pipeline.id, formData);
            setShowAddStage(false);
          }}
          className="mb-4 p-3 rounded-lg bg-muted/50 flex items-center gap-2"
        >
          <input
            name="name"
            placeholder="Stage name"
            required
            className="flex-1 h-8 px-2 rounded-lg bg-input border border-border text-[12px] text-foreground"
          />
          <input
            name="color"
            type="color"
            defaultValue="#3b82f6"
            className="w-8 h-8 rounded-lg border border-border cursor-pointer"
          />
          <select name="type" className="h-8 px-2 rounded-lg bg-input border border-border text-[12px] text-foreground">
            <option value="OPEN">Open</option>
            <option value="WON">Won</option>
            <option value="LOST">Lost</option>
          </select>
          <button type="submit" className="h-8 px-3 rounded-lg bg-primary text-[11px] text-primary-foreground font-medium">Add</button>
          <button type="button" onClick={() => setShowAddStage(false)} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </form>
      )}

      <div className="space-y-1">
        {pipeline.stages.map((stage) => (
          <div
            key={stage.id}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors group"
          >
            <GripVertical className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 cursor-grab" />
            <div
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: stage.color }}
            />
            <span className="flex-1 text-[13px] text-foreground">{stage.name}</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
              stage.type === "WON" ? "bg-success/15 text-success" :
              stage.type === "LOST" ? "bg-destructive/15 text-destructive" :
              "bg-muted text-muted-foreground"
            }`}>
              {stage.type.toLowerCase()}
            </span>
            <form action={deleteStage.bind(null, stage.id)}>
              <button
                type="submit"
                className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}
