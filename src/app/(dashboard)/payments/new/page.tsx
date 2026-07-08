import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireWorkspaceWithMember } from "@/lib/workspace";
import { canEdit } from "@/lib/permissions";
import { getNewPaymentData } from "@/actions/payments";
import { NewPaymentClient, type PaymentFormInitial } from "./new-payment-client";

// Record Payment / Edit Payment page. `?invoice=` preselects an invoice,
// `?edit=` loads an existing payment into the form.
export default async function NewPaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ invoice?: string; edit?: string }>;
}) {
  const [{ invoice, edit }, { workspace, member }] = await Promise.all([
    searchParams,
    requireWorkspaceWithMember(),
  ]);
  if (!canEdit(member, "payments")) redirect("/payments");

  const data = await getNewPaymentData();

  let initial: PaymentFormInitial | undefined;
  let paymentId: string | undefined;
  if (edit) {
    const payment = await db.payment.findFirst({
      where: { id: edit, workspaceId: workspace.id },
    });
    if (!payment) notFound();
    paymentId = payment.id;
    initial = {
      number: payment.number,
      invoiceId: payment.invoiceId,
      date: payment.date.toISOString().slice(0, 10),
      type: payment.type,
      mode: payment.mode,
      referenceNumber: payment.referenceNumber ?? "",
      amount: Number(payment.amount),
      notes: payment.notes ?? "",
    };
  }

  return (
    <NewPaymentClient
      nextNumber={data.nextNumber}
      invoices={data.invoices}
      preselectInvoiceId={invoice}
      paymentId={paymentId}
      initial={initial}
    />
  );
}
