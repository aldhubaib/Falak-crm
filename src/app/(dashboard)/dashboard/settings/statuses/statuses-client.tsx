"use client";

import { useState } from "react";
import { createProjectStatus, deleteProjectStatus, createTaskStatus, deleteTaskStatus } from "@/actions/settings";
import { ArrowLeft, Plus, Trash2, X } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type Status = { id: string; name: string; color: string; order: number };

export function StatusesClient({
  projectStatuses,
  taskStatuses,
}: {
  projectStatuses: Status[];
  taskStatuses: Status[];
}) {
  return (
    <div className="p-6">
      <div className="flex items-center gap-3 h-12 mb-6">
        <Link
          href="/dashboard/settings"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-lg font-semibold text-foreground">Statuses</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StatusSection
          title="Project Statuses"
          statuses={projectStatuses}
          createAction={createProjectStatus}
          deleteAction={deleteProjectStatus}
        />
        <StatusSection
          title="Task Statuses"
          statuses={taskStatuses}
          createAction={createTaskStatus}
          deleteAction={deleteTaskStatus}
        />
      </div>
    </div>
  );
}

function StatusSection({
  title,
  statuses,
  createAction,
  deleteAction,
}: {
  title: string;
  statuses: Status[];
  createAction: (formData: FormData) => Promise<void>;
  deleteAction: (id: string) => Promise<void>;
}) {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[14px] font-medium text-foreground">{title}</h3>
        <button
          onClick={() => setShowForm(true)}
          className="text-[11px] text-primary hover:text-primary/80 flex items-center gap-1"
        >
          <Plus className="w-3 h-3" /> Add
        </button>
      </div>

      {showForm && (
        <form
          action={async (formData) => {
            await createAction(formData);
            setShowForm(false);
          }}
          className="mb-3 p-3 rounded-lg bg-muted/50 flex items-center gap-2"
        >
          <input
            name="name"
            placeholder="Status name"
            required
            className="flex-1 h-8 px-2 rounded-lg bg-black border border-border text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-ring transition-colors"
          />
          <input
            name="color"
            type="color"
            defaultValue="#3b82f6"
            className="w-8 h-8 rounded-lg border border-border cursor-pointer"
          />
          <Button type="submit" size="sm">Add</Button>
          <button type="button" onClick={() => setShowForm(false)} className="text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </form>
      )}

      <div className="space-y-1">
        {statuses.map((status) => (
          <div
            key={status.id}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors group"
          >
            <div
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: status.color }}
            />
            <span className="flex-1 text-[13px] text-foreground">{status.name}</span>
            <form action={deleteAction.bind(null, status.id)}>
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
