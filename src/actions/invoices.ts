"use server";

import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/workspace";
import { revalidatePath } from "next/cache";

export async function getInvoices() {
  const workspace = await requireWorkspace();
  return db.invoice.findMany({
    where: { workspaceId: workspace.id },
    include: {
      contact: { select: { id: true, name: true } },
      project: { select: { id: true, name: true, company: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getInvoice(id: string) {
  const workspace = await requireWorkspace();
  return db.invoice.findFirst({
    where: { id, workspaceId: workspace.id },
    include: {
      contact: true,
      project: { include: { company: true } },
      items: true,
    },
  });
}

export async function createInvoiceFromProject(projectId: string, taskIds: string[]) {
  const workspace = await requireWorkspace();

  const project = await db.project.findFirst({
    where: { id: projectId, workspaceId: workspace.id },
    include: { company: true },
  });
  if (!project) throw new Error("Project not found");

  const tasks = await db.task.findMany({
    where: { id: { in: taskIds }, projectId, billable: true },
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

  const invoice = await db.invoice.create({
    data: {
      workspaceId: workspace.id,
      projectId,
      contactId: project.contactId,
      number: nextNumber,
      subtotal,
      taxAmount,
      total,
      currency: workspace.currency,
      items: { create: items },
    },
  });

  revalidatePath("/dashboard/invoices");
  revalidatePath(`/dashboard/projects/${projectId}`);
  return invoice;
}

export async function sendInvoice(id: string) {
  const workspace = await requireWorkspace();

  await db.invoice.update({
    where: { id, workspaceId: workspace.id },
    data: { status: "SENT", sentAt: new Date() },
  });

  // TODO: Send WhatsApp notification with invoice link

  revalidatePath("/dashboard/invoices");
  revalidatePath(`/dashboard/invoices/${id}`);
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
  const workspace = await requireWorkspace();

  await db.invoice.update({
    where: { id, workspaceId: workspace.id },
    data: { status: "PAID", paidAt: new Date() },
  });

  revalidatePath("/dashboard/invoices");
}
