"use server";

import { db } from "@/lib/db";
import { requireWorkspace, requireWorkspaceWithMember } from "@/lib/workspace";
import { canEdit } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { getLatestRateForCurrency } from "@/actions/currencies";
import { revalidatePath } from "next/cache";
import { safeAction, type ActionResult } from "@/lib/action";

export type InvoiceListRow = {
  id: string;
  number: string;
  status: string; // DRAFT | SENT | ACCEPTED | REJECTED | PAID | CANCELLED
  clientName: string;
  /** Link to the record clientName refers to (company/contact/deal). */
  clientHref: string | null;
  projectId: string | null;
  projectName: string | null;
  dealId: string | null;
  dealTitle: string | null;
  currency: string;
  subtotal: number;
  taxAmount: number;
  discountType: string;
  discountValue: number;
  total: number;
  notes: string | null;
  issueDate: string; // ISO — falls back to createdAt
  dueDate: string | null;
  sentAt: string | null;
  paidAt: string | null;
  /** Sum of recorded payments (drives PARTIAL/PAID + balance due). */
  paidAmount: number;
  payments: {
    id: string;
    number: string;
    date: string; // ISO
    referenceNumber: string | null;
    mode: string;
    amount: number;
    currency: string;
  }[];
  items: {
    id: string;
    title: string;
    details: string | null;
    qty: number;
    rate: number;
    taxPct: number | null;
  }[];
};

export async function getInvoices(): Promise<InvoiceListRow[]> {
  const workspace = await requireWorkspace();
  const rows = await db.invoice.findMany({
    where: { workspaceId: workspace.id },
    select: {
      id: true,
      number: true,
      status: true,
      subtotal: true,
      taxAmount: true,
      discountType: true,
      discountValue: true,
      total: true,
      currency: true,
      notes: true,
      createdAt: true,
      issueDate: true,
      dueDate: true,
      sentAt: true,
      paidAt: true,
      contact: { select: { id: true, firstName: true, lastName: true } },
      deal: { select: { id: true, title: true, company: { select: { id: true, name: true } } } },
      project: { select: { id: true, name: true, company: { select: { id: true, name: true } } } },
      items: {
        select: {
          id: true,
          description: true,
          details: true,
          quantity: true,
          unitPrice: true,
          taxPct: true,
        },
      },
      payments: {
        select: {
          id: true,
          number: true,
          date: true,
          referenceNumber: true,
          mode: true,
          amount: true,
          currency: true,
        },
        orderBy: { date: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
    // Bounded: the list renders the newest window; anything older is reachable
    // by direct link/search rather than one ever-growing query.
    take: 500,
  });

  return rows.map((inv) => ({
    id: inv.id,
    number: inv.number,
    status: inv.status,
    clientName:
      inv.deal?.company?.name ??
      inv.project?.company?.name ??
      (inv.contact ? `${inv.contact.firstName} ${inv.contact.lastName}` : null) ??
      inv.deal?.title ??
      "—",
    // Mirrors the clientName fallback chain: company → contact → deal.
    clientHref: inv.deal?.company
      ? `/companies/${inv.deal.company.id}`
      : inv.project?.company
        ? `/companies/${inv.project.company.id}`
        : inv.contact
          ? `/contacts/${inv.contact.id}`
          : inv.deal
            ? `/deals/${inv.deal.id}`
            : null,
    projectId: inv.project?.id ?? null,
    projectName: inv.project?.name ?? null,
    dealId: inv.deal?.id ?? null,
    dealTitle: inv.deal?.title ?? null,
    currency: inv.currency,
    subtotal: Number(inv.subtotal),
    taxAmount: Number(inv.taxAmount),
    discountType: inv.discountType,
    discountValue: Number(inv.discountValue),
    total: Number(inv.total),
    notes: inv.notes,
    issueDate: (inv.issueDate ?? inv.createdAt).toISOString(),
    dueDate: inv.dueDate?.toISOString() ?? null,
    sentAt: inv.sentAt?.toISOString() ?? null,
    paidAt: inv.paidAt?.toISOString() ?? null,
    paidAmount: inv.payments.reduce((s, p) => s + Number(p.amount), 0),
    payments: inv.payments.map((p) => ({
      id: p.id,
      number: p.number,
      date: p.date.toISOString(),
      referenceNumber: p.referenceNumber,
      mode: p.mode,
      amount: Number(p.amount),
      currency: p.currency,
    })),
    items: inv.items.map((it) => ({
      id: it.id,
      title: it.description,
      details: it.details,
      qty: it.quantity,
      rate: Number(it.unitPrice),
      taxPct: it.taxPct != null ? Number(it.taxPct) : null,
    })),
  }));
}

export async function getInvoice(id: string) {
  const workspace = await requireWorkspace();
  return db.invoice.findFirst({
    where: { id, workspaceId: workspace.id },
    include: {
      contact: true,
      project: { include: { company: true } },
      deal: { select: { id: true, title: true, company: { select: { id: true, name: true } } } },
      items: true,
    },
  });
}

export async function createInvoiceFromProject(projectId: string, taskIds: string[], dealId?: string) {
  const { workspace, member } = await requireWorkspaceWithMember();
  if (!canEdit(member, "invoices")) throw new Error("Permission denied");

  const project = await db.project.findFirst({
    where: { id: projectId, workspaceId: workspace.id },
    include: { company: true },
  });
  if (!project) throw new Error("Project not found");

  const tasks = await db.task.findMany({
    where: { id: { in: taskIds }, projectId, billable: true, deletedAt: null },
    include: { service: true },
  });

  if (tasks.length === 0) throw new Error("No billable tasks selected");

  const lastInvoice = await db.invoice.findFirst({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "desc" },
  });

  const nextNumber = lastInvoice
    ? `INV-${String(parseInt(lastInvoice.number.replace("INV-", "")) + 1).padStart(3, "0")}`
    : "INV-001";

  const items = tasks.map((task) => ({
    description: task.title,
    quantity: 1,
    unitPrice: task.price ?? 0,
    total: task.price ?? 0,
  }));

  const subtotal = items.reduce((sum, item) => sum + Number(item.total), 0);
  const taxRate = Number(workspace.taxRate) / 100;
  const taxAmount = subtotal * taxRate;
  const total = subtotal + taxAmount;

  const currency = workspace.baseCurrency;
  const rateToBase = await getLatestRateForCurrency(currency);
  const totalInBase = rateToBase != null ? total * rateToBase : null;

  const invoice = await db.invoice.create({
    data: {
      workspaceId: workspace.id,
      projectId,
      contactId: project.contactId,
      number: nextNumber,
      subtotal,
      taxAmount,
      total,
      currency,
      rateToBase,
      totalInBase,
      items: { create: items },
    },
  });

  await logActivity({
    entityType: "invoice",
    entityId: invoice.id,
    entityName: nextNumber,
    action: "created",
    metadata: { projectId, total: subtotal + taxAmount },
  });

  revalidatePath("/invoices");
  revalidatePath(`/projects/${projectId}`);
  if (dealId) revalidatePath(`/deals/${dealId}`);
  return invoice;
}

/** Everything the New Invoice form needs, in one round trip. */
export async function getNewInvoiceData() {
  const workspace = await requireWorkspace();
  const [lastInvoice, deals, services, currencies] = await Promise.all([
    db.invoice.findFirst({
      where: { workspaceId: workspace.id },
      orderBy: { createdAt: "desc" },
      select: { number: true },
    }),
    db.deal.findMany({
      where: { workspaceId: workspace.id, deletedAt: null },
      select: {
        id: true,
        title: true,
        currency: true,
        company: { select: { name: true } },
        project: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.service.findMany({
      where: { workspaceId: workspace.id, active: true },
      select: { id: true, name: true, description: true, unitPrice: true },
      orderBy: { name: "asc" },
    }),
    db.currency.findMany({
      where: { workspaceId: workspace.id, active: true },
      select: { code: true, name: true },
      orderBy: { code: "asc" },
    }),
  ]);

  const lastNum = lastInvoice
    ? parseInt(lastInvoice.number.replace(/\D/g, ""), 10) || 0
    : 0;

  return {
    nextNumber: `INV-${String(lastNum + 1).padStart(6, "0")}`,
    baseCurrency: workspace.baseCurrency,
    deals: deals.map((d) => ({
      id: d.id,
      title: d.title,
      companyName: d.company?.name ?? null,
      project: d.project,
    })),
    services: services.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      unitPrice: Number(s.unitPrice),
    })),
    currencies,
  };
}

export type NewInvoiceInput = {
  dealId: string;
  projectId?: string | null;
  issueDate: string; // yyyy-mm-dd
  dueDate: string; // yyyy-mm-dd
  currency: string;
  notes?: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  items: {
    title: string;
    details?: string;
    qty: number;
    rate: number;
    taxPct?: number;
  }[];
  send?: boolean;
};

/** Creates an invoice from the New Invoice form (deal-based, line items, discount). */
export async function createInvoiceDetailed(
  input: NewInvoiceInput,
): Promise<ActionResult<{ id: string }>> {
  return safeAction("Create Invoice", async () => {
    const { workspace, member } = await requireWorkspaceWithMember();
    if (!canEdit(member, "invoices")) throw new Error("Permission denied");

    const deal = await db.deal.findFirst({
      where: { id: input.dealId, workspaceId: workspace.id, deletedAt: null },
      select: { id: true, contactId: true, project: { select: { id: true } } },
    });
    if (!deal) throw new Error("Deal not found");

    if (new Date(input.dueDate) <= new Date(input.issueDate))
      throw new Error("Due date must be after the invoice date");

    if (!input.projectId || input.projectId !== deal.project?.id)
      throw new Error("Please select the deal's project");

    const items = input.items
      .map((it) => ({
        title: it.title.trim(),
        details: it.details?.trim() || null,
        qty: Math.max(0, Math.round(it.qty)),
        rate: Math.max(0, it.rate),
        taxPct: it.taxPct && it.taxPct > 0 ? it.taxPct : null,
      }))
      .filter((it) => it.title);
    if (items.length === 0) throw new Error("Add at least one line item");

    const subtotal = items.reduce((s, it) => s + it.qty * it.rate, 0);
    const taxAmount = items.reduce(
      (s, it) => s + (it.qty * it.rate * (it.taxPct ?? 0)) / 100,
      0,
    );
    const discountValue = Math.max(0, input.discountValue || 0);
    const discountAmount =
      input.discountType === "fixed"
        ? Math.min(discountValue, subtotal)
        : (subtotal * discountValue) / 100;
    const total = subtotal + taxAmount - discountAmount;

    const lastInvoice = await db.invoice.findFirst({
      where: { workspaceId: workspace.id },
      orderBy: { createdAt: "desc" },
      select: { number: true },
    });
    const lastNum = lastInvoice
      ? parseInt(lastInvoice.number.replace(/\D/g, ""), 10) || 0
      : 0;
    const number = `INV-${String(lastNum + 1).padStart(6, "0")}`;

    const rateToBase = await getLatestRateForCurrency(input.currency);

    const invoice = await db.invoice.create({
      data: {
        workspaceId: workspace.id,
        dealId: deal.id,
        projectId: input.projectId,
        contactId: deal.contactId,
        number,
        status: input.send ? "SENT" : "DRAFT",
        sentAt: input.send ? new Date() : null,
        subtotal,
        taxAmount,
        discountType: input.discountType,
        discountValue,
        total,
        currency: input.currency,
        rateToBase,
        totalInBase: rateToBase != null ? total * rateToBase : null,
        notes: input.notes?.trim() || null,
        issueDate: new Date(input.issueDate),
        dueDate: new Date(input.dueDate),
        items: {
          create: items.map((it) => ({
            description: it.title,
            details: it.details,
            quantity: it.qty,
            unitPrice: it.rate,
            taxPct: it.taxPct,
            total: it.qty * it.rate,
          })),
        },
      },
    });

    await logActivity({
      entityType: "invoice",
      entityId: invoice.id,
      entityName: number,
      action: input.send ? "sent" : "created",
      metadata: { dealId: deal.id, total },
    });

    revalidatePath("/invoices");
    revalidatePath(`/deals/${deal.id}`);
    return { id: invoice.id };
  });
}

/** Updates an existing invoice from the invoice form. Keeps the number and,
 *  unless `send` is set, the current status. */
export async function updateInvoiceDetailed(
  invoiceId: string,
  input: NewInvoiceInput,
): Promise<ActionResult<{ id: string }>> {
  return safeAction("Update Invoice", async () => {
    const { workspace, member } = await requireWorkspaceWithMember();
    if (!canEdit(member, "invoices")) throw new Error("Permission denied");

    const existing = await db.invoice.findFirst({
      where: { id: invoiceId, workspaceId: workspace.id },
      select: { id: true, number: true, status: true, sentAt: true, dealId: true },
    });
    if (!existing) throw new Error("Invoice not found");

    const deal = await db.deal.findFirst({
      where: { id: input.dealId, workspaceId: workspace.id, deletedAt: null },
      select: { id: true, contactId: true, project: { select: { id: true } } },
    });
    if (!deal) throw new Error("Deal not found");

    if (new Date(input.dueDate) <= new Date(input.issueDate))
      throw new Error("Due date must be after the invoice date");

    if (!input.projectId || input.projectId !== deal.project?.id)
      throw new Error("Please select the deal's project");

    const items = input.items
      .map((it) => ({
        title: it.title.trim(),
        details: it.details?.trim() || null,
        qty: Math.max(0, Math.round(it.qty)),
        rate: Math.max(0, it.rate),
        taxPct: it.taxPct && it.taxPct > 0 ? it.taxPct : null,
      }))
      .filter((it) => it.title);
    if (items.length === 0) throw new Error("Add at least one line item");

    const subtotal = items.reduce((s, it) => s + it.qty * it.rate, 0);
    const taxAmount = items.reduce(
      (s, it) => s + (it.qty * it.rate * (it.taxPct ?? 0)) / 100,
      0,
    );
    const discountValue = Math.max(0, input.discountValue || 0);
    const discountAmount =
      input.discountType === "fixed"
        ? Math.min(discountValue, subtotal)
        : (subtotal * discountValue) / 100;
    const total = subtotal + taxAmount - discountAmount;

    const rateToBase = await getLatestRateForCurrency(input.currency);

    await db.invoice.update({
      where: { id: existing.id },
      data: {
        dealId: deal.id,
        projectId: input.projectId,
        contactId: deal.contactId,
        status: input.send ? "SENT" : undefined,
        sentAt: input.send && !existing.sentAt ? new Date() : undefined,
        subtotal,
        taxAmount,
        discountType: input.discountType,
        discountValue,
        total,
        currency: input.currency,
        rateToBase,
        totalInBase: rateToBase != null ? total * rateToBase : null,
        notes: input.notes?.trim() || null,
        issueDate: new Date(input.issueDate),
        dueDate: new Date(input.dueDate),
        items: {
          deleteMany: {},
          create: items.map((it) => ({
            description: it.title,
            details: it.details,
            quantity: it.qty,
            unitPrice: it.rate,
            taxPct: it.taxPct,
            total: it.qty * it.rate,
          })),
        },
      },
    });

    await logActivity({
      entityType: "invoice",
      entityId: existing.id,
      entityName: existing.number,
      action: "updated",
      metadata: { dealId: deal.id, total },
    });

    revalidatePath("/invoices");
    revalidatePath(`/invoices/${existing.id}`);
    revalidatePath(`/deals/${deal.id}`);
    return { id: existing.id };
  });
}

export async function createInvoice(formData: FormData): Promise<ActionResult<{ id: string }>> {
  return safeAction("Create Invoice", async () => {
    const { workspace, member } = await requireWorkspaceWithMember();
    if (!canEdit(member, "invoices")) throw new Error("Permission denied");

    const projectId = (formData.get("projectId") as string) || undefined;
    const contactId = (formData.get("contactId") as string) || undefined;
    const description = (formData.get("description") as string) || "Item";
    const quantity = parseInt(formData.get("quantity") as string) || 1;
    const unitPrice = parseFloat(formData.get("unitPrice") as string) || 0;
    const total = quantity * unitPrice;

    const lastInvoice = await db.invoice.findFirst({
      where: { workspaceId: workspace.id },
      orderBy: { createdAt: "desc" },
    });

    const nextNumber = lastInvoice
      ? `INV-${String(parseInt(lastInvoice.number.replace("INV-", "")) + 1).padStart(3, "0")}`
      : "INV-001";

    const currency = workspace.baseCurrency;
    const rateToBase = await getLatestRateForCurrency(currency);
    const taxRate = Number(workspace.taxRate) / 100;
    const taxAmount = total * taxRate;
    const grandTotal = total + taxAmount;
    const totalInBase = rateToBase != null ? grandTotal * rateToBase : null;

    const invoice = await db.invoice.create({
      data: {
        workspaceId: workspace.id,
        projectId: projectId || null,
        contactId: contactId || null,
        number: nextNumber,
        subtotal: total,
        taxAmount,
        total: grandTotal,
        currency,
        rateToBase,
        totalInBase,
        items: {
          create: [{ description, quantity, unitPrice, total }],
        },
      },
    });

    await logActivity({
      entityType: "invoice",
      entityId: invoice.id,
      entityName: nextNumber,
      action: "created",
      metadata: { total: grandTotal },
    });

    revalidatePath("/invoices");
    if (projectId) revalidatePath(`/projects/${projectId}`);
    return { id: invoice.id };
  }, { formFields: Object.fromEntries(formData) });
}

export async function sendInvoice(id: string) {
  const { workspace, member } = await requireWorkspaceWithMember();
  if (!canEdit(member, "invoices")) throw new Error("Permission denied");

  const invoice = await db.invoice.findFirst({ where: { id, workspaceId: workspace.id } });

  await db.invoice.update({
    where: { id, workspaceId: workspace.id },
    data: { status: "SENT", sentAt: new Date() },
  });

  await logActivity({
    entityType: "invoice",
    entityId: id,
    entityName: invoice?.number ?? undefined,
    action: "sent",
  });

  // TODO: Send WhatsApp notification with invoice link

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
}

export async function acceptInvoice(token: string) {
  await db.invoice.update({
    where: { publicToken: token, status: "SENT" },
    data: { status: "ACCEPTED", acceptedAt: new Date() },
  });
}

export async function rejectInvoice(token: string, reason?: string) {
  await db.invoice.update({
    where: { publicToken: token, status: "SENT" },
    data: { status: "REJECTED", rejectedAt: new Date(), rejectionNote: reason },
  });
}

export async function markInvoicePaid(id: string) {
  const { workspace, member } = await requireWorkspaceWithMember();
  if (!canEdit(member, "invoices")) throw new Error("Permission denied");

  const invoice = await db.invoice.findFirst({ where: { id, workspaceId: workspace.id } });

  await db.invoice.update({
    where: { id, workspaceId: workspace.id },
    data: { status: "PAID", paidAt: new Date() },
  });

  await logActivity({
    entityType: "invoice",
    entityId: id,
    entityName: invoice?.number ?? undefined,
    action: "paid",
  });

  revalidatePath("/invoices");
}
