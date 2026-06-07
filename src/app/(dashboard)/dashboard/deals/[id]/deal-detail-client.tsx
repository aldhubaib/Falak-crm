"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { moveDeal, addDealItem, removeDealItem, createProjectFromDeal } from "@/actions/deals";
import { createTask, updateTaskStatus, deleteTask, updateProjectStatus } from "@/actions/projects";
import { createInvoiceFromProject } from "@/actions/invoices";
import { shareDealWithClient, revokeDealAccess } from "@/actions/deal-access";
import { ArrowLeft, Plus, Trash2, Rocket, Check, FileText, FolderKanban, LayoutList, Receipt, Info, Share2, Copy, X } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FormSelect } from "@/components/ui/form-select";
import { useErrorStore } from "@/lib/error-store";

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

const TABS = [
  { id: "overview", label: "Overview", icon: Info },
  { id: "services", label: "Services", icon: LayoutList },
  { id: "project", label: "Project", icon: FolderKanban },
  { id: "invoices", label: "Invoices", icon: Receipt },
  { id: "share", label: "Share", icon: Share2 },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function DealDetailClient({
  deal,
  services,
  taskStatuses,
  projectStatuses,
  initialTab,
}: {
  deal: Deal;
  services: ServiceOption[];
  taskStatuses: TaskStatus[];
  projectStatuses: ProjectStatus[];
  initialTab?: string;
}) {
  const router = useRouter();
  const isWon = deal.stage.type === "WON";
  const isLost = deal.stage.type === "LOST";
  const isClosed = isWon || isLost;
  const stages = deal.pipeline.stages;
  const currentIndex = stages.findIndex((s) => s.id === deal.stage.id);

  const defaultTab = initialTab && TABS.some((t) => t.id === initialTab) ? initialTab as TabId : "overview";
  const [activeTab, setActiveTab] = useState<TabId>(defaultTab);

  const visibleTabs = TABS.filter((tab) => {
    if (tab.id === "project") return isWon;
    if (tab.id === "invoices") return deal.project !== null;
    if (tab.id === "share") return isWon;
    return true;
  });

  function switchTab(tabId: TabId) {
    setActiveTab(tabId);
    router.replace(`/dashboard/deals/${deal.id}?tab=${tabId}`, { scroll: false });
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-3 h-12 mb-4">
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
        {isWon && !deal.project && (
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

      {/* Stage Progress */}
      <div className="rounded-xl border border-border bg-card p-4 mb-4">
        <div className="flex items-center gap-1">
          {stages.map((stage, idx) => {
            const isPast = idx < currentIndex;
            const isCurrent = idx === currentIndex;
            return (
              <div key={stage.id} className="flex-1">
                <button
                  disabled={isClosed || idx === currentIndex}
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

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1 mb-6 border-b border-border">
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => switchTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-[13px] font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <OverviewTab deal={deal} />
      )}
      {activeTab === "services" && (
        <ServicesTab deal={deal} services={services} isClosed={isClosed} />
      )}
      {activeTab === "project" && (
        <ProjectTab deal={deal} services={services} taskStatuses={taskStatuses} projectStatuses={projectStatuses} />
      )}
      {activeTab === "invoices" && (
        <InvoicesTab deal={deal} />
      )}
      {activeTab === "share" && (
        <ShareTab deal={deal} />
      )}
    </div>
  );
}

function OverviewTab({ deal }: { deal: Deal }) {
  return (
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
            <dt className="text-muted-foreground">Value</dt>
            <dd className="text-foreground font-medium">{Number(deal.value).toLocaleString()} {deal.currency || "KWD"}</dd>
          </div>
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

      {deal.project && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-[13px] font-medium text-foreground mb-3">Project Summary</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Status</dt>
              <dd className="text-foreground flex items-center gap-1.5">
                {deal.project.status && (
                  <>
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: deal.project.status.color }} />
                    {deal.project.status.name}
                  </>
                )}
              </dd>
            </div>
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
  );
}

function ServicesTab({
  deal,
  services,
  isClosed,
}: {
  deal: Deal;
  services: ServiceOption[];
  isClosed: boolean;
}) {
  const [showAddItem, setShowAddItem] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-card p-4 max-w-2xl">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[13px] font-medium text-foreground">Services</h3>
        {!isClosed && (
          <button
            onClick={() => setShowAddItem(true)}
            className="text-[11px] text-primary hover:text-primary/80 flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> Add
          </button>
        )}
      </div>

      {showAddItem && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const result = await addDealItem(deal.id, formData);
            if (!result.ok) { useErrorStore.getState().push(result.error); return; }
            setShowAddItem(false);
          }}
          className="mb-3 p-3 rounded-lg bg-muted/50 space-y-2"
        >
          <FormSelect
            name="serviceId"
            label="Service"
            required
            placeholder="Select service..."
            options={services.map((s) => ({
              value: s.id,
              label: `${s.name} (${s.unitPrice.toLocaleString()} ${deal.currency || "KWD"})`,
            }))}
            onChange={(val) => {
              const s = services.find((s) => s.id === val);
              const priceInput = document.querySelector<HTMLInputElement>('[name="unitPrice"]');
              if (s && priceInput) priceInput.value = String(s.unitPrice);
            }}
          />
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-black border border-border px-3 pt-2 pb-1.5 focus-within:border-ring transition-colors">
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Quantity</label>
              <input
                name="quantity"
                type="number"
                defaultValue="1"
                min="1"
                className="w-full h-8 bg-transparent border-none text-[13px] text-foreground focus:outline-none"
              />
            </div>
            <div className="rounded-lg bg-black border border-border px-3 pt-2 pb-1.5 focus-within:border-ring transition-colors">
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Unit Price</label>
              <input
                name="unitPrice"
                type="number"
                step="0.01"
                placeholder="0.00"
                className="w-full h-8 bg-transparent border-none text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm"><Plus className="w-3.5 h-3.5" /> Add</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddItem(false)}>Cancel</Button>
          </div>
        </form>
      )}

      {deal.items.length === 0 ? (
        <p className="text-[12px] text-muted-foreground">No services added yet</p>
      ) : (
        <div className="space-y-2">
          {deal.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
              <div>
                <p className="text-[12px] text-foreground">{item.service.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {item.quantity} × {Number(item.unitPrice).toLocaleString()} {deal.currency || "KWD"}
                </p>
              </div>
              {!isClosed && (
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  const result = await removeDealItem(item.id, deal.id);
                  if (!result.ok) useErrorStore.getState().push(result.error);
                }}>
                  <button type="submit" className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </form>
              )}
            </div>
          ))}
          <div className="pt-2 border-t border-border flex justify-between text-[13px] font-medium">
            <span className="text-muted-foreground">Total</span>
            <span className="text-foreground">{Number(deal.value).toLocaleString()} {deal.currency || "KWD"}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectTab({
  deal,
  services,
  taskStatuses,
  projectStatuses,
}: {
  deal: Deal;
  services: ServiceOption[];
  taskStatuses: TaskStatus[];
  projectStatuses: ProjectStatus[];
}) {
  const [showAddTask, setShowAddTask] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const project = deal.project;

  if (!project) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <FolderKanban className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">
          Click &quot;Start Project&quot; to begin the delivery phase for this deal.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Project Status */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[13px] font-medium text-foreground">Project Status</h3>
        <FormSelect
          name="_projectStatus"
          value={project.status?.id || ""}
          options={projectStatuses.map((s) => ({ value: s.id, label: s.name }))}
          onChange={(val) => updateProjectStatus(project.id, val, deal.id)}
        />
      </div>

      {/* Tasks */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[13px] font-medium text-foreground">
            Tasks ({project.tasks.length})
          </h3>
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
              await createTask(project.id, formData, deal.id);
              setShowAddTask(false);
            }}
            className="mb-4 p-3 rounded-lg bg-muted/50 space-y-2"
          >
            <div className="rounded-lg bg-black border border-border px-3 pt-2 pb-1.5 focus-within:border-ring transition-colors">
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Title <span className="text-destructive">*</span></label>
              <input
                name="title"
                placeholder="Task title"
                required
                className="w-full h-8 bg-transparent border-none text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <FormSelect
                name="serviceId"
                label="Service"
                placeholder="No service"
                options={services.map((s) => ({ value: s.id, label: s.name }))}
              />
              <div className="rounded-lg bg-black border border-border px-3 pt-2 pb-1.5 focus-within:border-ring transition-colors">
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Price</label>
                <input name="price" type="number" step="0.01" placeholder="0.00" className="w-full h-8 bg-transparent border-none text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none" />
              </div>
              <FormSelect
                name="statusId"
                label="Status"
                value={taskStatuses[0]?.id || ""}
                options={taskStatuses.map((s) => ({ value: s.id, label: s.name }))}
              />
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
                <FormSelect
                  name={`taskStatus_${task.id}`}
                  value={task.status?.id || ""}
                  options={taskStatuses.map((s) => ({ value: s.id, label: s.name }))}
                  onChange={(val) => updateTaskStatus(task.id, val, project.id, deal.id)}
                />
                <form action={deleteTask.bind(null, task.id, project.id, deal.id)}>
                  <button type="submit" className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InvoicesTab({ deal }: { deal: Deal }) {
  const project = deal.project;

  if (!project || project.invoices.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <Receipt className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">
          Complete billable tasks, then select them from the Project tab to create an invoice.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-w-2xl">
      {project.invoices.map((invoice) => (
        <Link
          key={invoice.id}
          href={`/dashboard/invoices/${invoice.id}`}
          className="rounded-xl border border-border bg-card p-4 flex items-center justify-between hover:border-primary/30 transition-colors no-underline block"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-orange/15 flex items-center justify-center">
              <FileText className="w-4 h-4 text-orange" />
            </div>
            <div>
              <h3 className="text-[13px] font-medium text-foreground">{invoice.number}</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {new Date(invoice.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[13px] font-semibold text-foreground">
              {Number(invoice.total).toLocaleString()} {invoice.currency || "KWD"}
            </p>
            <InvoiceStatusBadge status={invoice.status} />
          </div>
        </Link>
      ))}
    </div>
  );
}

function ShareTab({ deal }: { deal: Deal }) {
  const [showForm, setShowForm] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const grants = deal.accessGrants || [];

  async function handleShare(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const result = await shareDealWithClient(deal.id, formData);
    if (result.ok) {
      setShowForm(false);
    }
  }

  function copyLink(token: string) {
    const url = `${window.location.origin}/portal/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-[13px] font-medium text-foreground">Client Access</h3>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            Share a portal link with your client so they can see project progress and invoices.
          </p>
        </div>
        {!showForm && (
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Share2 className="w-3.5 h-3.5" /> Share
          </Button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleShare} className="rounded-xl border border-border bg-card p-4 mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-black border border-border px-3 pt-2 pb-1.5 focus-within:border-ring transition-colors">
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Email <span className="text-destructive">*</span>
              </label>
              <input
                name="email"
                type="email"
                required
                placeholder="client@company.com"
                className="w-full h-8 bg-transparent border-none text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
              />
            </div>
            <div className="rounded-lg bg-black border border-border px-3 pt-2 pb-1.5 focus-within:border-ring transition-colors">
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Name</label>
              <input
                name="name"
                placeholder="Client name"
                className="w-full h-8 bg-transparent border-none text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
              />
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

      {/* Existing grants */}
      {grants.length > 0 && (
        <div className="space-y-2">
          {grants.map((grant) => (
            <div key={grant.id} className="rounded-xl border border-border bg-card p-3 flex items-center justify-between">
              <div>
                <p className="text-[13px] font-medium text-foreground">
                  {grant.name || grant.email}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {grant.email} • Shared {new Date(grant.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => copyLink(grant.token)}
                  className="h-7 px-2.5 rounded-lg bg-muted text-[11px] font-medium text-foreground hover:bg-muted/80 transition-colors flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" />
                  {copiedToken === grant.token ? "Copied!" : "Copy Link"}
                </button>
                <form action={async () => {
                  await revokeDealAccess(grant.id, deal.id);
                }}>
                  <button type="submit" className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}

      {grants.length === 0 && !showForm && (
        <div className="rounded-xl border border-border bg-card p-6 text-center">
          <Share2 className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-[12px] text-muted-foreground">
            No one has access yet. Share this deal to give your client a view of the project.
          </p>
        </div>
      )}
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
