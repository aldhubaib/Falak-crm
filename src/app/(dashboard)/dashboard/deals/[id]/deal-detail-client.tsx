"use client";

import { useState } from "react";
import { moveDeal, addDealItem, removeDealItem, createProjectFromDeal } from "@/actions/deals";
import { ArrowLeft, Plus, Trash2, Rocket, X, Check } from "lucide-react";
import Link from "next/link";

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
  notes: string | null;
  stage: Stage;
  pipeline: { stages: Stage[] };
  company: { id: string; name: string } | null;
  contact: { id: string; name: string; whatsappNumber: string | null } | null;
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
            {deal.company?.name || "No company"} • {Number(deal.value).toLocaleString()} SAR
          </p>
        </div>
        {isWon && !deal.project && (
          <form action={createProjectFromDeal.bind(null, deal.id)}>
            <button
              type="submit"
              className="h-8 px-3 rounded-lg bg-success text-success-foreground text-[13px] font-medium hover:bg-success/90 transition-colors flex items-center gap-1.5"
            >
              <Rocket className="w-3.5 h-3.5" />
              Create Project
            </button>
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
                  onClick={() => {
                    if (!isClosed) moveDeal(deal.id, stage.id);
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
              action={async (formData) => {
                await addDealItem(deal.id, formData);
                setShowAddItem(false);
              }}
              className="mb-3 p-3 rounded-lg bg-muted/50 space-y-2"
            >
              <select
                name="serviceId"
                required
                className="w-full h-8 px-2 rounded-lg bg-input border border-border text-[12px] text-foreground"
                onChange={(e) => {
                  const s = services.find((s) => s.id === e.target.value);
                  const priceInput = e.target.form?.querySelector<HTMLInputElement>('[name="unitPrice"]');
                  if (s && priceInput) priceInput.value = String(s.unitPrice);
                }}
              >
                <option value="">Select service...</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.unitPrice.toLocaleString()} SAR)
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input
                  name="quantity"
                  type="number"
                  defaultValue="1"
                  min="1"
                  className="h-8 px-2 rounded-lg bg-input border border-border text-[12px] text-foreground"
                />
                <input
                  name="unitPrice"
                  type="number"
                  step="0.01"
                  placeholder="Price"
                  className="h-8 px-2 rounded-lg bg-input border border-border text-[12px] text-foreground"
                />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="h-7 px-3 rounded-lg bg-primary text-[11px] text-primary-foreground font-medium">
                  Add
                </button>
                <button type="button" onClick={() => setShowAddItem(false)} className="h-7 px-3 rounded-lg bg-muted text-[11px] text-muted-foreground">
                  Cancel
                </button>
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
                      {item.quantity} × {Number(item.unitPrice).toLocaleString()} SAR
                    </p>
                  </div>
                  {!isClosed && (
                    <form action={removeDealItem.bind(null, item.id, deal.id)}>
                      <button type="submit" className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </form>
                  )}
                </div>
              ))}
              <div className="pt-2 border-t border-border flex justify-between text-[13px] font-medium">
                <span className="text-muted-foreground">Total</span>
                <span className="text-foreground">{Number(deal.value).toLocaleString()} SAR</span>
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
              <dd className="text-foreground">{deal.contact?.name || "—"}</dd>
            </div>
            {deal.contact?.whatsappNumber && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">WhatsApp</dt>
                <dd className="text-foreground">{deal.contact.whatsappNumber}</dd>
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
