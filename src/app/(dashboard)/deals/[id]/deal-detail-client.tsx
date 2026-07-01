"use client";

import { useState, useRef } from "react";
import { moveDeal, addDealItem, removeDealItem, updateDealDiscount, createProjectFromDeal } from "@/actions/deals";
import { ArrowLeft, Check, X, ChevronDown, GripVertical, Rocket } from "lucide-react";
import { HeaderActions } from "@/components/header-actions";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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
  discountType: string;
  discountValue: unknown;
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
  const permissions = usePermissions();
  const router = useRouter();
  const isWon = deal.stage.type === "WON";
  const isLost = deal.stage.type === "LOST";
  const isClosed = isWon || isLost;
  const stages = deal.pipeline.stages;
  const currentIndex = stages.findIndex((s) => s.id === deal.stage.id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 h-12 border-b border-border/50 shrink-0">
        <Link
          href="/deals"
          className="w-icon-btn h-icon-btn rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card transition-colors shrink-0"
        >
          <ArrowLeft className="w-icon-sm h-icon-sm" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-body font-semibold text-foreground truncate leading-tight">{deal.title}</h1>
          <p className="text-label text-muted-foreground truncate">
            {deal.company?.name || "No company"} • {Number(deal.value).toLocaleString()} {deal.currency || "KWD"}
          </p>
        </div>
        {deal.project ? (
          <Link
            href={`/projects/${deal.project.id}`}
            className="min-h-touch px-2.5 rounded-lg bg-purple/15 text-sub font-medium text-purple hover:bg-purple/25 transition-colors flex items-center gap-1.5 no-underline shrink-0"
          >
            View Project
          </Link>
        ) : isWon && permissions.projects !== "none" ? (
          <Button
            size="sm"
            onClick={async () => {
              const result = await createProjectFromDeal(deal.id);
              if (result.ok) {
                router.push(`/projects/${result.data.projectId}`);
              } else {
                useErrorStore.getState().push(result.error);
              }
            }}
          >
            <Rocket className="w-icon-sm h-icon-sm" />
            Start Project
          </Button>
        ) : null}
        <HeaderActions />
      </div>

      <div className="p-6 space-y-6">
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
                    className={`w-full min-h-touch rounded-lg text-sub font-medium transition-colors flex items-center justify-center gap-1 ${
                      isCurrent
                        ? "text-white"
                        : isPast
                        ? "bg-muted text-foreground"
                        : "bg-muted/50 text-muted-foreground hover:bg-muted"
                    }`}
                    style={isCurrent ? { backgroundColor: stage.color } : undefined}
                  >
                    {isPast && <Check className="w-icon-sm h-icon-sm" />}
                    {stage.name}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Details */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-body font-medium text-foreground mb-3">Details</h3>
        <dl className="grid grid-cols-1 @lg:grid-cols-2 gap-x-8 gap-y-2 text-sub">
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
            <div className="flex justify-between @lg:col-span-2">
              <dt className="text-muted-foreground">Lost Reason</dt>
              <dd className="text-foreground">{deal.lostReason}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Price Table */}
      {permissions.deals !== "none" && (
        <ServicesSection deal={deal} services={services} isClosed={isClosed} canEdit={permissions.deals === "full"} />
      )}
      </div>
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
      <div className="flex items-center justify-between p-4">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 text-left"
        >
          <ChevronDown className={`w-icon-md h-icon-md text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`} />
          <h3 className="text-body font-medium text-foreground">
            {title}
            {count !== undefined && (
              <span className="text-muted-foreground font-normal ml-1">({count})</span>
            )}
          </h3>
        </button>
        {actions && <div>{actions}</div>}
      </div>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

/* ─── Price Table ───────────────────────────────────────────────────────────── */

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
  const canAdd = !isClosed && canEditServices;
  const currency = deal.currency || "KWD";

  const subtotal = deal.items.reduce(
    (sum, item) => sum + Number(item.unitPrice) * item.quantity,
    0
  );

  return (
    <Section title="Price Table" count={deal.items.length}>
      <div className="border border-border rounded-lg">
        <div className="grid grid-cols-[24px_1fr_100px_100px_100px_32px] gap-0 bg-muted/50 text-label font-medium text-muted-foreground uppercase tracking-wider">
          <div />
          <div className="px-3 py-2.5">Item Details</div>
          <div className="px-3 py-2.5 text-right">Quantity</div>
          <div className="px-3 py-2.5 text-right">Rate</div>
          <div className="px-3 py-2.5 text-right">Amount</div>
          <div />
        </div>

        {deal.items.map((item) => (
          <ItemRow key={item.id} item={item} dealId={deal.id} canEdit={canAdd} />
        ))}

        {canAdd && (
          <NewItemRow dealId={deal.id} services={services} currency={currency} />
        )}
      </div>

      <DiscountAndTotals deal={deal} subtotal={subtotal} currency={currency} canEdit={canAdd} />
    </Section>
  );
}

function ItemRow({ item, dealId, canEdit }: { item: DealItem; dealId: string; canEdit: boolean }) {
  const amount = Number(item.unitPrice) * item.quantity;

  return (
    <div className="grid grid-cols-[24px_1fr_100px_100px_100px_32px] gap-0 border-t border-border items-center group">
      <div className="flex justify-center text-muted-foreground/30 cursor-grab">
        <GripVertical className="w-icon-sm h-icon-sm" />
      </div>
      <div className="px-3 py-2.5">
        <p className="text-body text-foreground font-medium">{item.service.name}</p>
        {item.description && (
          <p className="text-sub text-muted-foreground mt-0.5">{item.description}</p>
        )}
      </div>
      <div className="px-3 py-2.5 text-right text-body text-foreground tabular-nums">
        {item.quantity.toFixed(2)}
      </div>
      <div className="px-3 py-2.5 text-right text-body text-foreground tabular-nums">
        {Number(item.unitPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}
      </div>
      <div className="px-3 py-2.5 text-right text-body text-foreground font-medium tabular-nums">
        {amount.toLocaleString(undefined, { minimumFractionDigits: 3 })}
      </div>
      <div className="flex justify-center">
        {canEdit && (
          <form onSubmit={async (e) => {
            e.preventDefault();
            const result = await removeDealItem(item.id, dealId);
            if (!result.ok) useErrorStore.getState().push(result.error);
          }}>
            <button type="submit" className="w-icon-btn h-icon-btn rounded flex items-center justify-center text-muted-foreground hover:text-destructive opacity-100 [@media(pointer:fine)]:opacity-0 [@media(pointer:fine)]:group-hover:opacity-100 transition-opacity">
              <X className="w-icon-sm h-icon-sm" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function NewItemRow({
  dealId,
  services,
  currency,
}: {
  dealId: string;
  services: ServiceOption[];
  currency: string;
}) {
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [qty, setQty] = useState("1.00");
  const [rate, setRate] = useState("0.00");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = services.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const amount = (parseFloat(qty) || 0) * (parseFloat(rate) || 0);

  async function handleSelectService(service: ServiceOption) {
    setSearch(service.name);
    setRate(String(service.unitPrice));
    setShowDropdown(false);

    setSaving(true);
    const formData = new FormData();
    formData.set("serviceId", service.id);
    formData.set("quantity", qty);
    formData.set("unitPrice", String(service.unitPrice));
    const result = await addDealItem(dealId, formData);
    if (!result.ok) useErrorStore.getState().push(result.error);
    setSaving(false);

    setSearch("");
    setQty("1.00");
    setRate("0.00");
  }

  return (
    <div className="grid grid-cols-[24px_1fr_100px_100px_100px_32px] gap-0 border-t border-border items-center">
      <div className="flex justify-center text-muted-foreground/20">
        <GripVertical className="w-icon-sm h-icon-sm" />
      </div>
      <div className="px-3 py-2.5 relative">
        <input
          ref={inputRef}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setShowDropdown(true); }}
          onFocus={() => setShowDropdown(true)}
          placeholder="Type or click to select an item."
          disabled={saving}
          className="w-full text-body bg-transparent text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
        />
        {showDropdown && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />
            <div className="absolute z-50 left-0 right-0 top-full mt-1 rounded-lg border border-border bg-black shadow-lg overflow-hidden">
              <div className="max-h-[240px] overflow-y-auto">
                {filtered.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleSelectService(s)}
                    className="w-full px-3 py-2.5 text-left hover:bg-muted/30 transition-colors"
                  >
                    <p className="text-body text-foreground font-medium">{s.name}</p>
                    <p className="text-sub text-muted-foreground">
                      Rate: {currency}{s.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 3 })}
                    </p>
                  </button>
                ))}
                {filtered.length === 0 && (
                  <p className="px-3 py-3 text-sub text-muted-foreground">No items found.</p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
      <div className="px-3 py-2.5 text-right text-body text-muted-foreground/40 tabular-nums">{qty}</div>
      <div className="px-3 py-2.5 text-right text-body text-muted-foreground/40 tabular-nums">{parseFloat(rate).toFixed(2)}</div>
      <div className="px-3 py-2.5 text-right text-body text-muted-foreground/40 tabular-nums">{amount.toFixed(3)}</div>
      <div />
    </div>
  );
}

function DiscountAndTotals({
  deal,
  subtotal,
  currency,
  canEdit,
}: {
  deal: Deal;
  subtotal: number;
  currency: string;
  canEdit: boolean;
}) {
  const [discType, setDiscType] = useState(deal.discountType || "percent");
  const [discValue, setDiscValue] = useState(String(Number(deal.discountValue) || 0));
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const discNum = parseFloat(discValue) || 0;
  const discountAmount = discType === "percent" ? subtotal * (discNum / 100) : discNum;
  const total = Math.max(0, subtotal - discountAmount);

  const saveDiscount = async (type: string, value: string) => {
    const result = await updateDealDiscount(deal.id, type, parseFloat(value) || 0);
    if (!result.ok) useErrorStore.getState().push(result.error);
  };

  return (
    <div className="mt-4 flex justify-end">
      <div className="w-[340px] space-y-2.5">
        <div className="flex justify-between items-center text-body">
          <span className="text-muted-foreground">Sub Total</span>
          <span className="text-foreground tabular-nums">
            {subtotal.toLocaleString(undefined, { minimumFractionDigits: 3 })}
          </span>
        </div>

        <div className="flex justify-between items-center text-body">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Discount</span>
            {canEdit && (
              <div className="flex items-center rounded-md border border-border">
                <input
                  type="number"
                  value={discValue}
                  onChange={(e) => setDiscValue(e.target.value)}
                  onBlur={() => saveDiscount(discType, discValue)}
                  onKeyDown={(e) => { if (e.key === "Enter") saveDiscount(discType, discValue); }}
                  className="w-14 h-input px-2 text-sub text-foreground bg-background text-right tabular-nums focus:outline-none"
                />
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="h-input px-2 text-sub text-muted-foreground bg-muted/50 border-l border-border hover:bg-muted transition-colors flex items-center gap-0.5"
                  >
                    {discType === "percent" ? "%" : currency}
                    <ChevronDown className="w-2.5 h-2.5" />
                  </button>
                  {dropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
                      <div className="absolute z-50 right-0 top-full mt-1 rounded-md border border-border bg-black shadow-lg overflow-hidden">
                        <button
                          type="button"
                          onClick={() => { setDiscType("percent"); setDropdownOpen(false); saveDiscount("percent", discValue); }}
                          className={`w-full px-3 min-h-touch text-sub text-left hover:bg-muted/30 transition-colors flex items-center ${discType === "percent" ? "text-primary bg-primary/10" : "text-foreground"}`}
                        >
                          %
                        </button>
                        <button
                          type="button"
                          onClick={() => { setDiscType("fixed"); setDropdownOpen(false); saveDiscount("fixed", discValue); }}
                          className={`w-full px-3 min-h-touch text-sub text-left hover:bg-muted/30 transition-colors flex items-center ${discType === "fixed" ? "text-primary bg-primary/10" : "text-foreground"}`}
                        >
                          {currency}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
          <span className="text-foreground tabular-nums">
            {discountAmount > 0 ? "-" : ""}{discountAmount.toLocaleString(undefined, { minimumFractionDigits: 3 })}
          </span>
        </div>

        <div className="flex justify-between items-center text-body font-semibold pt-2 border-t border-border">
          <span className="text-foreground">Total ({currency})</span>
          <span className="text-foreground tabular-nums">
            {total.toLocaleString(undefined, { minimumFractionDigits: 3 })}
          </span>
        </div>
      </div>
    </div>
  );
}
