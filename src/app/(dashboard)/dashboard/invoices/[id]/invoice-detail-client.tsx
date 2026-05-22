"use client";

import { sendInvoice, markInvoicePaid } from "@/actions/invoices";
import { ArrowLeft, Send, CheckCircle, ExternalLink } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type InvoiceItem = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: unknown;
  total: unknown;
};

type Invoice = {
  id: string;
  number: string;
  status: string;
  subtotal: unknown;
  taxAmount: unknown;
  total: unknown;
  currency: string;
  notes: string | null;
  dueDate: Date | null;
  publicToken: string;
  sentAt: Date | null;
  acceptedAt: Date | null;
  paidAt: Date | null;
  rejectionNote: string | null;
  contact: { firstName: string; lastName: string; mobile: string } | null;
  project: { name: string; company: { name: string } | null } | null;
  items: InvoiceItem[];
};

export function InvoiceDetailClient({ invoice }: { invoice: Invoice }) {
  const publicUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/inv/${invoice.publicToken}`;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-3 h-12 mb-6">
        <Link
          href="/dashboard/invoices"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-foreground">{invoice.number}</h1>
          <p className="text-[12px] text-muted-foreground">
            {invoice.project?.company?.name || invoice.project?.name || "—"} •{" "}
            {invoice.contact ? `${invoice.contact.firstName} ${invoice.contact.lastName}` : "No contact"}
          </p>
        </div>
        <div className="flex gap-2">
          {invoice.status === "DRAFT" && (
            <form action={sendInvoice.bind(null, invoice.id)}>
              <Button type="submit" size="sm">
                <Send className="w-3.5 h-3.5" />
                Send Invoice
              </Button>
            </form>
          )}
          {invoice.status === "ACCEPTED" && (
            <form action={markInvoicePaid.bind(null, invoice.id)}>
              <Button type="submit" size="sm">
                <CheckCircle className="w-3.5 h-3.5" />
                Mark Paid
              </Button>
            </form>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Invoice Content */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-6">
          {/* Line Items */}
          <div className="mb-6">
            <div className="grid grid-cols-[1fr_60px_100px_100px] gap-2 text-[12px] text-muted-foreground font-medium mb-2 px-2">
              <span>Description</span>
              <span className="text-center">Qty</span>
              <span className="text-right">Price</span>
              <span className="text-right">Total</span>
            </div>
            {invoice.items.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-[1fr_60px_100px_100px] gap-2 text-sm py-2.5 px-2 rounded-lg hover:bg-muted/50"
              >
                <span className="text-foreground">{item.description}</span>
                <span className="text-center text-muted-foreground">{item.quantity}</span>
                <span className="text-right text-muted-foreground">
                  {Number(item.unitPrice).toLocaleString()}
                </span>
                <span className="text-right text-foreground font-medium">
                  {Number(item.total).toLocaleString()}
                </span>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="border-t border-border pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="text-foreground">{Number(invoice.subtotal).toLocaleString()} {invoice.currency}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tax</span>
              <span className="text-foreground">{Number(invoice.taxAmount).toLocaleString()} {invoice.currency}</span>
            </div>
            <div className="flex justify-between text-base font-semibold pt-2 border-t border-border">
              <span className="text-foreground">Total</span>
              <span className="text-primary">{Number(invoice.total).toLocaleString()} {invoice.currency}</span>
            </div>
          </div>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-[13px] font-medium text-foreground mb-3">Status</h3>
            <StatusTimeline invoice={invoice} />
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-[13px] font-medium text-foreground mb-3">Public Link</h3>
            <p className="text-[11px] text-muted-foreground mb-2">
              Share this link with your client to view and respond to the invoice.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-[11px] bg-muted px-2 py-1.5 rounded truncate text-foreground">
                /inv/{invoice.publicToken}
              </code>
              <a
                href={`/inv/${invoice.publicToken}`}
                target="_blank"
                className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {invoice.rejectionNote && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
              <h3 className="text-[13px] font-medium text-destructive mb-1">Rejection Reason</h3>
              <p className="text-[12px] text-foreground">{invoice.rejectionNote}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusTimeline({ invoice }: { invoice: Invoice }) {
  const steps = [
    { label: "Created", done: true, date: null },
    { label: "Sent", done: !!invoice.sentAt, date: invoice.sentAt },
    { label: "Accepted", done: !!invoice.acceptedAt, date: invoice.acceptedAt },
    { label: "Paid", done: !!invoice.paidAt, date: invoice.paidAt },
  ];

  return (
    <div className="space-y-2">
      {steps.map((step, i) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              step.done ? "bg-success" : "bg-muted"
            }`}
          />
          <span className={`text-[12px] ${step.done ? "text-foreground" : "text-muted-foreground"}`}>
            {step.label}
          </span>
          {step.date && (
            <span className="text-[10px] text-muted-foreground ml-auto">
              {new Date(step.date).toLocaleDateString()}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
