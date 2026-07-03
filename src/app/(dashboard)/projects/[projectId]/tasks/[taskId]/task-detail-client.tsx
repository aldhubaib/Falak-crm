"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AtSign, Send, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppHeader } from "@/components/app-header";
import { TaskTypeChip } from "@/components/task-type-chip";
import { cn } from "@/lib/utils";
import { toggleChecklistItem } from "@/actions/projects";
import { addTaskComment } from "@/actions/comments";

export type ChecklistItem = {
  id: string;
  name: string;
  type: string;
  phase: string;
  completed: boolean;
  textValue: string | null;
  attachmentId: string | null;
  mandatory: boolean;
};

export function TaskDetailClient({
  projectId,
  taskId,
  title,
  typeName,
  statusName,
  items,
}: {
  projectId: string;
  taskId: string;
  title: string;
  typeName: string | null;
  statusName: string | null;
  items: ChecklistItem[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [comment, setComment] = useState("");

  const toggle = (itemId: string, completed: boolean) => {
    startTransition(async () => {
      await toggleChecklistItem(itemId, completed, projectId);
      router.refresh();
    });
  };

  const sendComment = () => {
    const text = comment.trim();
    if (!text) return;
    setComment("");
    startTransition(async () => {
      await addTaskComment(taskId, text, projectId);
      router.refresh();
    });
  };

  const reqItems = items.filter((i) => i.phase === "create");
  const delItems = items.filter((i) => i.phase === "delivery");

  return (
    <>
      <AppHeader
        backHref={`/projects/${projectId}`}
        title={
          <div className="flex min-w-0 items-center gap-2">
            {typeName && <TaskTypeChip name={typeName} />}
            <span className="truncate text-sm font-semibold">{title}</span>
          </div>
        }
      />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-8 p-5">
          {/* Requirements */}
          <section>
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-primary">
              Requirements
              <div className="h-px flex-1 bg-border/60" />
            </div>
            {reqItems.length > 0 ? (
              <div className="space-y-2">
                {reqItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggle(item.id, !item.completed)}
                    className="flex w-full items-center gap-3 rounded-xl border border-border/60 bg-surface px-4 py-3 text-left transition-colors hover:border-border"
                  >
                    <span
                      className={cn(
                        "grid size-5 shrink-0 place-items-center rounded-md border transition-colors",
                        item.completed
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border",
                      )}
                    >
                      {item.completed && <Check className="size-3.5" />}
                    </span>
                    <span
                      className={cn(
                        "text-sm",
                        item.completed && "text-muted-foreground line-through",
                      )}
                    >
                      {item.name}
                    </span>
                    {item.mandatory && (
                      <span className="text-xxs text-destructive">*</span>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-border/60 p-6 text-center text-xs text-muted-foreground">
                No requirement fields on this task.
              </div>
            )}
          </section>

          {/* Delivery */}
          {delItems.length > 0 && (
            <section>
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-warning">
                Delivery
                <div className="h-px flex-1 bg-border/60" />
              </div>
              <div className="space-y-2">
                {delItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggle(item.id, !item.completed)}
                    className="flex w-full items-center gap-3 rounded-xl border border-border/60 bg-surface px-4 py-3 text-left transition-colors hover:border-border"
                  >
                    <span
                      className={cn(
                        "grid size-5 shrink-0 place-items-center rounded-md border transition-colors",
                        item.completed
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border",
                      )}
                    >
                      {item.completed && <Check className="size-3.5" />}
                    </span>
                    <span
                      className={cn(
                        "text-sm",
                        item.completed && "text-muted-foreground line-through",
                      )}
                    >
                      {item.name}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Comments */}
          <section>
            <div className="mb-3 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Comments
            </div>
            <div className="flex items-center gap-2 rounded-md border border-border/60 bg-surface px-3 py-2">
              <AtSign className="h-4 w-4 text-muted-foreground" />
              <Input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendComment();
                  }
                }}
                placeholder="Write a comment... Use @ to mention"
                className="h-9 border-0 bg-transparent px-0 focus-visible:ring-0"
              />
              <Button
                size="icon"
                className="h-9 w-9 rounded-md"
                onClick={sendComment}
                disabled={!comment.trim()}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
