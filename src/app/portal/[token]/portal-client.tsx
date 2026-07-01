"use client";

import { CheckCircle2, Circle, Clock, FileText, FolderKanban } from "lucide-react";
import Link from "next/link";

type TaskStatus = { id: string; name: string; color: string };
type ProjectStatus = { id: string; name: string; color: string };

type Task = {
  id: string;
  title: string;
  completedAt: Date | null;
  status: TaskStatus | null;
};

type Invoice = {
  id: string;
  number: string;
  status: string;
  total: unknown;
  currency: string;
  publicToken: string;
  createdAt: Date;
};

type Project = {
  id: string;
  status: ProjectStatus | null;
  tasks: Task[];
  invoices: Invoice[];
};

type Deal = {
  id: string;
  title: string;
  company: { name: string } | null;
  project: Project | null;
};

interface PortalData {
  deal: Deal;
  permissions: {
    project: boolean;
    tasks: boolean;
    invoices: boolean;
  };
  clientName: string | null;
  clientEmail: string;
}

export function PortalClient({ data }: { data: PortalData }) {
  const { deal, permissions, clientName } = data;
  const project = deal.project;

  const totalTasks = project?.tasks.length ?? 0;
  const completedTasks = project?.tasks.filter((t) => t.completedAt).length ?? 0;
  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-3xl mx-auto px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center text-body font-semibold text-primary">
              {deal.title.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">{deal.title}</h1>
              <p className="text-sub text-muted-foreground">
                {deal.company?.name || ""}
                {clientName && ` • Welcome, ${clientName}`}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* Project Progress */}
        {permissions.project && project && (
          <section className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <FolderKanban className="w-4 h-4 text-primary" />
              <h2 className="text-subheading font-medium text-foreground">Project Status</h2>
            </div>

            <div className="flex items-center justify-between mb-3">
              {project.status && (
                <span
                  className="px-2.5 py-1 rounded-full text-sub font-medium"
                  style={{
                    backgroundColor: `${project.status.color}20`,
                    color: project.status.color,
                  }}
                >
                  {project.status.name}
                </span>
              )}
              <span className="text-body text-muted-foreground">
                {completedTasks}/{totalTasks} tasks completed
              </span>
            </div>

            <div className="h-2.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-sub text-muted-foreground mt-1.5">{progress}% complete</p>
          </section>
        )}

        {/* Tasks List */}
        {permissions.tasks && project && project.tasks.length > 0 && (
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-subheading font-medium text-foreground mb-4">Tasks</h2>
            <div className="space-y-2">
              {project.tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30"
                >
                  {task.completedAt ? (
                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                  <span
                    className={`text-body flex-1 ${
                      task.completedAt ? "line-through text-muted-foreground" : "text-foreground"
                    }`}
                  >
                    {task.title}
                  </span>
                  {task.status && (
                    <span
                      className="px-1.5 py-0.5 rounded text-label font-medium"
                      style={{
                        backgroundColor: `${task.status.color}20`,
                        color: task.status.color,
                      }}
                    >
                      {task.status.name}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Invoices */}
        {permissions.invoices && project && project.invoices.length > 0 && (
          <section className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-4 h-4 text-orange" />
              <h2 className="text-subheading font-medium text-foreground">Invoices</h2>
            </div>
            <div className="space-y-2">
              {project.invoices.map((invoice) => (
                <Link
                  key={invoice.id}
                  href={`/inv/${invoice.publicToken}`}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30 no-underline hover:bg-muted/50 transition-colors"
                >
                  <div>
                    <p className="text-body font-medium text-foreground">{invoice.number}</p>
                    <p className="text-sub text-muted-foreground mt-0.5">
                      {new Date(invoice.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-body font-semibold text-foreground">
                      {Number(invoice.total).toLocaleString()} {invoice.currency || "KWD"}
                    </p>
                    <InvoiceStatusBadge status={invoice.status} />
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {!project && (
          <section className="rounded-xl border border-border bg-card p-8 text-center">
            <Clock className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              The project hasn&apos;t started yet. Check back soon!
            </p>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-12">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <p className="text-sub text-muted-foreground text-center">
            Powered by Falak CRM
          </p>
        </div>
      </footer>
    </div>
  );
}

function InvoiceStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    DRAFT: { label: "Draft", className: "bg-muted text-muted-foreground" },
    SENT: { label: "Pending", className: "bg-orange/15 text-orange" },
    ACCEPTED: { label: "Accepted", className: "bg-success/15 text-success" },
    REJECTED: { label: "Rejected", className: "bg-destructive/15 text-destructive" },
    PAID: { label: "Paid", className: "bg-primary/15 text-primary" },
    CANCELLED: { label: "Cancelled", className: "bg-muted text-muted-foreground" },
  };
  const { label, className } = config[status] ?? config.DRAFT;
  return (
    <span className={`px-1.5 py-0.5 rounded text-label font-medium ${className}`}>
      {label}
    </span>
  );
}
