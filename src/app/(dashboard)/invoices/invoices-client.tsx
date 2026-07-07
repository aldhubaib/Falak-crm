"use client";

// Invoices module, matching the Lovable design: a searchable/sortable data
// table with column toggles, and a split list+preview when a row is selected.
// The preview renders the invoice as a paper-style document.

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Plus, Printer, ReceiptText, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import {
  DataTable,
  DataTableColumnsMenu,
  DataTableIconButton,
  DataTablePagination,
  DataTableSearch,
  DataTableShell,
  DataTableToolbar,
  type DataTableColumn,
} from "@/components/data-table";
import {
  EntityListPanel,
  EntityListRow,
  EntityPreviewShell,
} from "@/components/entity-split";
import { EntityPreviewToolbar } from "@/components/entity-preview-toolbar";
import { markInvoicePaid, sendInvoice, type InvoiceListRow } from "@/actions/invoices";

/* ------------------------------- Helpers -------------------------------- */

type DisplayStatus =
  | "draft"
  | "sent"
  | "overdue"
  | "paid"
  | "accepted"
  | "rejected"
  | "cancelled";

function displayStatus(inv: InvoiceListRow): DisplayStatus {
  switch (inv.status) {
    case "PAID":
      return "paid";
    case "DRAFT":
      return "draft";
    case "ACCEPTED":
      return "accepted";
    case "REJECTED":
      return "rejected";
    case "CANCELLED":
      return "cancelled";
    default:
      return inv.dueDate && new Date(inv.dueDate).getTime() < Date.now()
        ? "overdue"
        : "sent";
  }
}

function daysOverdue(dueIso: string): number {
  const ms = Date.now() - new Date(dueIso).getTime();
  return ms <= 0 ? 0 : Math.floor(ms / (24 * 60 * 60 * 1000));
}

function formatMoney(currency: string, amount: number): string {
  return `${currency}${amount.toLocaleString(undefined, {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })}`;
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = d.toLocaleString("en-US", { month: "short" });
  return `${day} ${month} ${d.getFullYear()}`;
}

function balanceDue(inv: InvoiceListRow): number {
  return inv.status === "PAID" || inv.status === "CANCELLED" ? 0 : inv.total;
}

function discountAmount(inv: InvoiceListRow): number {
  return inv.discountType === "fixed"
    ? Math.min(inv.discountValue, inv.subtotal)
    : (inv.subtotal * inv.discountValue) / 100;
}

function StatusPill({ invoice }: { invoice: InvoiceListRow }) {
  const status = displayStatus(invoice);
  const overdueDays =
    status === "overdue" && invoice.dueDate ? daysOverdue(invoice.dueDate) : 0;
  const label =
    status === "overdue"
      ? `OVERDUE BY ${overdueDays} DAY${overdueDays === 1 ? "" : "S"}`
      : status.toUpperCase();
  const cls =
    status === "overdue" || status === "rejected"
      ? "text-destructive"
      : status === "paid" || status === "accepted"
        ? "text-emerald-500"
        : status === "sent"
          ? "text-primary"
          : "text-muted-foreground";
  return (
    <span className={cn("text-[11px] font-semibold uppercase tracking-wide", cls)}>
      {label}
    </span>
  );
}

/* -------------------------------- Module -------------------------------- */

const COLUMNS = [
  { key: "date", label: "Date" },
  { key: "number", label: "Invoice#" },
  { key: "customer", label: "Customer Name" },
  { key: "project", label: "Project" },
  { key: "status", label: "Status" },
  { key: "dueDate", label: "Due Date" },
  { key: "amount", label: "Amount" },
  { key: "balance", label: "Balance Due" },
] as const;
type ColumnKey = (typeof COLUMNS)[number]["key"];

export function InvoicesClient({
  invoices,
  editable,
  logoUrl,
}: {
  invoices: InvoiceListRow[];
  editable: boolean;
  /** Logo chosen in Settings → App Logo to appear on invoice documents. */
  logoUrl: string | null;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [visible, setVisible] = useState<Record<ColumnKey, boolean>>({
    date: true,
    number: true,
    customer: true,
    project: true,
    status: true,
    dueDate: true,
    amount: true,
    balance: true,
  });
  const [pageSize, setPageSize] = useState(200);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return invoices;
    return invoices.filter(
      (i) =>
        i.number.toLowerCase().includes(q) ||
        i.clientName.toLowerCase().includes(q) ||
        (i.projectName?.toLowerCase().includes(q) ?? false) ||
        (i.dealTitle?.toLowerCase().includes(q) ?? false),
    );
  }, [invoices, query]);

  const selected = selectedId
    ? invoices.find((i) => i.id === selectedId) ?? null
    : null;

  const allColumns: (DataTableColumn<InvoiceListRow> & { key: ColumnKey })[] = [
    {
      key: "date",
      header: "Date",
      sortable: true,
      sortValue: (i) => new Date(i.issueDate),
      mobile: "hide",
      cell: (i) => formatShortDate(i.issueDate),
    },
    {
      key: "number",
      header: "Invoice#",
      sortable: true,
      sortValue: (i) => i.number,
      cell: (i) => (
        <span className="inline-flex items-center gap-1.5 text-primary">
          <span className="font-semibold">{i.number}</span>
          {i.sentAt && <Mail className="h-3.5 w-3.5 text-muted-foreground" />}
        </span>
      ),
    },
    {
      key: "customer",
      header: "Customer Name",
      sortable: true,
      sortValue: (i) => i.clientName,
      mobile: "title",
      cell: (i) =>
        i.clientHref ? (
          <Link
            href={i.clientHref}
            onClick={(e) => e.stopPropagation()}
            className="font-medium text-foreground hover:text-primary hover:underline"
          >
            {i.clientName}
          </Link>
        ) : (
          <span className="font-medium text-foreground">{i.clientName}</span>
        ),
    },
    {
      key: "project",
      header: "Project",
      sortable: true,
      sortValue: (i) => i.projectName ?? "",
      mobile: "hide",
      cell: (i) =>
        i.projectName && i.projectId ? (
          <Link
            href={`/projects/${i.projectId}`}
            onClick={(e) => e.stopPropagation()}
            className="text-muted-foreground hover:text-primary hover:underline"
          >
            {i.projectName}
          </Link>
        ) : i.projectName ? (
          <span className="text-muted-foreground">{i.projectName}</span>
        ) : (
          <span className="text-muted-foreground/60">—</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      sortValue: (i) => displayStatus(i),
      cell: (i) => <StatusPill invoice={i} />,
    },
    {
      key: "dueDate",
      header: "Due Date",
      sortable: true,
      sortValue: (i) => (i.dueDate ? new Date(i.dueDate) : new Date(0)),
      mobile: "hide",
      cell: (i) => (i.dueDate ? formatShortDate(i.dueDate) : "—"),
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      className: "font-medium",
      sortable: true,
      sortValue: (i) => i.total,
      cell: (i) => formatMoney(i.currency, i.total),
    },
    {
      key: "balance",
      header: "Balance Due",
      align: "right",
      className: "font-medium",
      sortable: true,
      sortValue: (i) => balanceDue(i),
      mobile: "hide",
      cell: (i) => formatMoney(i.currency, balanceDue(i)),
    },
  ];
  const columns = allColumns.filter((c) => visible[c.key]);

  return (
    <div className="flex min-h-0 w-full flex-1 bg-background text-foreground">
      {invoices.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <EmptyState
            variant="page"
            icon={ReceiptText}
            title="You don't have any invoices yet"
            message="Create your first invoice to start billing your deals."
            action={
              editable ? (
                <Button
                  className="rounded-full"
                  onClick={() => router.push("/invoices/new")}
                >
                  <Plus className="h-4 w-4" />
                  New Invoice
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : selected ? (
        <>
          <EntityListPanel
            query={query}
            onQuery={setQuery}
            placeholder="Search invoices"
          >
            {rows.length === 0 ? (
              <div className="grid h-40 place-items-center text-sm text-muted-foreground">
                No matches for &quot;{query}&quot;.
              </div>
            ) : (
              rows.map((inv) => (
                <EntityListRow
                  key={inv.id}
                  active={inv.id === selected.id}
                  onClick={() => setSelectedId(inv.id)}
                  title={inv.clientName}
                  subtitle={
                    <span className="inline-flex items-center gap-1.5">
                      <span>{inv.number}</span>
                      <span className="h-1 w-1 rounded-full bg-muted-foreground/60" />
                      <span>{formatShortDate(inv.issueDate)}</span>
                      <span className="h-1 w-1 rounded-full bg-muted-foreground/60" />
                      <StatusPill invoice={inv} />
                    </span>
                  }
                  right={
                    <span className="text-sm font-semibold text-foreground">
                      {formatMoney(inv.currency, inv.total)}
                    </span>
                  }
                />
              ))
            )}
          </EntityListPanel>
          <InvoicePreview
            invoice={selected}
            editable={editable}
            logoUrl={logoUrl}
            onClose={() => setSelectedId(null)}
          />
        </>
      ) : (
        <DataTableShell>
          <DataTableToolbar>
            <DataTableSearch
              value={query}
              onChange={setQuery}
              placeholder="Search invoices"
            />
            <div className="ml-auto flex items-center gap-2">
              <DataTableColumnsMenu
                columns={COLUMNS.map((c) => ({ key: c.key, label: c.label }))}
                visible={visible}
                onChange={(k) =>
                  setVisible((v) => ({ ...v, [k]: !v[k as ColumnKey] }))
                }
              />
              {editable && (
                <DataTableIconButton
                  aria-label="New invoice"
                  onClick={() => router.push("/invoices/new")}
                >
                  <Plus className="h-4 w-4" />
                </DataTableIconButton>
              )}
            </div>
          </DataTableToolbar>
          <DataTable
            columns={columns}
            data={rows}
            getRowId={(i) => i.id}
            onRowClick={(i) => setSelectedId(i.id)}
            emptyMessage="No invoices match this search."
          />
          <DataTablePagination
            total={rows.length}
            pageSize={pageSize}
            onPageSize={setPageSize}
          />
        </DataTableShell>
      )}
    </div>
  );
}

/* ----------------------------- Preview panel ---------------------------- */

function InvoicePreview({
  invoice,
  editable,
  logoUrl,
  onClose,
}: {
  invoice: InvoiceListRow;
  editable: boolean;
  logoUrl: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const status = displayStatus(invoice);
  const canRecordPayment =
    editable && (status === "sent" || status === "overdue" || status === "accepted");
  const canSend = editable && status === "draft";

  const recordPayment = () => {
    if (pending) return;
    startTransition(async () => {
      await markInvoicePaid(invoice.id);
      router.refresh();
    });
  };
  const send = () => {
    if (pending) return;
    startTransition(async () => {
      await sendInvoice(invoice.id);
      router.refresh();
    });
  };

  return (
    <EntityPreviewShell
      eyebrow={`Client: ${invoice.clientName}`}
      title={invoice.number}
      onOpen={() => router.push(`/invoices/${invoice.id}`)}
      onClose={onClose}
      toolbar={
        <EntityPreviewToolbar
          onEdit={
            editable
              ? () => router.push(`/invoices/${invoice.id}/edit`)
              : undefined
          }
          extra={[
            ...(canSend
              ? [
                  {
                    key: "send",
                    label: pending ? "Sending…" : "Send",
                    icon: <Mail className="h-4 w-4" />,
                    onClick: send,
                  },
                ]
              : [
                  {
                    key: "reminders",
                    label: "Reminders",
                    icon: <Mail className="h-4 w-4" />,
                  },
                ]),
            {
              key: "pdf",
              label: "PDF/Print",
              icon: <Printer className="h-4 w-4" />,
            },
            ...(canRecordPayment
              ? [
                  {
                    key: "record",
                    label: pending ? "Recording…" : "Record Payment",
                    icon: <Wallet className="h-4 w-4" />,
                    onClick: recordPayment,
                  },
                ]
              : []),
          ]}
        />
      }
    >
      <InvoiceDocument invoice={invoice} logoUrl={logoUrl} />
    </EntityPreviewShell>
  );
}

/* --------------------------- Invoice document --------------------------- */

const RIBBONS: Record<DisplayStatus, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-zinc-500 text-white" },
  sent: { label: "Sent", cls: "bg-blue-500 text-white" },
  overdue: { label: "Overdue", cls: "bg-amber-500 text-black" },
  paid: { label: "Paid", cls: "bg-emerald-500 text-black" },
  accepted: { label: "Accepted", cls: "bg-emerald-500 text-black" },
  rejected: { label: "Rejected", cls: "bg-red-500 text-white" },
  cancelled: { label: "Void", cls: "bg-zinc-600 text-white" },
};

function InvoiceDocument({
  invoice,
  logoUrl,
}: {
  invoice: InvoiceListRow;
  logoUrl: string | null;
}) {
  const status = displayStatus(invoice);
  const discount = discountAmount(invoice);
  const ribbon = RIBBONS[status];

  return (
    <article className="mx-auto max-w-3xl overflow-hidden rounded-md border border-border/60 bg-surface shadow-sm">
      <div className="relative h-10">
        <div
          className={cn(
            "absolute left-[-40px] top-3 w-[160px] rotate-[-45deg] py-1 text-center text-xs font-semibold",
            ribbon.cls,
          )}
        >
          {ribbon.label}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 px-4 pb-6 pt-4 sm:px-10">
        {logoUrl ? (
          <div className="grid h-24 w-24 place-items-center overflow-hidden rounded-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoUrl}
              alt="Company logo"
              className="h-full w-full object-contain"
            />
          </div>
        ) : (
          <div className="grid h-24 w-24 place-items-center rounded-md bg-foreground text-lg font-semibold text-background">
            logo
          </div>
        )}
        <div className="text-right text-2xl font-semibold tracking-widest text-muted-foreground">
          INVOICE
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 px-4 pb-6 sm:grid-cols-2 sm:px-10">
        <div>
          {invoice.clientHref ? (
            <Link
              href={invoice.clientHref}
              className="text-lg font-semibold text-primary hover:underline"
            >
              {invoice.clientName}
            </Link>
          ) : (
            <div className="text-lg font-semibold text-primary">
              {invoice.clientName}
            </div>
          )}
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-8 gap-y-1.5 text-sm">
          <dt className="text-muted-foreground">Invoice#</dt>
          <dd className="text-right font-medium">{invoice.number}</dd>
          <dt className="text-muted-foreground">Invoice Date</dt>
          <dd className="text-right font-medium">
            {formatShortDate(invoice.issueDate)}
          </dd>
          {invoice.projectName && (
            <>
              <dt className="text-muted-foreground">Project</dt>
              <dd className="text-right font-medium">
                {invoice.projectId ? (
                  <Link
                    href={`/projects/${invoice.projectId}`}
                    className="hover:text-primary hover:underline"
                  >
                    {invoice.projectName}
                  </Link>
                ) : (
                  invoice.projectName
                )}
              </dd>
            </>
          )}
          {invoice.dueDate && (
            <>
              <dt className="text-muted-foreground">Due Date</dt>
              <dd className="text-right font-medium">
                {formatShortDate(invoice.dueDate)}
              </dd>
            </>
          )}
        </dl>
      </div>

      <div className="px-4 sm:px-10">
        <div className="grid grid-cols-[1fr_auto] gap-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground sm:gap-8">
          <div>Item &amp; Description</div>
          <div className="text-right">Amount</div>
        </div>

        {invoice.items.map((item) => (
          <div key={item.id} className="border-t border-border/60 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold uppercase tracking-wide">
                  {item.title}
                </div>
                {item.details && (
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {item.details}
                  </p>
                )}
              </div>
              <div className="shrink-0 text-right text-sm">
                <div className="font-medium">
                  {formatMoney(invoice.currency, item.qty * item.rate)}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {item.qty.toFixed(2)} &nbsp; x
                  {item.taxPct != null && item.taxPct > 0 && (
                    <span className="ml-1">+{item.taxPct}% tax</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}

        <div className="mt-2 flex justify-end border-t border-border/60 py-4">
          <dl className="grid grid-cols-[auto_auto] gap-x-10 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Sub Total</dt>
            <dd className="text-right font-medium">
              {formatMoney(invoice.currency, invoice.subtotal)}
            </dd>
            {invoice.taxAmount > 0 && (
              <>
                <dt className="text-muted-foreground">Tax</dt>
                <dd className="text-right font-medium">
                  {formatMoney(invoice.currency, invoice.taxAmount)}
                </dd>
              </>
            )}
            {discount > 0 && (
              <>
                <dt className="text-muted-foreground">
                  Discount
                  {invoice.discountType === "percent" &&
                    ` (${invoice.discountValue}%)`}
                </dt>
                <dd className="text-right font-medium">
                  &minus;{formatMoney(invoice.currency, discount)}
                </dd>
              </>
            )}
            <dt className="text-base font-semibold">Total</dt>
            <dd className="text-right text-base font-semibold">
              {formatMoney(invoice.currency, invoice.total)}
            </dd>
          </dl>
        </div>
      </div>

      <div className="px-4 pb-8 pt-4 text-xs text-muted-foreground sm:px-10">
        {invoice.notes || "Thank you for your business."}
      </div>
    </article>
  );
}
