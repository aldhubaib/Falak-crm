import Link from "next/link";
import { notFound } from "next/navigation";
import { getInvoice } from "@/actions/invoices";
import { AppHeader } from "@/components/app-header";
import { SurfaceCard } from "@/components/surface-card";
import { Badge } from "@/components/ui/badge";
import { InvoiceActions } from "./invoice-actions";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const { invoiceId } = await params;
  const invoice = await getInvoice(invoiceId);
  if (!invoice) notFound();

  return (
    <>
      <AppHeader title={`Invoice ${invoice.number}`} />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-4 p-5">
          <SurfaceCard className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="font-mono text-xl font-bold">{invoice.number}</h2>
              {invoice.deal && (
                <div className="mt-1 text-sm text-muted-foreground">
                  <Link
                    href={`/deals/${invoice.deal.id}`}
                    className="text-primary hover:underline"
                  >
                    {invoice.deal.title}
                  </Link>
                  {invoice.deal.company && (
                    <>
                      {" · "}
                      <Link
                        href={`/companies/${invoice.deal.company.id}`}
                        className="text-primary hover:underline"
                      >
                        {invoice.deal.company.name}
                      </Link>
                    </>
                  )}
                </div>
              )}
              {invoice.project && (
                <div className="mt-1 text-sm text-muted-foreground">
                  <Link
                    href={`/projects/${invoice.project.id}`}
                    className="text-primary hover:underline"
                  >
                    {invoice.project.name}
                  </Link>
                  {invoice.project.company && (
                    <>
                      {" — "}
                      <Link
                        href={`/companies/${invoice.project.company.id}`}
                        className="text-primary hover:underline"
                      >
                        {invoice.project.company.name}
                      </Link>
                    </>
                  )}
                </div>
              )}
              {invoice.contact && (
                <div className="mt-0.5 text-xs text-muted-foreground">
                  <Link
                    href={`/contacts/${invoice.contact.id}`}
                    className="text-primary hover:underline"
                  >
                    {invoice.contact.firstName} {invoice.contact.lastName}
                  </Link>
                  {invoice.contact.mobile && ` • ${invoice.contact.mobile}`}
                </div>
              )}
            </div>
            <div className="text-right">
              <Badge
                variant={
                  invoice.status === "PAID"
                    ? "default"
                    : invoice.status === "REJECTED"
                      ? "destructive"
                      : "secondary"
                }
                className="text-sm"
              >
                {invoice.status}
              </Badge>
              <div className="mt-2 text-2xl font-bold tabular-nums">
                {Number(invoice.total).toLocaleString()}{" "}
                <span className="text-sm text-muted-foreground">
                  {invoice.currency}
                </span>
              </div>
            </div>
          </SurfaceCard>

          <SurfaceCard>
            <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Line Items
            </div>
            <div className="space-y-2">
              {invoice.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-4 text-sm"
                >
                  <div className="min-w-0">
                    <span>{item.description}</span>
                    {item.details && (
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                        {item.details}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {item.quantity} &times;{" "}
                    {Number(item.unitPrice).toLocaleString()}
                    {item.taxPct != null && Number(item.taxPct) > 0 && (
                      <span className="ml-1 text-xs">
                        (+{Number(item.taxPct)}% tax)
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 border-t border-border/40 pt-3 space-y-1">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Subtotal</span>
                <span className="tabular-nums">
                  {Number(invoice.subtotal).toLocaleString()}
                </span>
              </div>
              {Number(invoice.taxAmount) > 0 && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Tax</span>
                  <span className="tabular-nums">
                    {Number(invoice.taxAmount).toLocaleString()}
                  </span>
                </div>
              )}
              {Number(invoice.discountValue) > 0 && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>
                    Discount
                    {invoice.discountType === "percent" &&
                      ` (${Number(invoice.discountValue)}%)`}
                  </span>
                  <span className="tabular-nums">
                    &minus;
                    {(invoice.discountType === "percent"
                      ? (Number(invoice.subtotal) *
                          Number(invoice.discountValue)) /
                        100
                      : Number(invoice.discountValue)
                    ).toLocaleString()}
                  </span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-sm">
                <span>Total</span>
                <span className="tabular-nums">
                  {Number(invoice.total).toLocaleString()} {invoice.currency}
                </span>
              </div>
            </div>
          </SurfaceCard>

          {invoice.notes && (
            <SurfaceCard>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Customer Notes
              </div>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {invoice.notes}
              </p>
            </SurfaceCard>
          )}

          <SurfaceCard>
            <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Timeline
            </div>
            <div className="space-y-1 text-sm text-muted-foreground">
              <div>
                Created:{" "}
                {new Date(invoice.createdAt).toLocaleDateString()}
              </div>
              {invoice.issueDate && (
                <div>
                  Invoice date:{" "}
                  {new Date(invoice.issueDate).toLocaleDateString()}
                </div>
              )}
              {invoice.dueDate && (
                <div>
                  Due: {new Date(invoice.dueDate).toLocaleDateString()}
                </div>
              )}
              {invoice.sentAt && (
                <div>
                  Sent: {new Date(invoice.sentAt).toLocaleDateString()}
                </div>
              )}
              {invoice.acceptedAt && (
                <div>
                  Accepted:{" "}
                  {new Date(invoice.acceptedAt).toLocaleDateString()}
                </div>
              )}
              {invoice.paidAt && (
                <div>
                  Paid: {new Date(invoice.paidAt).toLocaleDateString()}
                </div>
              )}
              {invoice.rejectedAt && (
                <div className="text-destructive">
                  Rejected:{" "}
                  {new Date(invoice.rejectedAt).toLocaleDateString()}
                  {invoice.rejectionNote && ` — ${invoice.rejectionNote}`}
                </div>
              )}
            </div>
          </SurfaceCard>

          <InvoiceActions
            invoiceId={invoice.id}
            status={invoice.status}
          />
        </div>
      </main>
    </>
  );
}
