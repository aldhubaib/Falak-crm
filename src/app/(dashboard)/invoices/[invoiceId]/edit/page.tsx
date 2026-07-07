import { notFound, redirect } from "next/navigation";
import { getInvoice, getNewInvoiceData } from "@/actions/invoices";
import { requireWorkspaceWithMember } from "@/lib/workspace";
import { canEdit } from "@/lib/permissions";
import {
  NewInvoiceClient,
  type InvoiceFormInitial,
} from "../../new/new-invoice-client";

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function EditInvoicePage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const { invoiceId } = await params;
  const [{ member }, data, invoice] = await Promise.all([
    requireWorkspaceWithMember(),
    getNewInvoiceData(),
    getInvoice(invoiceId),
  ]);
  if (!invoice) notFound();
  if (!canEdit(member, "invoices")) redirect(`/invoices/${invoiceId}`);

  const initial: InvoiceFormInitial = {
    number: invoice.number,
    status: invoice.status,
    dealId: invoice.dealId ?? "",
    projectId: invoice.projectId,
    issueDate: isoDate(invoice.issueDate ?? invoice.createdAt),
    dueDate: isoDate(
      invoice.dueDate ?? invoice.issueDate ?? invoice.createdAt,
    ),
    currency: invoice.currency,
    notes: invoice.notes ?? "",
    discountType: invoice.discountType === "fixed" ? "fixed" : "percent",
    discountValue: Number(invoice.discountValue),
    items: invoice.items.map((it) => ({
      title: it.description,
      details: it.details,
      qty: it.quantity,
      rate: Number(it.unitPrice),
      taxPct: it.taxPct != null ? Number(it.taxPct) : null,
    })),
  };

  return (
    <NewInvoiceClient
      nextNumber={data.nextNumber}
      baseCurrency={data.baseCurrency}
      deals={data.deals}
      services={data.services}
      currencies={data.currencies}
      invoiceId={invoice.id}
      initial={initial}
    />
  );
}
