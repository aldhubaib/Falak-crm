"use client";

import { useState } from "react";
import { moveDeal, addDealItem, removeDealItem, createProjectFromDeal } from "@/actions/deals";
import { createTask, updateTaskStatus, deleteTask, updateProjectStatus } from "@/actions/projects";
import { createInvoiceFromProject } from "@/actions/invoices";
import { shareDealWithClient, revokeDealAccess } from "@/actions/deal-access";
import { ArrowLeft, Plus, Trash2, Rocket, Check, FileText, FolderKanban, Share2, Copy, X, ChevronDown } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FormSelect } from "@/components/ui/form-select";
import { useErrorStore } from "@/lib/error-store";
import { usePermissions } from "@/components/permissions-provider";

type Stage = {
  id: string;
  name: string;
  color: string;
  type: string;
  order: number;
};

type DealItem = {
  id: string;
  quantity: number;
  unitPrice: unknown;
  description: string | null;
  service: { id: string; name: string };
};

type TaskStatus = { id: string; name: string; color: string; order: number };
type ProjectStatus = { id: string; name: string; color: string; order: number };

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
  status: ProjectStatus | null;
  tasks: Task[];
  invoices: Invoice[];
};

type DealAccessGrant = {
  id: string;
  email: string;
  name: string | null;
  token: string;
  permissions: unknown;
  createdAt: Date;
};

type Deal = {
  id: string;
  title: string;
  value: unknown;
  currency: string;
  notes: string | null;
  stage: Stage;
  pipeline: { stages: Stage[] };
  company: { id: string; name: string } | null;
  contact: { id: string; firstName: string; lastName: string; mobile: string } | null;
  items: DealItem[];
  project: Project | null;
  lostReason: string | null;
  closedAt: Date | null;
  createdAt: Date;
  accessGrants?: DealAccessGrant[];
};

type ServiceOption = { id: string; name: string; unitPrice: number };

export function DealDetailClient({
  deal,
  services,
  taskStatuses,
  projectStatuses,
}: {
  deal: Deal;
  services: ServiceOption[];
  taskStatuses: TaskStatus[];
  projectStatuses: ProjectStatus[];
  initialTab?: string;
}) {
  const permissions = usePermissions();
  const isWon = deal.stage.type === "WON";
  const isLost = deal.stage.type === "LOST";
  const isClosed = isWon || isLost;
  const stages = deal.pipeline.stages;
  const currentIndex = stages.findIndex((s) => s.id === deal.stage.id);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 h-12">
        <Link
          href="/dashboard/deals"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-foreground">{deal.title}</h1>
          <p className="text-[12px] text-muted-foreground">
            {deal.company?.name || "No company"} • {Number(deal.value).toLocaleString()} {deal.currency || "KWD"}
          </p>
        </div>
        {isWon && !deal.project && permissions.projects !== "none" && (
          <form onSubmit={async (e) => {
            e.preventDefault();
            const result = await createProjectFromDeal(deal.id);
            if (!result.ok) useErrorStore.getState().push(result.error);
          }}>
            <Button type="submit" size="sm">
              <Rocket className="w-3.5 h-3.5" />
              Start Project
            </Button>
          </form>
        )}
      </div>

      {/* Pipeline Progress */}
      {permissions.pipeline !== "none" && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-1">
            {stages.map((stage, idx) => {
              const isPast = idx < currentIndex;
              const isCurrent = idx === currentIndex;
              return (
                <div key={stage.id} className="flex-1">
                  <button
                    disabled={isClosed || idx === currentIndex || permissions.pipeline !== "full"}
                    onClick={async () => {
                      if (!isClosed) {
                        const result = await moveDeal(deal.id, stage.id);
                        if (!result.ok) useErrorStore.getState().push(result.error);
                      }
                    }}
                    className={`w-full h-8 rounded-lg text-[11px] font-medium transition-colors flex items-center justify-center gap-1 ${
                      isCurrent
                        ? "text-white"
                        : isPast
                        ? "bg-muted text-foreground"
                        : "bg-muted/50 text-muted-foreground hover:bg-muted"
                    }`}
                    style={isCurrent ? { backgroundColor: stage.color } : undefined}
                  >
                    {isPast && <Check className="w-3 h-3" />}
                    {stage.name}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Details + Project Summary side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-[13px] font-medium text-foreground mb-3">Details</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Company</dt>
              <dd className="text-foreground">{deal.company?.name || "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Contact</dt>
              <dd className="text-foreground">{deal.contact ? `${deal.contact.firstName} ${deal.contact.lastName}` : "—"}</dd>
            </div>
            {deal.contact?.mobile && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Mobile</dt>
                <dd className="text-foreground">{deal.contact.mobile}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Stage</dt>
              <dd className="text-foreground flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: deal.stage.color }} />
                {deal.stage.name}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Created</dt>
              <dd className="text-foreground">{new Date(deal.createdAt).toLocaleDateString()}</dd>
            </div>
            {deal.closedAt && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Closed</dt>
                <dd className="text-foreground">{new Date(deal.closedAt).toLocaleDateString()}</dd>
              </div>
            )}
            {deal.lostReason && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Lost Reason</dt>
                <dd className="text-foreground">{deal.lostReason}</dd>
              </div>
            )}
          </dl>
        </div>

        {deal.project && permissions.projects !== "none" && (
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[13px] font-medium text-foreground">Project</h3>
              <FormSelect
                name="_projectStatus"
                value={deal.project.status?.id || ""}
                options={projectStatuses.map((s) => ({ value: s.id, label: s.name }))}
                onChange={(val) => updateProjectStatus(deal.project!.id, val, deal.id)}
              />
            </div>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Tasks</dt>
                <dd className="text-foreground">
                  {deal.project.tasks.filter((t) => t.completedAt).length}/{deal.project.tasks.length} completed
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Invoices</dt>
                <dd className="text-foreground">{deal.project.invoices.length}</dd>
              </div>
            </dl>
            {deal.project.tasks.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border">
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{
                      width: `${(deal.project.tasks.filter((t) => t.completedAt).length / deal.project.tasks.length) * 100}%`,
                    }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {Math.round((deal.project.tasks.filter((t) => t.completedAt).length / deal.project.tasks.length) * 100)}% complete
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Services Section */}
      {permissions.deals !== "none" && (
        <ServicesSection deal={deal} services={services} isClosed={isClosed} canEdit={permissions.deals === "full"} />
      )}

      {/* Tasks Section */}
      {isWon && deal.project && permissions.projects !== "none" && (
        <TasksSection deal={deal} services={services} taskStatuses={taskStatuses} canEdit={permissions.projects === "full"} />
      )}

      {/* Invoices Section */}
      {deal.project && deal.project.invoices.length > 0 && permissions.invoices !== "none" && (
        <InvoicesSection deal={deal} />
      )}

      {/* Client Access Section */}
      {isWon && permissions.deals === "full" && (
        <ShareSection deal={deal} />
      )}
    </div>
  );
}

/* ─── Collapsible Section Wrapper ───────────────────────────────────────────── */

function Section({
  title,
  count,
  defaultOpen = true,
  actions,
  children,
}: {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border border-border bg-card">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-2">
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`} />
          <h3 className="text-[13px] font-medium text-foreground">
            {title}
            {count !== undefined && (
              <span className="text-muted-foreground font-normal ml-1">({count})</span>
            )}
          </h3>
        </div>
        {actions && <div onClick={(e) => e.stopPropagation()}>{actions}</div>}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

/* ─── Services ──────────────────────────────────────────────────────────────── */

function ServicesSection({
  deal,
  services,
  isClosed,
  canEdit: canEditServices,
}: {
  deal: Deal;
  services: ServiceOption[];
  isClosed: boolean;
  canEdit: boolean;
}) {
  const [addingRow, setAddingRow] = useState(false);
  const [newQty, setNewQty] = useState("1");
  const [newRate, setNewRate] = useState("");
  const canAdd = !isClosed && canEditServices;
  const currency = deal.currency || "KWD";

  const subtotal = deal.items.reduce(
    (sum, item) => sum + Number(item.unitPrice) * item.quantity,
    0
  );

  return (
    <Section title="Item Table" count={deal.items.length}>
      {/* Table header */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="grid grid-cols-[1fr_90px_110px_110px_36px] gap-0 bg-muted/50 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          <div className="px-3 py-2.5">Item Details</div>
          <div className="px-3 py-2.5 text-right">Quantity</div>
          <div className="px-3 py-2.5 text-right">Rate</div>
          <div className="px-3 py-2.5 text-right">Amount</div>
          <div className="px-3 py-2.5" />
        </div>

        {/* Existing rows */}
        {deal.items.map((item) => {
          const amount = Number(item.unitPrice) * item.quantity;
          return (
            <div
              key={item.id}
              className="grid grid-cols-[1fr_90px_110px_110px_36px] gap-0 border-t border-border items-center group"
            >
              <div className="px-3 py-2.5">
                <p className="text-[13px] text-foreground">{item.service.name}</p>
              </div>
              <div className="px-3 py-2.5 text-right text-[13px] text-foreground tabular-nums">
                {item.quantity}
              </div>
              <div className="px-3 py-2.5 text-right text-[13px] text-foreground tabular-nums">
                {Number(item.unitPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <div className="px-3 py-2.5 text-right text-[13px] text-foreground font-medium tabular-nums">
                {amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <div className="px-1 py-2.5 flex justify-center">
                {canAdd && (
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    const result = await removeDealItem(item.id, deal.id);
                    if (!result.ok) useErrorStore.getState().push(result.error);
                  }}>
                    <button type="submit" className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </form>
                )}
              </div>
            </div>
          );
        })}

        {/* New row form - inline */}
        {addingRow && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const result = await addDealItem(deal.id, formData);
              if (!result.ok) { useErrorStore.getState().push(result.error); return; }
              setAddingRow(false);
              setNewQty("1");
              setNewRate("");
            }}
            className="grid grid-cols-[1fr_90px_110px_110px_36px] gap-0 border-t border-border border-dashed items-center bg-muted/30"
          >
            <div className="px-2 py-1.5">
              <FormSelect
                name="serviceId"
                placeholder="Select service..."
                required
                options={services.map((s) => ({
                  value: s.id,
                  label: s.name,
                }))}
                onChange={(val) => {
                  const s = services.find((sv) => sv.id === val);
                  if (s) setNewRate(String(s.unitPrice));
                }}
              />
            </div>
            <div className="px-1 py-1.5">
              <input
                name="quantity"
                type="number"
                min="1"
                value={newQty}
                onChange={(e) => setNewQty(e.target.value)}
                className="w-full h-8 rounded-md bg-background border border-border px-2 text-[13px] text-foreground text-right tabular-nums focus:outline-none focus:border-ring"
              />
            </div>
            <div className="px-1 py-1.5">
              <input
                name="unitPrice"
                type="number"
                step="0.01"
                value={newRate}
                onChange={(e) => setNewRate(e.target.value)}
                placeholder="0.00"
                className="w-full h-8 rounded-md bg-background border border-border px-2 text-[13px] text-foreground text-right tabular-nums placeholder:text-muted-foreground/50 focus:outline-none focus:border-ring"
              />
            </div>
            <div className="px-3 py-1.5 text-right text-[13px] text-muted-foreground tabular-nums">
              {((parseFloat(newQty) || 0) * (parseFloat(newRate) || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div className="px-1 py-1.5 flex justify-center">
              <button type="button" onClick={() => { setAddingRow(false); setNewQty("1"); setNewRate(""); }} className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="col-span-5 px-3 pb-2">
              <Button type="submit" size="sm"><Plus className="w-3.5 h-3.5" /> Add</Button>
            </div>
          </form>
        )}

        {/* Empty state inside table */}
        {deal.items.length === 0 && !addingRow && (
          <div className="px-3 py-6 text-center text-[12px] text-muted-foreground border-t border-border">
            No items yet — add a service to get started.
          </div>
        )}
      </div>

      {/* Add Row button */}
      {canAdd && !addingRow && (
        <div className="mt-3">
          <button
            onClick={() => setAddingRow(true)}
            className="text-[12px] font-medium text-primary hover:text-primary/80 flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Add New Row
          </button>
        </div>
      )}

      {/* Totals */}
      {deal.items.length > 0 && (
        <div className="mt-4 flex justify-end">
          <div className="w-[280px] space-y-2">
            <div className="flex justify-between text-[13px]">
              <span className="text-muted-foreground">Sub Total</span>
              <span className="text-foreground tabular-nums">
                {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between text-[13px] font-semibold pt-2 border-t border-border">
              <span className="text-foreground">Total ({currency})</span>
              <span className="text-foreground tabular-nums">
                {subtotal.toLocaleString(undefined, { minimumFractionDigits: 3 })}
              </span>
            </div>
          </div>
        </div>
      )}
    </Section>
  );
}

/* ─── Tasks ─────────────────────────────────────────────────────────────────── */

function TasksSection({
  deal,
  services,
  taskStatuses,
  canEdit: canEditTasks,
}: {
  deal: Deal;
  services: ServiceOption[];
  taskStatuses: TaskStatus[];
  canEdit: boolean;
}) {
  const [showAddTask, setShowAddTask] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const project = deal.project!;

  return (
    <Section
      title="Tasks"
      count={project.tasks.length}
      actions={
        <div className="flex gap-2">
          {selectedTasks.length > 0 && (
            <form
              action={async () => {
                await createInvoiceFromProject(project.id, selectedTasks, deal.id);
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
          {canEditTasks && (
            <button
              onClick={() => setShowAddTask(true)}
              className="h-7 px-2.5 rounded-lg bg-primary/15 text-[11px] font-medium text-primary hover:bg-primary/25 transition-colors flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Add Task
            </button>
          )}
        </div>
      }
    >
      {showAddTask && (
        <form
          action={async (formData) => {
            await createTask(project.id, formData, deal.id);
            setShowAddTask(false);
          }}
          className="mb-4 p-3 rounded-lg bg-muted/50 space-y-2"
        >
          <div className="rounded-lg bg-black border border-border px-3 pt-2 pb-1.5 focus-within:border-ring transition-colors">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Title <span className="text-destructive">*</span></label>
            <input name="title" placeholder="Task title" required className="w-full h-8 bg-transparent border-none text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <FormSelect name="serviceId" label="Service" placeholder="No service" options={services.map((s) => ({ value: s.id, label: s.name }))} />
            <div className="rounded-lg bg-black border border-border px-3 pt-2 pb-1.5 focus-within:border-ring transition-colors">
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Price</label>
              <input name="price" type="number" step="0.01" placeholder="0.00" className="w-full h-8 bg-transparent border-none text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none" />
            </div>
            <FormSelect name="statusId" label="Status" value={taskStatuses[0]?.id || ""} options={taskStatuses.map((s) => ({ value: s.id, label: s.name }))} />
          </div>
          <input type="hidden" name="billable" value="true" />
          <div className="flex gap-2">
            <Button type="submit" size="sm"><Plus className="w-3.5 h-3.5" /> Add</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddTask(false)}>Cancel</Button>
          </div>
        </form>
      )}

      {project.tasks.length === 0 ? (
        <p className="text-[12px] text-muted-foreground">No tasks yet</p>
      ) : (
        <div className="space-y-1">
          {project.tasks.map((task) => (
            <div key={task.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors group">
              {task.billable && task.completedAt ? (
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
              ) : (
                <div className="w-3.5" />
              )}
              <div className="flex-1 min-w-0">
                <p className={`text-[13px] ${task.completedAt ? "line-through text-muted-foreground" : "text-foreground"}`}>
                  {task.title}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {task.billable && task.price ? `${Number(task.price).toLocaleString()} KWD` : "Non-billable"}
                  {task.assignee?.name && ` • ${task.assignee.name}`}
                </p>
              </div>
              {canEditTasks && (
                <FormSelect
                  name={`taskStatus_${task.id}`}
                  value={task.status?.id || ""}
                  options={taskStatuses.map((s) => ({ value: s.id, label: s.name }))}
                  onChange={(val) => updateTaskStatus(task.id, val, project.id, deal.id)}
                />
              )}
              {!canEditTasks && task.status && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: `${task.status.color}20`, color: task.status.color }}>
                  {task.status.name}
                </span>
              )}
              {canEditTasks && (
                <form action={deleteTask.bind(null, task.id, project.id, deal.id)}>
                  <button type="submit" className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

/* ─── Invoices ──────────────────────────────────────────────────────────────── */

function InvoicesSection({ deal }: { deal: Deal }) {
  const project = deal.project!;

  return (
    <Section title="Invoices" count={project.invoices.length}>
      <div className="space-y-2">
        {project.invoices.map((invoice) => (
          <Link
            key={invoice.id}
            href={`/dashboard/invoices/${invoice.id}`}
            className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50 no-underline hover:bg-muted transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-orange/15 flex items-center justify-center">
                <FileText className="w-3.5 h-3.5 text-orange" />
              </div>
              <div>
                <p className="text-[12px] font-medium text-foreground">{invoice.number}</p>
                <p className="text-[11px] text-muted-foreground">{new Date(invoice.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[12px] font-semibold text-foreground">
                {Number(invoice.total).toLocaleString()} {invoice.currency || "KWD"}
              </p>
              <InvoiceStatusBadge status={invoice.status} />
            </div>
          </Link>
        ))}
      </div>
    </Section>
  );
}

/* ─── Client Access ─────────────────────────────────────────────────────────── */

function ShareSection({ deal }: { deal: Deal }) {
  const [showForm, setShowForm] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const grants = deal.accessGrants || [];

  async function handleShare(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const result = await shareDealWithClient(deal.id, formData);
    if (result.ok) setShowForm(false);
  }

  function copyLink(token: string) {
    const url = `${window.location.origin}/portal/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  }

  return (
    <Section
      title="Client Access"
      count={grants.length}
      defaultOpen={grants.length > 0}
      actions={!showForm ? (
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Share2 className="w-3.5 h-3.5" /> Share
        </Button>
      ) : undefined}
    >
      {showForm && (
        <form onSubmit={handleShare} className="mb-3 p-3 rounded-lg bg-muted/50 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-black border border-border px-3 pt-2 pb-1.5 focus-within:border-ring transition-colors">
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Email <span className="text-destructive">*</span></label>
              <input name="email" type="email" required placeholder="client@company.com" className="w-full h-8 bg-transparent border-none text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none" />
            </div>
            <div className="rounded-lg bg-black border border-border px-3 pt-2 pb-1.5 focus-within:border-ring transition-colors">
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Name</label>
              <input name="name" placeholder="Client name" className="w-full h-8 bg-transparent border-none text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none" />
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">What can they see?</p>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-[12px] text-foreground cursor-pointer">
                <input type="hidden" name="showProject" value="false" />
                <input type="checkbox" name="showProject" value="true" defaultChecked className="w-3.5 h-3.5 rounded border-border" />
                Project status
              </label>
              <label className="flex items-center gap-2 text-[12px] text-foreground cursor-pointer">
                <input type="hidden" name="showTasks" value="false" />
                <input type="checkbox" name="showTasks" value="true" defaultChecked className="w-3.5 h-3.5 rounded border-border" />
                Tasks
              </label>
              <label className="flex items-center gap-2 text-[12px] text-foreground cursor-pointer">
                <input type="hidden" name="showInvoices" value="false" />
                <input type="checkbox" name="showInvoices" value="true" defaultChecked className="w-3.5 h-3.5 rounded border-border" />
                Invoices
              </label>
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm"><Share2 className="w-3.5 h-3.5" /> Generate Link</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </form>
      )}

      {grants.length > 0 ? (
        <div className="space-y-2">
          {grants.map((grant) => (
            <div key={grant.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50">
              <div>
                <p className="text-[12px] font-medium text-foreground">{grant.name || grant.email}</p>
                <p className="text-[11px] text-muted-foreground">{grant.email} • Shared {new Date(grant.createdAt).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => copyLink(grant.token)}
                  className="h-7 px-2.5 rounded-lg bg-muted text-[11px] font-medium text-foreground hover:bg-muted/80 transition-colors flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" />
                  {copiedToken === grant.token ? "Copied!" : "Copy Link"}
                </button>
                <form action={async () => { await revokeDealAccess(grant.id, deal.id); }}>
                  <button type="submit" className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      ) : !showForm ? (
        <p className="text-[12px] text-muted-foreground">
          No one has access yet. Share this deal to give your client a view of the project.
        </p>
      ) : null}
    </Section>
  );
}

/* ─── Shared ────────────────────────────────────────────────────────────────── */

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
