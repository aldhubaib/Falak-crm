"use client";

import { useState } from "react";
import { createTask, updateTaskStatus, deleteTask, updateProjectStatus } from "@/actions/projects";
import { createInvoiceFromProject } from "@/actions/invoices";
import { ArrowLeft, Plus, Trash2, X, FileText, Check } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type TaskStatus = { id: string; name: string; color: string; order: number };
type ProjectStatus = { id: string; name: string; color: string; order: number };
type ServiceOption = { id: string; name: string; unitPrice: number };

type Task = {
  id: string;
  title: string;
  description: string | null;
  billable: boolean;
  price: unknown;
  completedAt: Date | null;
  status: TaskStatus | null;
  service: { name: string } | null;
  assignee: { name: string | null } | null;
};

type Invoice = {
  id: string;
  number: string;
  total: unknown;
  currency: string;
  status: string;
  createdAt: Date;
};

type Project = {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus | null;
  company: { name: string } | null;
  deal: { title: string; value: unknown } | null;
  tasks: Task[];
  invoices: Invoice[];
};

export function ProjectDetailClient({
  project,
  taskStatuses,
  projectStatuses,
  services,
}: {
  project: Project;
  taskStatuses: TaskStatus[];
  projectStatuses: ProjectStatus[];
  services: ServiceOption[];
}) {
  const [showAddTask, setShowAddTask] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);

  const billableTasks = project.tasks.filter((t) => t.billable && t.completedAt);
  const canCreateInvoice = billableTasks.length > 0;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-3 h-12 mb-6">
        <Link
          href="/dashboard/projects"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-foreground">{project.name}</h1>
          <p className="text-[12px] text-muted-foreground">
            {project.company?.name || "No company"}
          </p>
        </div>
        <select
          value={project.status?.id || ""}
          onChange={(e) => updateProjectStatus(project.id, e.target.value)}
          className="h-8 px-2 rounded-lg bg-input border border-border text-[12px] text-foreground"
        >
          {projectStatuses.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tasks */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[13px] font-medium text-foreground">
              Tasks ({project.tasks.length})
            </h3>
            <div className="flex gap-2">
              {selectedTasks.length > 0 && (
                <form
                  action={async () => {
                    await createInvoiceFromProject(project.id, selectedTasks);
                    setSelectedTasks([]);
                  }}
                >
                  <button
                    type="submit"
                    className="h-7 px-2.5 rounded-lg bg-orange/15 text-[11px] font-medium text-orange hover:bg-orange/25 transition-colors flex items-center gap-1"
                  >
                    <FileText className="w-3 h-3" />
                    Invoice ({selectedTasks.length})
                  </button>
                </form>
              )}
              <button
                onClick={() => setShowAddTask(true)}
                className="h-7 px-2.5 rounded-lg bg-primary/15 text-[11px] font-medium text-primary hover:bg-primary/25 transition-colors flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add Task
              </button>
            </div>
          </div>

          {showAddTask && (
            <form
              action={async (formData) => {
                await createTask(project.id, formData);
                setShowAddTask(false);
              }}
              className="mb-4 p-3 rounded-lg bg-muted/50 space-y-2"
            >
              <input
                name="title"
                placeholder="Task title *"
                required
                className="w-full h-8 px-2 rounded-lg bg-input border border-border text-[12px] text-foreground placeholder:text-muted-foreground"
              />
              <div className="grid grid-cols-3 gap-2">
                <select name="serviceId" className="h-8 px-2 rounded-lg bg-input border border-border text-[12px] text-foreground">
                  <option value="">No service</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <input name="price" type="number" step="0.01" placeholder="Price" className="h-8 px-2 rounded-lg bg-input border border-border text-[12px] text-foreground" />
                <select name="statusId" className="h-8 px-2 rounded-lg bg-input border border-border text-[12px] text-foreground">
                  {taskStatuses.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <input type="hidden" name="billable" value="true" />
              <div className="flex gap-2">
                <Button type="submit" size="sm">Add</Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddTask(false)}>Cancel</Button>
              </div>
            </form>
          )}

          {project.tasks.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">No tasks yet</p>
          ) : (
            <div className="space-y-1">
              {project.tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors group"
                >
                  {task.billable && task.completedAt && (
                    <input
                      type="checkbox"
                      checked={selectedTasks.includes(task.id)}
                      onChange={(e) =>
                        setSelectedTasks(
                          e.target.checked
                            ? [...selectedTasks, task.id]
                            : selectedTasks.filter((id) => id !== task.id)
                        )
                      }
                      className="w-3.5 h-3.5 rounded border-border"
                    />
                  )}
                  {(!task.billable || !task.completedAt) && <div className="w-3.5" />}
                  <div className="flex-1 min-w-0">
                    <p className={`text-[13px] ${task.completedAt ? "line-through text-muted-foreground" : "text-foreground"}`}>
                      {task.title}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {task.billable && task.price ? `${Number(task.price).toLocaleString()} KWD` : "Non-billable"}
                      {task.assignee?.name && ` • ${task.assignee.name}`}
                    </p>
                  </div>
                  <select
                    value={task.status?.id || ""}
                    onChange={(e) => updateTaskStatus(task.id, e.target.value, project.id)}
                    className="h-6 px-1.5 rounded bg-muted border-none text-[10px] text-foreground"
                    style={task.status ? { color: task.status.color } : undefined}
                  >
                    {taskStatuses.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <form action={deleteTask.bind(null, task.id, project.id)}>
                    <button type="submit" className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Invoices */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-[13px] font-medium text-foreground mb-3">
            Invoices ({project.invoices.length})
          </h3>
          {project.invoices.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">
              Complete billable tasks, then select them to create an invoice.
            </p>
          ) : (
            <div className="space-y-2">
              {project.invoices.map((invoice) => (
                <Link
                  key={invoice.id}
                  href={`/dashboard/invoices/${invoice.id}`}
                  className="p-2.5 rounded-lg bg-muted/50 block no-underline hover:bg-muted transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-medium text-foreground">{invoice.number}</span>
                    <InvoiceStatusBadge status={invoice.status} />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {Number(invoice.total).toLocaleString()} {invoice.currency || "KWD"}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InvoiceStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    DRAFT: { label: "Draft", className: "bg-muted text-muted-foreground" },
    SENT: { label: "Sent", className: "bg-orange/15 text-orange" },
    ACCEPTED: { label: "Accepted", className: "bg-success/15 text-success" },
    REJECTED: { label: "Rejected", className: "bg-destructive/15 text-destructive" },
    PAID: { label: "Paid", className: "bg-primary/15 text-primary" },
    CANCELLED: { label: "Cancelled", className: "bg-muted text-muted-foreground" },
  };
  const { label, className } = config[status] ?? config.DRAFT;
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${className}`}>
      {label}
    </span>
  );
}
