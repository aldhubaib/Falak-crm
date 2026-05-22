import { notFound } from "next/navigation";
import { db } from "@/lib/db";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function PublicInvoicePage({ params }: Props) {
  const { token } = await params;

  const invoice = await db.invoice.findUnique({
    where: { publicToken: token },
    include: {
      items: true,
      contact: true,
      project: { include: { company: true } },
    },
  });

  if (!invoice) {
    notFound();
  }

  const canRespond = invoice.status === "SENT";

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              Invoice {invoice.number}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {invoice.project?.company?.name}
            </p>
          </div>
          <StatusBadge status={invoice.status} />
        </div>

        {/* Invoice Details */}
        <div className="rounded-xl border border-border bg-card p-6 mb-6">
          <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
            <div>
              <p className="text-muted-foreground">Bill To</p>
              <p className="text-foreground font-medium">
                {invoice.contact ? `${invoice.contact.firstName} ${invoice.contact.lastName}` : "—"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-muted-foreground">Due Date</p>
              <p className="text-foreground font-medium">
                {invoice.dueDate
                  ? new Date(invoice.dueDate).toLocaleDateString()
                  : "—"}
              </p>
            </div>
          </div>

          {/* Line Items */}
          <div className="border-t border-border pt-4">
            <div className="grid grid-cols-[1fr_60px_80px_80px] gap-2 text-[12px] text-muted-foreground font-medium mb-2 px-2">
              <span>Description</span>
              <span className="text-center">Qty</span>
              <span className="text-right">Price</span>
              <span className="text-right">Total</span>
            </div>
            {invoice.items.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-[1fr_60px_80px_80px] gap-2 text-sm py-2 px-2 rounded-lg hover:bg-muted/50"
              >
                <span className="text-foreground">{item.description}</span>
                <span className="text-center text-muted-foreground">
                  {item.quantity}
                </span>
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
          <div className="border-t border-border mt-4 pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="text-foreground">
                {Number(invoice.subtotal).toLocaleString()} {invoice.currency}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tax</span>
              <span className="text-foreground">
                {Number(invoice.taxAmount).toLocaleString()} {invoice.currency}
              </span>
            </div>
            <div className="flex justify-between text-base font-semibold pt-2 border-t border-border">
              <span className="text-foreground">Total</span>
              <span className="text-primary">
                {Number(invoice.total).toLocaleString()} {invoice.currency}
              </span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {invoice.notes && (
          <div className="rounded-xl border border-border bg-card p-4 mb-6">
            <p className="text-[12px] text-muted-foreground mb-1">Notes</p>
            <p className="text-sm text-foreground">{invoice.notes}</p>
          </div>
        )}

        {/* Action Buttons */}
        {canRespond && (
          <div className="flex gap-3">
            <form action={`/api/invoices/${token}/accept`} method="POST" className="flex-1">
              <button
                type="submit"
                className="w-full h-11 rounded-xl bg-success text-success-foreground font-medium text-sm hover:bg-success/90 transition-colors"
              >
                Accept Invoice
              </button>
            </form>
            <form action={`/api/invoices/${token}/reject`} method="POST" className="flex-1">
              <button
                type="submit"
                className="w-full h-11 rounded-xl bg-destructive text-destructive-foreground font-medium text-sm hover:bg-destructive/90 transition-colors"
              >
                Reject
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
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
    <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${className}`}>
      {label}
    </span>
  );
}
