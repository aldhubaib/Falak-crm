"use server";

// Payments Received module: payments recorded against invoices. Every write
// recomputes the invoice's PARTIAL / PAID status from the sum of its
// payments, so the two modules stay consistent.

import { db } from "@/lib/db";
import { requireWorkspace, requireWorkspaceWithMember } from "@/lib/workspace";
import { canEdit } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { revalidatePath } from "next/cache";
import { safeAction, type ActionResult } from "@/lib/action";

export type PaymentRow = {
  id: string;
  number: string;
  date: string; // ISO
  location: string | null;
  type: string;
  mode: string;
  referenceNumber: string | null;
  amount: number;
  currency: string;
  notes: string | null;
  invoiceId: string;
  invoiceNumber: string;
  invoiceIssueDate: string; // ISO
  invoiceTotal: number;
  clientName: string;
};

// Same client-name fallback chain the invoices list uses:
// deal's company → project's company → contact → deal title.
type InvoiceClientSource = {
  contact: { firstName: string; lastName: string } | null;
  deal: { title: string; company: { name: string } | null } | null;
  project: { company: { name: string } | null } | null;
};

function clientNameFor(inv: InvoiceClientSource): string {
  return (
    inv.deal?.company?.name ??
    inv.project?.company?.name ??
    (inv.contact ? `${inv.contact.firstName} ${inv.contact.lastName}` : null) ??
    inv.deal?.title ??
    "—"
  );
}

const PAYMENT_INVOICE_SELECT = {
  id: true,
  number: true,
  total: true,
  currency: true,
  issueDate: true,
  createdAt: true,
  contact: { select: { firstName: true, lastName: true } },
  deal: { select: { title: true, company: { select: { name: true } } } },
  project: { select: { company: { select: { name: true } } } },
} as const;

export async function getPayments(): Promise<PaymentRow[]> {
  const workspace = await requireWorkspace();
  const rows = await db.payment.findMany({
    where: { workspaceId: workspace.id },
    include: { invoice: { select: PAYMENT_INVOICE_SELECT } },
    orderBy: { date: "desc" },
  });

  return rows.map((p) => ({
    id: p.id,
    number: p.number,
    date: p.date.toISOString(),
    location: p.location,
    type: p.type,
    mode: p.mode,
    referenceNumber: p.referenceNumber,
    amount: Number(p.amount),
    currency: p.currency,
    notes: p.notes,
    invoiceId: p.invoiceId,
    invoiceNumber: p.invoice.number,
    invoiceIssueDate: (p.invoice.issueDate ?? p.invoice.createdAt).toISOString(),
    invoiceTotal: Number(p.invoice.total),
    clientName: clientNameFor(p.invoice),
  }));
}

/** Everything the Record Payment form needs, in one round trip. */
export async function getNewPaymentData() {
  const workspace = await requireWorkspace();
  const [invoices, lastPayment] = await Promise.all([
    db.invoice.findMany({
      where: {
        workspaceId: workspace.id,
        status: { notIn: ["CANCELLED"] },
      },
      select: {
        ...PAYMENT_INVOICE_SELECT,
        payments: { select: { amount: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.payment.findFirst({
      where: { workspaceId: workspace.id },
      orderBy: { createdAt: "desc" },
      select: { number: true },
    }),
  ]);

  const lastNum = lastPayment
    ? parseInt(lastPayment.number.replace(/\D/g, ""), 10) || 0
    : 1069; // First payment number is 1070, matching the design.

  return {
    nextNumber: String(lastNum + 1),
    invoices: invoices.map((inv) => ({
      id: inv.id,
      number: inv.number,
      clientName: clientNameFor(inv),
      currency: inv.currency,
      total: Number(inv.total),
      paid: inv.payments.reduce((s, p) => s + Number(p.amount), 0),
    })),
  };
}

export type PaymentInput = {
  invoiceId: string;
  number: string;
  date: string; // yyyy-mm-dd
  location?: string;
  type: string;
  mode: string;
  referenceNumber?: string;
  amount: number;
  notes?: string;
};

// Re-derives the invoice status from its payments. Fully covered → PAID,
// partially covered → PARTIAL, none → back to SENT/DRAFT (only when the
// current status was itself payment-derived).
async function recomputeInvoiceFromPayments(invoiceId: string) {
  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    select: { id: true, total: true, status: true, sentAt: true },
  });
  if (!invoice) return;

  const agg = await db.payment.aggregate({
    where: { invoiceId },
    _sum: { amount: true },
    _max: { date: true },
  });
  const paid = Number(agg._sum.amount ?? 0);
  const total = Number(invoice.total);

  if (paid <= 0) {
    if (invoice.status === "PAID" || invoice.status === "PARTIAL") {
      await db.invoice.update({
        where: { id: invoiceId },
        data: { status: invoice.sentAt ? "SENT" : "DRAFT", paidAt: null },
      });
    }
    return;
  }

  // Small epsilon so decimal rounding never leaves a fully paid invoice
  // stuck at PARTIAL.
  const fullyPaid = paid >= total - 0.0005;
  await db.invoice.update({
    where: { id: invoiceId },
    data: {
      status: fullyPaid ? "PAID" : "PARTIAL",
      paidAt: fullyPaid ? (agg._max.date ?? new Date()) : null,
    },
  });
}

function validateInput(input: PaymentInput) {
  if (!input.invoiceId) throw new Error("Select an invoice");
  if (!(input.amount > 0)) throw new Error("Enter an amount greater than zero");
  if (!input.date || Number.isNaN(new Date(input.date).getTime()))
    throw new Error("Pick a valid payment date");
  if (!input.number.trim()) throw new Error("Payment number is required");
}

function revalidatePayments(invoiceId: string) {
  revalidatePath("/payments");
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
}

export async function createPayment(
  input: PaymentInput,
): Promise<ActionResult<{ id: string }>> {
  return safeAction("Record Payment", async () => {
    const { workspace, member } = await requireWorkspaceWithMember();
    if (!canEdit(member, "payments")) throw new Error("Permission denied");

    validateInput(input);

    const invoice = await db.invoice.findFirst({
      where: { id: input.invoiceId, workspaceId: workspace.id },
      select: { id: true, number: true, currency: true },
    });
    if (!invoice) throw new Error("Invoice not found");

    const payment = await db.payment.create({
      data: {
        workspaceId: workspace.id,
        invoiceId: invoice.id,
        number: input.number.trim(),
        date: new Date(input.date),
        location: input.location?.trim() || null,
        type: input.type,
        mode: input.mode,
        referenceNumber: input.referenceNumber?.trim() || null,
        amount: input.amount,
        currency: invoice.currency,
        notes: input.notes?.trim() || null,
      },
    });

    await recomputeInvoiceFromPayments(invoice.id);

    await logActivity({
      entityType: "payment",
      entityId: payment.id,
      entityName: `#${payment.number}`,
      action: "created",
      metadata: { invoiceNumber: invoice.number, amount: input.amount },
    });

    revalidatePayments(invoice.id);
    return { id: payment.id };
  });
}

export async function updatePayment(
  paymentId: string,
  input: PaymentInput,
): Promise<ActionResult<{ id: string }>> {
  return safeAction("Update Payment", async () => {
    const { workspace, member } = await requireWorkspaceWithMember();
    if (!canEdit(member, "payments")) throw new Error("Permission denied");

    validateInput(input);

    const existing = await db.payment.findFirst({
      where: { id: paymentId, workspaceId: workspace.id },
      select: { id: true, invoiceId: true, number: true },
    });
    if (!existing) throw new Error("Payment not found");

    const invoice = await db.invoice.findFirst({
      where: { id: input.invoiceId, workspaceId: workspace.id },
      select: { id: true, number: true, currency: true },
    });
    if (!invoice) throw new Error("Invoice not found");

    await db.payment.update({
      where: { id: existing.id },
      data: {
        invoiceId: invoice.id,
        number: input.number.trim(),
        date: new Date(input.date),
        location: input.location?.trim() || null,
        type: input.type,
        mode: input.mode,
        referenceNumber: input.referenceNumber?.trim() || null,
        amount: input.amount,
        currency: invoice.currency,
        notes: input.notes?.trim() || null,
      },
    });

    // The payment may have moved to a different invoice — recompute both.
    await recomputeInvoiceFromPayments(invoice.id);
    if (existing.invoiceId !== invoice.id) {
      await recomputeInvoiceFromPayments(existing.invoiceId);
      revalidatePath(`/invoices/${existing.invoiceId}`);
    }

    await logActivity({
      entityType: "payment",
      entityId: existing.id,
      entityName: `#${input.number.trim()}`,
      action: "updated",
      metadata: { invoiceNumber: invoice.number, amount: input.amount },
    });

    revalidatePayments(invoice.id);
    return { id: existing.id };
  });
}

/** Deletes a payment (the "Refund" action) and re-derives the invoice status. */
export async function deletePayment(
  paymentId: string,
): Promise<ActionResult<void>> {
  return safeAction("Refund Payment", async () => {
    const { workspace, member } = await requireWorkspaceWithMember();
    if (!canEdit(member, "payments")) throw new Error("Permission denied");

    const existing = await db.payment.findFirst({
      where: { id: paymentId, workspaceId: workspace.id },
      select: { id: true, invoiceId: true, number: true, amount: true },
    });
    if (!existing) throw new Error("Payment not found");

    await db.payment.delete({ where: { id: existing.id } });
    await recomputeInvoiceFromPayments(existing.invoiceId);

    await logActivity({
      entityType: "payment",
      entityId: existing.id,
      entityName: `#${existing.number}`,
      action: "deleted",
      metadata: { amount: Number(existing.amount) },
    });

    revalidatePayments(existing.invoiceId);
  });
}
