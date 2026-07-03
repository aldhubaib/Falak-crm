"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageContainer } from "@/components/page-container";
import { SurfaceCard } from "@/components/surface-card";
import { EmptyState } from "@/components/empty-state";
import { IconButton } from "@/components/icon-button";
import { AddItemInput } from "@/components/add-item-input";
import {
  createChecklistTemplate,
  deleteChecklistTemplate,
} from "@/actions/settings";

type Template = {
  id: string;
  name: string;
  description: string | null;
  items: { id: string; name: string; type: string; role: string }[];
};

type Status = {
  id: string;
  name: string;
  color: string;
};

export function TaskTypesClient({
  templates,
  statuses: _statuses,
}: {
  templates: Template[];
  statuses: Status[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [newName, setNewName] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const add = () => {
    const v = newName.trim();
    if (!v) return;
    const fd = new FormData();
    fd.set("name", v);
    startTransition(async () => {
      await createChecklistTemplate(fd);
      setNewName("");
      router.refresh();
    });
  };

  const remove = (id: string) => {
    startTransition(async () => {
      await deleteChecklistTemplate(id);
      router.refresh();
    });
  };

  return (
    <PageContainer className="mx-auto w-full max-w-2xl">
      <SurfaceCard padding="sm">
        <div className="mb-2 flex items-center gap-2 text-hint text-muted-foreground">
          <ClipboardList className="h-3.5 w-3.5" />
          Add a new task type
        </div>
        <AddItemInput
          value={newName}
          onChange={setNewName}
          onAdd={add}
          addLabel="Add"
          placeholder="Task type name (e.g. Social Post)"
        />
      </SurfaceCard>

      <div className="space-y-field-gap">
        {templates.map((t) => {
          const isExpanded = expanded === t.id;
          return (
            <SurfaceCard key={t.id} padding="none">
              <button
                type="button"
                onClick={() => setExpanded(isExpanded ? null : t.id)}
                className="flex w-full items-center gap-3 p-3 text-left sm:p-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{t.name}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {t.items.length} checklist item
                    {t.items.length !== 1 ? "s" : ""}
                  </div>
                </div>
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>

              {isExpanded && (
                <div className="border-t border-border/40 p-3 sm:p-4">
                  {t.items.length > 0 ? (
                    <ul className="space-y-1.5">
                      {t.items.map((item) => (
                        <li
                          key={item.id}
                          className="flex items-center gap-2 text-sm"
                        >
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
                          <span className="flex-1 truncate">{item.name}</span>
                          <span className="shrink-0 text-xs text-muted-foreground capitalize">
                            {item.type}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No checklist items yet.
                    </p>
                  )}
                  <div className="mt-3 flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => remove(t.id)}
                      disabled={pending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </Button>
                  </div>
                </div>
              )}
            </SurfaceCard>
          );
        })}

        {templates.length === 0 && (
          <EmptyState message="No task types yet. Create your first one." />
        )}
      </div>
    </PageContainer>
  );
}
