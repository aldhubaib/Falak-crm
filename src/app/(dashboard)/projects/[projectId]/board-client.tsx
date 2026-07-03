"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { updateTaskStatus } from "@/actions/projects";

type TaskCard = {
  id: string;
  title: string;
  statusId: string | null;
  statusName: string;
  statusColor: string;
  assigneeName: string | null;
  serviceName: string | null;
  checklistTotal: number;
  checklistDone: number;
};

type Status = {
  id: string;
  name: string;
  color: string;
};

export function ProjectBoardClient({
  projectId,
  tasks,
  statuses,
}: {
  projectId: string;
  tasks: TaskCard[];
  statuses: Status[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const moveTask = (taskId: string, statusId: string) => {
    startTransition(async () => {
      await updateTaskStatus(taskId, statusId, projectId);
      router.refresh();
    });
  };

  const grouped = statuses.map((s) => ({
    ...s,
    tasks: tasks.filter((t) => t.statusId === s.id),
  }));

  const unassigned = tasks.filter(
    (t) => !statuses.some((s) => s.id === t.statusId),
  );
  if (unassigned.length > 0) {
    grouped.unshift({
      id: "unassigned",
      name: "Unassigned",
      color: "#6b7280",
      tasks: unassigned,
    });
  }

  return (
    <div
      className={cn(
        "grid min-h-[calc(100vh-3.5rem)] gap-4 p-5",
        grouped.length <= 3
          ? "grid-cols-1 sm:grid-cols-3"
          : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5",
      )}
    >
      {grouped.map((col) => (
        <div key={col.id} className="flex min-w-0 flex-col">
          <div className="mb-3 flex h-6 items-center gap-2 whitespace-nowrap text-xs font-semibold uppercase tracking-[0.14em]">
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: col.color }}
            />
            <span className="text-foreground">{col.name}</span>
            <span className="text-muted-foreground">{col.tasks.length}</span>
            {col === grouped[0] && (
              <Button
                asChild
                size="icon"
                className="ml-auto h-6 w-6 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
                aria-label="New task"
              >
                <Link href={`/projects/${projectId}/tasks/new`}>
                  <Plus className="h-3.5 w-3.5" />
                </Link>
              </Button>
            )}
          </div>

          <div
            className="flex-1 space-y-2 rounded-lg border border-dotted border-transparent p-2 min-h-24"
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }}
            onDrop={(e) => {
              e.preventDefault();
              const taskId = e.dataTransfer.getData("text/task-id");
              if (taskId && col.id !== "unassigned") moveTask(taskId, col.id);
            }}
          >
            {col.tasks.length === 0 ? (
              <div className="grid h-24 place-items-center text-xs text-muted-foreground">
                No tasks
              </div>
            ) : (
              col.tasks.map((task) => (
                <Link
                  key={task.id}
                  href={`/projects/${projectId}/tasks/${task.id}`}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/task-id", task.id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  className="block rounded-xl border border-border/60 bg-surface p-3 transition-all hover:-translate-y-0.5 hover:border-border hover:shadow-md cursor-grab active:cursor-grabbing"
                >
                  <div className="text-sm font-medium text-foreground">
                    {task.title}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-tiny text-muted-foreground">
                    {task.assigneeName && (
                      <span className="inline-flex items-center gap-1">
                        <span className="grid h-5 w-5 place-items-center rounded-full bg-primary/15 text-xxs font-medium text-primary">
                          {task.assigneeName.charAt(0).toUpperCase()}
                        </span>
                        {task.assigneeName}
                      </span>
                    )}
                    {task.serviceName && (
                      <span className="rounded bg-muted/40 px-1.5 py-0.5 text-xxs">
                        {task.serviceName}
                      </span>
                    )}
                    {task.checklistTotal > 0 && (
                      <span>
                        {task.checklistDone}/{task.checklistTotal}
                      </span>
                    )}
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
