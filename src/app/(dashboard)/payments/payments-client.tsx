"use client";

// Payments Received module, matching the Lovable design: a searchable data
// table and a split list+preview that renders the payment as a paper-style
// receipt document with a "Paid" ribbon and the linked invoice row.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Edit3,
  Info,
  Loader2,
  Mail,
  Plus,
  Printer,
  Undo2,
  Wallet,
} from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  OverflowToolbar,
  type OverflowItem,
} from "@/components/overflow-toolbar";
import { useAction } from "@/hooks/use-action";
import { deletePayment, type PaymentRow } from "@/actions/payments";

/* ------------------------------- Helpers -------------------------------- */

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

/* -------------------------------- Module -------------------------------- */

const COLUMNS = [
  { key: "date", label: "Date" },
  { key: "number", label: "Payment #" },
  { key: "type", label: "Type" },
  { key: "reference", label: "Reference Number" },
  { key: "customer", label: "Customer Name" },
  { key: "invoice", label: "Invoice#" },
  { key: "mode", label: "Mode" },
  { key: "amount", label: "Amount" },
] as const;
type ColumnKey = (typeof COLUMNS)[number]["key"];

export function PaymentsClient({
  payments,
  editable,
  logoUrl,
  initialOpenId,
}: {
  payments: PaymentRow[];
  editable: boolean;
  /** Logo chosen in Settings → App Logo, shown on the receipt document. */
  logoUrl: string | null;
  /** From `?open=` — preselects a payment (links from the invoice preview). */
  initialOpenId: string | null;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(
    initialOpenId && payments.some((p) => p.id === initialOpenId)
      ? initialOpenId
      : null,
  );
  const [visible, setVisible] = useState<Record<ColumnKey, boolean>>({
    date: true,
    number: true,
    type: true,
    reference: true,
    customer: true,
    invoice: true,
    mode: true,
    amount: true,
  });
  const [pageSize, setPageSize] = useState(200);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return payments;
    return payments.filter(
      (p) =>
        p.number.toLowerCase().includes(q) ||
        p.mode.toLowerCase().includes(q) ||
        (p.referenceNumber?.toLowerCase().includes(q) ?? false) ||
        p.invoiceNumber.toLowerCase().includes(q) ||
        p.clientName.toLowerCase().includes(q),
    );
  }, [payments, query]);

  const selected = selectedId
    ? payments.find((p) => p.id === selectedId) ?? null
    : null;

  const allColumns: (DataTableColumn<PaymentRow> & { key: ColumnKey })[] = [
    {
      key: "date",
      header: "Date",
      sortable: true,
      sortValue: (p) => new Date(p.date),
      mobile: "hide",
      cell: (p) => formatShortDate(p.date),
    },
    {
      key: "number",
      header: "Payment #",
      sortable: true,
      sortValue: (p) => Number(p.number) || 0,
      cell: (p) => <span className="font-semibold text-primary">{p.number}</span>,
    },
    {
      key: "type",
      header: "Type",
      mobile: "hide",
      cell: (p) => p.type,
    },
    {
      key: "reference",
      header: "Reference Number",
      mobile: "hide",
      cell: (p) =>
        p.referenceNumber || <span className="text-muted-foreground/60">—</span>,
    },
    {
      key: "customer",
      header: "Customer Name",
      sortable: true,
      sortValue: (p) => p.clientName,
      mobile: "title",
      cell: (p) => (
        <span className="font-medium text-foreground">{p.clientName}</span>
      ),
    },
    {
      key: "invoice",
      header: "Invoice#",
      mobile: "hide",
      cell: (p) => (
        <Link
          href={`/invoices?open=${p.invoiceId}`}
          onClick={(e) => e.stopPropagation()}
          className="font-medium text-foreground hover:text-primary hover:underline"
        >
          {p.invoiceNumber}
        </Link>
      ),
    },
    {
      key: "mode",
      header: "Mode",
      mobile: "hide",
      cell: (p) => p.mode,
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      className: "font-medium",
      sortable: true,
      sortValue: (p) => p.amount,
      cell: (p) => formatMoney(p.currency, p.amount),
    },
  ];
  const columns = allColumns.filter((c) => visible[c.key]);

  return (
    <div className="flex min-h-0 w-full flex-1 bg-background text-foreground">
      {payments.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <EmptyState
            variant="page"
            icon={Wallet}
            title="You don't have any payments yet"
            message="Record your first payment against an invoice."
            action={
              editable ? (
                <Button
                  className="rounded-full"
                  onClick={() => router.push("/payments/new")}
                >
                  <Plus className="h-4 w-4" />
                  Record Payment
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
            placeholder="Search payments"
          >
            {rows.length === 0 ? (
              <div className="grid h-40 place-items-center text-sm text-muted-foreground">
                No matches for &quot;{query}&quot;.
              </div>
            ) : (
              rows.map((p) => (
                <EntityListRow
                  key={p.id}
                  active={p.id === selected.id}
                  onClick={() => setSelectedId(p.id)}
                  title={p.clientName}
                  subtitle={
                    <span className="inline-flex items-center gap-1.5">
                      <span>#{p.number}</span>
                      <span className="h-1 w-1 rounded-full bg-muted-foreground/60" />
                      <span>{formatShortDate(p.date)}</span>
                      <span className="h-1 w-1 rounded-full bg-muted-foreground/60" />
                      <span>{p.invoiceNumber}</span>
                    </span>
                  }
                  right={
                    <span className="text-sm font-semibold text-foreground">
                      {formatMoney(p.currency, p.amount)}
                    </span>
                  }
                />
              ))
            )}
          </EntityListPanel>
          <PaymentPreview
            payment={selected}
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
              placeholder="Search payments"
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
                  aria-label="Record payment"
                  onClick={() => router.push("/payments/new")}
                >
                  <Plus className="h-4 w-4" />
                </DataTableIconButton>
              )}
            </div>
          </DataTableToolbar>
          <DataTable
            columns={columns}
            data={rows}
            getRowId={(p) => p.id}
            onRowClick={(p) => setSelectedId(p.id)}
            emptyMessage="No payments match this search."
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

function PaymentPreview({
  payment,
  editable,
  logoUrl,
  onClose,
}: {
  payment: PaymentRow;
  editable: boolean;
  logoUrl: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [confirmRefund, setConfirmRefund] = useState(false);
  const [notice, setNotice] = useState(false);
  const { execute: refund, loading: refunding } = useAction(deletePayment, {
    onSuccess: () => {
      setConfirmRefund(false);
      onClose();
      router.refresh();
    },
  });

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(false), 3000);
    return () => clearTimeout(timer);
  }, [notice]);

  // Matches the Lovable payment toolbar: Edit / Send Email / PDF / Refund
  // (no WhatsApp or Share). Unimplemented actions show the standard notice.
  const items: OverflowItem[] = [
    {
      key: "edit",
      label: "Edit",
      icon: <Edit3 className="h-4 w-4" />,
      onClick: editable
        ? () => router.push(`/payments/new?edit=${payment.id}`)
        : () => setNotice(true),
    },
    {
      key: "email",
      label: "Send Email",
      icon: <Mail className="h-4 w-4" />,
      onClick: () => setNotice(true),
    },
    {
      key: "pdf",
      label: "PDF/Print",
      icon: <Printer className="h-4 w-4" />,
      onClick: () => setNotice(true),
    },
    ...(editable
      ? [
          {
            key: "refund",
            label: "Refund",
            icon: <Undo2 className="h-4 w-4" />,
            onClick: () => setConfirmRefund(true),
          },
        ]
      : []),
  ];

  return (
    <EntityPreviewShell
      eyebrow="Payment"
      title={payment.number}
      onClose={onClose}
      toolbar={
        <>
          <OverflowToolbar
            items={items}
            gap={4}
            renderItem={(it) => (
              <button
                type="button"
                onClick={it.onClick}
                className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm text-foreground hover:bg-muted/40"
              >
                <span className="text-muted-foreground">{it.icon}</span>
                <span>{it.label}</span>
              </button>
            )}
          />
          {notice && (
            <div className="fixed bottom-6 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-background px-4 py-2.5 text-sm text-foreground shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200">
              <Info className="h-4 w-4 shrink-0 text-muted-foreground" />
              This feature is not available yet.
            </div>
          )}
        </>
      }
    >
      <PaymentReceiptDocument payment={payment} logoUrl={logoUrl} />

      <Dialog open={confirmRefund} onOpenChange={setConfirmRefund}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Refund payment</DialogTitle>
            <DialogDescription>
              Payment #{payment.number} of{" "}
              {formatMoney(payment.currency, payment.amount)} will be removed
              and invoice {payment.invoiceNumber} will go back to unpaid /
              partially paid.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => setConfirmRefund(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="rounded-full"
              disabled={refunding}
              onClick={() => refund(payment.id)}
            >
              {refunding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Undo2 className="h-4 w-4" />
              )}
              Refund
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </EntityPreviewShell>
  );
}

/* --------------------------- Receipt document --------------------------- */

function PaymentReceiptDocument({
  payment,
  logoUrl,
}: {
  payment: PaymentRow;
  logoUrl: string | null;
}) {
  return (
    <article className="mx-auto max-w-3xl overflow-hidden rounded-md border border-border/60 bg-surface shadow-sm">
      <div className="relative h-10">
        <div className="absolute left-[-40px] top-3 w-[160px] rotate-[-45deg] bg-emerald-500 py-1 text-center text-xs font-semibold text-black">
          Paid
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
      </div>

      <div className="px-4 pb-2 text-center sm:px-10">
        <div className="inline-block border-b border-border/60 pb-1 text-sm font-semibold uppercase tracking-widest text-foreground">
          Payment Receipt
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 px-4 py-6 sm:grid-cols-[1fr_auto] sm:px-10">
        <dl className="grid grid-cols-[auto_1fr] gap-x-8 gap-y-3 text-sm">
          <dt className="text-muted-foreground">Payment Date</dt>
          <dd className="font-semibold">{formatShortDate(payment.date)}</dd>
          <dt className="text-muted-foreground">Reference Number</dt>
          <dd className="font-semibold">{payment.referenceNumber || "—"}</dd>
          <dt className="text-muted-foreground">Payment Mode</dt>
          <dd className="font-semibold">{payment.mode}</dd>
        </dl>
        <div className="grid h-24 min-w-[180px] place-items-center rounded-md bg-foreground px-6 text-background">
          <div className="text-center">
            <div className="text-xs">Amount Received</div>
            <div className="mt-1 text-lg font-semibold">
              {formatMoney(payment.currency, payment.amount)}
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pb-4 sm:px-10">
        <div className="text-sm text-muted-foreground">Received From</div>
        <div className="mt-1 text-base font-semibold text-primary">
          {payment.clientName}
        </div>
      </div>

      <div className="mt-2 border-t border-border/60 bg-muted/20 px-4 py-5 sm:px-10">
        <div className="text-sm font-semibold text-foreground">Payment for</div>
        <div className="mt-3 overflow-hidden rounded-md border border-border/60 bg-surface">
          <div className="grid grid-cols-4 gap-2 bg-muted/40 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <div>Invoice Number</div>
            <div>Invoice Date</div>
            <div className="text-right">Invoice Amount</div>
            <div className="text-right">Payment Amount</div>
          </div>
          <Link
            href={`/invoices?open=${payment.invoiceId}`}
            className="grid w-full grid-cols-4 gap-2 px-4 py-3 text-left text-sm hover:bg-muted/20"
          >
            <div className="font-semibold text-primary">
              {payment.invoiceNumber}
            </div>
            <div>{formatShortDate(payment.invoiceIssueDate)}</div>
            <div className="text-right">
              {formatMoney(payment.currency, payment.invoiceTotal)}
            </div>
            <div className="text-right">
              {formatMoney(payment.currency, payment.amount)}
            </div>
          </Link>
        </div>
      </div>

      {payment.notes && (
        <div className="px-4 pb-8 pt-4 text-xs text-muted-foreground sm:px-10">
          {payment.notes}
        </div>
      )}
    </article>
  );
}
