"use client";

// New Invoice form matching the Lovable design: deal/project/date/currency
// fields, an editable item table with a service picker, and a totals panel
// with discount. Saves as draft or sends immediately.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarIcon,
  Copy,
  GripVertical,
  MoreVertical,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useAction } from "@/hooks/use-action";
import { createInvoiceDetailed, type NewInvoiceInput } from "@/actions/invoices";
import { createService } from "@/actions/services";

type DealOption = {
  id: string;
  title: string;
  companyName: string | null;
  project: { id: string; name: string } | null;
};
type ServiceOption = {
  id: string;
  name: string;
  description: string | null;
  unitPrice: number;
};

type DraftItem = {
  id: string;
  title: string;
  description: string;
  qty: string;
  rate: string;
  taxPct: string;
  serviceId?: string;
};

function newItem(): DraftItem {
  return {
    id: `li_${Math.random().toString(36).slice(2, 9)}`,
    title: "",
    description: "",
    qty: "1",
    rate: "0",
    taxPct: "",
  };
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

const CURRENCY_TO_COUNTRY: Record<string, string> = {
  KWD: "KW",
  USD: "US",
  EUR: "EU",
  GBP: "GB",
  SAR: "SA",
  AED: "AE",
  QAR: "QA",
  BHD: "BH",
  OMR: "OM",
  EGP: "EG",
  JPY: "JP",
  CNY: "CN",
  INR: "IN",
  CAD: "CA",
  AUD: "AU",
  CHF: "CH",
  TRY: "TR",
};

function currencyFlag(code: string): string {
  const cc =
    CURRENCY_TO_COUNTRY[code.toUpperCase()] ?? code.slice(0, 2).toUpperCase();
  if (cc === "EU") return "🇪🇺";
  if (!/^[A-Z]{2}$/.test(cc)) return "🏳️";
  return String.fromCodePoint(
    ...[...cc].map((ch) => 0x1f1e6 + (ch.charCodeAt(0) - 65)),
  );
}

function formatMoney(currency: string, amount: number): string {
  return `${currency}${amount.toLocaleString(undefined, {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })}`;
}

function skuFor(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("")
      .slice(0, 4) || "—"
  );
}

export function NewInvoiceClient({
  nextNumber,
  baseCurrency,
  deals,
  services: initialServices,
  currencies,
}: {
  nextNumber: string;
  baseCurrency: string;
  deals: DealOption[];
  services: ServiceOption[];
  currencies: { code: string; name: string }[];
}) {
  const router = useRouter();

  const [dealId, setDealId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [issueDate, setIssueDate] = useState(() => isoDate(new Date()));
  const [dueDate, setDueDate] = useState(() => addDays(14));
  const [currency, setCurrency] = useState(baseCurrency);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<DraftItem[]>([newItem()]);
  const [discountValue, setDiscountValue] = useState("0");
  const [discountMode, setDiscountMode] = useState<"percent" | "fixed">(
    "percent",
  );
  const [services, setServices] = useState(initialServices);
  const [itemPickerOpen, setItemPickerOpen] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const { execute: submitInvoice, loading: saving } = useAction(
    (input: NewInvoiceInput) => createInvoiceDetailed(input),
  );

  const selectedDeal = deals.find((d) => d.id === dealId) ?? null;
  const dealProject = selectedDeal?.project ?? null;

  const rows = useMemo(
    () =>
      items.map((it) => {
        const qty = Number(it.qty) || 0;
        const rate = Number(it.rate) || 0;
        const tax = Number(it.taxPct) || 0;
        const base = qty * rate;
        return { id: it.id, base, amount: base + (base * tax) / 100 };
      }),
    [items],
  );
  const subTotal = rows.reduce((s, r) => s + r.base, 0);
  const taxTotal = rows.reduce((s, r) => s + (r.amount - r.base), 0);
  const discountInput = Number(discountValue) || 0;
  const discountAmount =
    discountMode === "percent"
      ? (subTotal * discountInput) / 100
      : Math.min(discountInput, subTotal);
  const total = subTotal + taxTotal - discountAmount;

  function updateItem(id: string, patch: Partial<DraftItem>) {
    setItems((xs) => xs.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }
  function removeItem(id: string) {
    setItems((xs) => (xs.length === 1 ? xs : xs.filter((it) => it.id !== id)));
  }
  function duplicateItem(id: string) {
    setItems((xs) => {
      const idx = xs.findIndex((it) => it.id === id);
      if (idx === -1) return xs;
      const copy: DraftItem = {
        ...xs[idx],
        id: `li_${Math.random().toString(36).slice(2, 9)}`,
      };
      const next = xs.slice();
      next.splice(idx + 1, 0, copy);
      return next;
    });
  }
  function reorderItems(fromId: string, toId: string) {
    if (fromId === toId) return;
    setItems((xs) => {
      const from = xs.findIndex((it) => it.id === fromId);
      const to = xs.findIndex((it) => it.id === toId);
      if (from === -1 || to === -1) return xs;
      const next = xs.slice();
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }
  function pickService(itemId: string, service: ServiceOption) {
    updateItem(itemId, {
      title: service.name,
      description: service.description ?? "",
      rate: String(service.unitPrice),
      serviceId: service.id,
    });
    setItemPickerOpen(null);
  }
  function clearItem(itemId: string) {
    updateItem(itemId, {
      title: "",
      description: "",
      rate: "0",
      serviceId: undefined,
    });
  }
  async function addNewItemFromQuery(itemId: string, query: string) {
    const name = query.trim();
    if (!name) return;
    const fd = new FormData();
    fd.set("name", name);
    fd.set("unitPrice", "0");
    const result = await createService(fd);
    if (!result.ok) return;
    const service: ServiceOption = {
      id: result.data.id,
      name,
      description: null,
      unitPrice: 0,
    };
    setServices((xs) => [...xs, service].sort((a, b) => a.name.localeCompare(b.name)));
    pickService(itemId, service);
  }

  const hasLineItem = items.some((it) => it.title.trim());
  const canSave = !!dealId && hasLineItem;

  async function save(send: boolean) {
    if (saving || !canSave) return;
    const cleaned = items
      .filter((it) => it.title.trim())
      .map((it) => ({
        title: it.title.trim(),
        details: it.description.trim() || undefined,
        qty: Number(it.qty) || 0,
        rate: Number(it.rate) || 0,
        taxPct: Number(it.taxPct) || undefined,
      }));
    const result = await submitInvoice({
      dealId,
      projectId: projectId || null,
      issueDate,
      dueDate,
      currency,
      notes: notes.trim() || undefined,
      discountType: discountMode,
      discountValue: discountInput,
      items: cleaned,
      send,
    });
    if (result) router.push(`/invoices/${result.id}`);
  }

  return (
    <>
      <AppHeader
        title="New Invoice"
        backHref="/invoices"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              disabled={saving || !canSave}
              onClick={() => save(false)}
            >
              Save as Draft
            </Button>
            <Button
              size="sm"
              className="rounded-full"
              disabled={saving || !canSave}
              onClick={() => save(true)}
            >
              Save &amp; Send
            </Button>
          </div>
        }
      />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl px-4 py-6 pb-16 sm:px-6">
          <div className="mb-6">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">
              New Invoice
            </div>
            <div className="mt-1 text-2xl font-semibold">{nextNumber}</div>
          </div>

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Deal" required>
              <Select
                value={dealId}
                onValueChange={(v) => {
                  setDealId(v);
                  setProjectId("");
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a deal" />
                </SelectTrigger>
                <SelectContent>
                  {deals.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      No deals available
                    </div>
                  ) : (
                    deals.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.title}
                        {d.companyName ? ` · ${d.companyName}` : ""}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Project">
              <Select
                value={projectId}
                onValueChange={setProjectId}
                disabled={!dealId || !dealProject}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={
                      !dealId
                        ? "Select a deal first"
                        : !dealProject
                          ? "No projects for this deal"
                          : "Select a project"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {dealProject && (
                    <SelectItem value={dealProject.id}>
                      {dealProject.name}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Invoice Date">
              <DateField value={issueDate} onChange={setIssueDate} />
            </Field>
            <Field label="Due Date">
              <DateField value={dueDate} onChange={setDueDate} />
            </Field>
            <Field label="Currency">
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </section>

          <section className="mt-8 overflow-hidden rounded-xl border border-border/60 bg-surface">
            <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
              <div className="text-sm font-semibold">Item Table</div>
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label={`Currency: ${currency}`}
                  className="grid h-9 w-9 place-items-center overflow-hidden rounded-full border border-border/60 bg-background text-lg leading-none transition-colors hover:border-primary/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                >
                  <span aria-hidden>{currencyFlag(currency)}</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[10rem]">
                  {currencies.map((c) => (
                    <DropdownMenuItem
                      key={c.code}
                      onSelect={() => setCurrency(c.code)}
                      className="gap-2"
                    >
                      <span className="text-base leading-none" aria-hidden>
                        {currencyFlag(c.code)}
                      </span>
                      <span className="font-medium">{c.code}</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {c.name}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/30 text-tiny font-medium uppercase tracking-wider text-muted-foreground">
                    <th className="w-8" />
                    <th className="px-3 py-2 text-left">Item Details</th>
                    <th className="w-28 px-3 py-2 text-right">Quantity</th>
                    <th className="w-32 px-3 py-2 text-right">Rate</th>
                    <th className="w-24 px-3 py-2 text-right">Tax %</th>
                    <th className="w-32 px-3 py-2 text-right">Amount</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => {
                    const row = rows.find((r) => r.id === it.id)!;
                    const q = it.title.trim().toLowerCase();
                    const filtered = q
                      ? services.filter((s) =>
                          s.name.toLowerCase().includes(q),
                        )
                      : services;
                    return (
                      <tr
                        key={it.id}
                        onDragOver={(e) => {
                          if (!dragId) return;
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                          if (dragOverId !== it.id) setDragOverId(it.id);
                        }}
                        onDragLeave={() => {
                          if (dragOverId === it.id) setDragOverId(null);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const fromId = e.dataTransfer.getData(
                            "text/invoice-item-id",
                          );
                          setDragOverId(null);
                          if (fromId) reorderItems(fromId, it.id);
                        }}
                        className={cn(
                          "border-b border-border/60 align-middle last:border-b-0",
                          dragId === it.id && "opacity-50",
                          dragOverId === it.id &&
                            dragId !== it.id &&
                            "bg-primary/5",
                        )}
                      >
                        <td className="pl-2 text-center text-muted-foreground">
                          <span
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.effectAllowed = "move";
                              e.dataTransfer.setData(
                                "text/invoice-item-id",
                                it.id,
                              );
                              const tr = (
                                e.currentTarget as HTMLElement
                              ).closest("tr");
                              if (tr) e.dataTransfer.setDragImage(tr, 20, 20);
                              setDragId(it.id);
                            }}
                            onDragEnd={() => {
                              setDragId(null);
                              setDragOverId(null);
                            }}
                            aria-label="Reorder item"
                            className="inline-flex cursor-grab active:cursor-grabbing"
                          >
                            <GripVertical className="h-4 w-4" />
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="min-w-0 space-y-2">
                            {it.serviceId ? (
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-semibold uppercase">
                                    {it.title}
                                  </div>
                                  <div className="mt-0.5 text-xs text-muted-foreground">
                                    SKU: {skuFor(it.title)}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  aria-label="Change item"
                                  onClick={() => clearItem(it.id)}
                                  className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted/40"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ) : (
                              <Popover
                                open={itemPickerOpen === it.id}
                                onOpenChange={(o) =>
                                  setItemPickerOpen(o ? it.id : null)
                                }
                              >
                                <PopoverAnchor asChild>
                                  <Input
                                    value={it.title}
                                    onChange={(e) => {
                                      updateItem(it.id, {
                                        title: e.target.value,
                                      });
                                      setItemPickerOpen(it.id);
                                    }}
                                    onFocus={() => setItemPickerOpen(it.id)}
                                    placeholder="Type or click to select an item."
                                    className="h-9"
                                  />
                                </PopoverAnchor>
                                <PopoverContent
                                  align="start"
                                  className="w-[380px] p-0"
                                  onOpenAutoFocus={(e) => e.preventDefault()}
                                  onInteractOutside={(e) => {
                                    const target =
                                      e.target as HTMLElement | null;
                                    if (target?.closest("input"))
                                      e.preventDefault();
                                  }}
                                >
                                  <ul className="max-h-64 overflow-y-auto py-1">
                                    {filtered.length === 0 ? (
                                      <li className="px-3 py-2 text-sm text-muted-foreground">
                                        No items match
                                      </li>
                                    ) : (
                                      filtered.map((s) => (
                                        <li key={s.id}>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              pickService(it.id, s)
                                            }
                                            className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-primary hover:text-primary-foreground [&:hover_.muted]:text-primary-foreground/80"
                                          >
                                            <span className="text-sm font-medium uppercase">
                                              {s.name}
                                            </span>
                                            <span className="muted text-xs text-muted-foreground">
                                              SKU: {skuFor(s.name)} · Rate:{" "}
                                              {formatMoney(
                                                currency,
                                                s.unitPrice,
                                              )}
                                            </span>
                                          </button>
                                        </li>
                                      ))
                                    )}
                                  </ul>
                                  <div className="border-t border-border/60">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        addNewItemFromQuery(it.id, it.title)
                                      }
                                      disabled={!it.title.trim()}
                                      className="flex w-full items-center gap-2 px-3 py-2.5 text-sm font-medium text-primary hover:bg-primary/10 disabled:opacity-40"
                                    >
                                      <Plus className="h-4 w-4" />
                                      Add New Item
                                      {it.title.trim() ? (
                                        <span className="ml-1 truncate text-muted-foreground">
                                          &quot;{it.title.trim()}&quot;
                                        </span>
                                      ) : null}
                                    </button>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            )}
                            {it.serviceId && (
                              <Textarea
                                value={it.description}
                                onChange={(e) =>
                                  updateItem(it.id, {
                                    description: e.target.value,
                                  })
                                }
                                placeholder="Description"
                                rows={2}
                                className="min-h-0 resize-none bg-muted/30"
                              />
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <Input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            step="1"
                            value={it.qty}
                            onChange={(e) =>
                              updateItem(it.id, { qty: e.target.value })
                            }
                            className="h-9 text-right"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <Input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            step="0.001"
                            value={it.rate}
                            onChange={(e) =>
                              updateItem(it.id, { rate: e.target.value })
                            }
                            className="h-9 text-right"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <Input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            step="0.01"
                            value={it.taxPct}
                            onChange={(e) =>
                              updateItem(it.id, { taxPct: e.target.value })
                            }
                            placeholder="0"
                            className="h-9 text-right"
                          />
                        </td>
                        <td className="px-3 py-3 text-right text-sm font-semibold tabular-nums">
                          {formatMoney(currency, row.amount)}
                        </td>
                        <td className="pr-2 align-middle">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                aria-label="Row actions"
                                className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted/40"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              <DropdownMenuItem
                                onSelect={() => duplicateItem(it.id)}
                              >
                                <Copy className="h-4 w-4" />
                                Duplicate
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={items.length === 1}
                                onSelect={() => removeItem(it.id)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                                Remove
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="border-t border-border/60 bg-muted/20 px-4 py-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setItems((xs) => [...xs, newItem()])}
                className="rounded-full"
              >
                <Plus className="h-4 w-4" />
                Add New Row
              </Button>
            </div>
          </section>

          <section className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <Field label="Customer Notes">
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Enter any notes to be displayed in your transaction"
                  rows={4}
                />
              </Field>
              <p className="mt-1 text-xs text-muted-foreground">
                Will be displayed on the invoice
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-surface p-4">
              <div className="grid grid-cols-[1fr_auto] items-center gap-y-3 text-sm">
                <span className="text-muted-foreground">Sub Total</span>
                <span className="text-right font-semibold tabular-nums">
                  {formatMoney(currency, subTotal)}
                </span>
                {taxTotal > 0 && (
                  <>
                    <span className="text-muted-foreground">Tax</span>
                    <span className="text-right font-medium tabular-nums">
                      {formatMoney(currency, taxTotal)}
                    </span>
                  </>
                )}
                <span className="text-muted-foreground">Discount</span>
                <span className="flex items-center justify-end gap-2">
                  <span className="flex h-8 items-stretch overflow-hidden rounded-md border border-border/60">
                    <Input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                      className="h-full w-20 rounded-none border-0 text-right shadow-none focus-visible:ring-0"
                    />
                    <Select
                      value={discountMode}
                      onValueChange={(v) =>
                        setDiscountMode(v as "percent" | "fixed")
                      }
                    >
                      <SelectTrigger className="h-full w-16 gap-1 rounded-none border-0 border-l border-border/60 px-2 shadow-none focus:ring-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent align="end">
                        <SelectItem value="percent">%</SelectItem>
                        <SelectItem value="fixed">{currency}</SelectItem>
                      </SelectContent>
                    </Select>
                  </span>
                  <span className="ml-2 w-24 text-right font-medium tabular-nums">
                    {formatMoney(currency, discountAmount)}
                  </span>
                </span>
                <div className="col-span-2 my-1 border-t border-border/60" />
                <span className="text-base font-semibold">
                  Total ( {currency} )
                </span>
                <span className="text-right text-base font-semibold tabular-nums">
                  {formatMoney(currency, total)}
                </span>
              </div>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}

function DateField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <CalendarIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="date"
        value={value}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className="h-9 pl-9 [&::-webkit-calendar-picker-indicator]:opacity-60"
      />
    </div>
  );
}
