import { getInvoices } from "@/actions/invoices";
import Link from "next/link";
import { FileText } from "lucide-react";

export default async function InvoicesPage() {
  const invoices = await getInvoices();

  return (
    <div className="p-6">
      <div className="flex items-center justify-between h-12 mb-6">
        <h1 className="text-lg font-semibold text-foreground">Invoices</h1>
      </div>

      {invoices.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground text-sm">
          No invoices yet. Create invoices from completed project tasks.
        </div>
      ) : (
        <div className="space-y-2">
          {invoices.map((invoice) => (
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
                  <h3 className="text-[13px] font-medium text-foreground">
                    {invoice.number}
                  </h3>
                  <p className="text-[12px] text-muted-foreground mt-0.5">
                    {invoice.contact ? `${invoice.contact.firstName} ${invoice.contact.lastName}` : "No contact"} •{" "}
                    {invoice.project?.company?.name || invoice.project?.name || "—"}
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
