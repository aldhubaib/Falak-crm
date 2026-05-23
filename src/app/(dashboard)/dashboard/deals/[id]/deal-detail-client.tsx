"use client";

import { useState } from "react";
import { moveDeal, addDealItem, removeDealItem, createProjectFromDeal } from "@/actions/deals";
import { ArrowLeft, Plus, Trash2, Rocket, X, Check } from "lucide-react";
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
  project: { id: string } | null;
  lostReason: string | null;
  closedAt: Date | null;
  createdAt: Date;
};

type ServiceOption = { id: string; name: string; unitPrice: number };

export function DealDetailClient({
  deal,
  services,
}: {
  deal: Deal;
  services: ServiceOption[];
}) {
  const [showAddItem, setShowAddItem] = useState(false);

  const isWon = deal.stage.type === "WON";
  const isLost = deal.stage.type === "LOST";
  const isClosed = isWon || isLost;
  const stages = deal.pipeline.stages;
  const currentIndex = stages.findIndex((s) => s.id === deal.stage.id);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-3 h-12 mb-6">
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
              Create Project
            </Button>
          </form>
        )}
      </div>

      {/* Stage Progress */}
      <div className="rounded-xl border border-border bg-card p-4 mb-6">
        <h3 className="text-[12px] font-medium text-muted-foreground mb-3">Pipeline Progress</h3>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Deal Items / Services */}
        <div className="rounded-xl border border-border bg-card p-4">
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
                <Button type="submit" size="sm">Add</Button>
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

        {/* Deal Info */}
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

          {deal.project && (
            <Link
              href={`/dashboard/projects/${deal.project.id}`}
              className="mt-4 w-full h-9 rounded-lg bg-primary/15 text-primary text-[13px] font-medium flex items-center justify-center no-underline hover:bg-primary/25 transition-colors"
            >
              View Project
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
