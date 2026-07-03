"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Layers, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageContainer } from "@/components/page-container";
import { SurfaceCard } from "@/components/surface-card";
import { EmptyState } from "@/components/empty-state";
import { AddItemInput } from "@/components/add-item-input";
import { TypeCard } from "@/components/task-types/type-card";
import { cn } from "@/lib/utils";
import {
  createChecklistTemplate,
  deleteChecklistTemplate,
} from "@/actions/settings";
import type { StatusOpt, TaskTypeVM } from "@/components/task-types/types";

export function TaskTypesClient({
  templates,
  statuses,
}: {
  templates: TaskTypeVM[];
  statuses: StatusOpt[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [toDelete, setToDelete] = useState<TaskTypeVM | null>(null);

  const addType = () => {
    const n = newName.trim();
    if (!n) {
      setError("Enter a type name");
      setShake((s) => s + 1);
      return;
    }
    if (templates.some((t) => t.name.toLowerCase() === n.toLowerCase())) {
      setError("A type with this name already exists");
      setShake((s) => s + 1);
      return;
    }
    const fd = new FormData();
    fd.set("name", n);
    startTransition(async () => {
      await createChecklistTemplate(fd);
      setNewName("");
      setError(null);
      router.refresh();
    });
  };

  const confirmDelete = () => {
    if (!toDelete) return;
    const id = toDelete.id;
    startTransition(async () => {
      await deleteChecklistTemplate(id);
      if (expanded === id) setExpanded(null);
      setToDelete(null);
      router.refresh();
    });
  };

  return (
    <PageContainer className="mx-auto w-full max-w-5xl space-y-field-gap">
      <p className="text-sm text-muted-foreground">
        These questions apply to all projects. Changes here affect every project
        immediately.
      </p>

      <SurfaceCard padding="sm">
        <div className="mb-2 flex items-center gap-2 text-hint text-muted-foreground">
          <Layers className="h-3.5 w-3.5" />
          Add a new task type
        </div>
        <AddItemInput
          key={shake}
          value={newName}
          onChange={(v) => {
            setNewName(v);
            if (error) setError(null);
          }}
          onAdd={addType}
          addLabel="Add task type"
          placeholder="Type name (e.g. Ai Video 9:16)"
          inputClassName={cn(
            error &&
              "border-destructive text-destructive animate-shake focus-visible:ring-destructive/40",
          )}
        />
        {error && <div className="mt-2 text-hint text-destructive">{error}</div>}
      </SurfaceCard>

      <div className="space-y-field-gap">
        {templates.map((t) => (
          <TypeCard
            key={t.id}
            type={t}
            statuses={statuses}
            expanded={expanded === t.id}
            onToggle={() => setExpanded(expanded === t.id ? null : t.id)}
            onDelete={() => setToDelete(t)}
          />
        ))}
        {templates.length === 0 && <EmptyState message="No task types yet." />}
      </div>

      <Dialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-destructive/15">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <DialogTitle>Delete type &quot;{toDelete?.name}&quot;?</DialogTitle>
            <DialogDescription>
              This type will be removed from every project. This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setToDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
