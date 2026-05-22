"use server";

import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/workspace";
import { revalidatePath } from "next/cache";

export async function getContacts() {
  const workspace = await requireWorkspace();
  return db.contact.findMany({
    where: { workspaceId: workspace.id },
    include: { company: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getContact(id: string) {
  const workspace = await requireWorkspace();
  return db.contact.findFirst({
    where: { id, workspaceId: workspace.id },
    include: {
      company: true,
      deals: { include: { stage: true } },
      invoices: true,
    },
  });
}

export async function createContact(formData: FormData) {
  const workspace = await requireWorkspace();

  const name = formData.get("name") as string;
  const companyId = (formData.get("companyId") as string) || undefined;
  const role = (formData.get("role") as string) || undefined;
  const phone = (formData.get("phone") as string) || undefined;
  const whatsappNumber = (formData.get("whatsappNumber") as string) || undefined;
  const email = (formData.get("email") as string) || undefined;

  const contact = await db.contact.create({
    data: {
      workspaceId: workspace.id,
      name,
      companyId: companyId || null,
      role,
      phone,
      whatsappNumber,
      email,
    },
  });

  revalidatePath("/dashboard/contacts");
  return contact;
}

export async function updateContact(id: string, formData: FormData) {
  const workspace = await requireWorkspace();

  const name = formData.get("name") as string;
  const companyId = (formData.get("companyId") as string) || undefined;
  const role = (formData.get("role") as string) || undefined;
  const phone = (formData.get("phone") as string) || undefined;
  const whatsappNumber = (formData.get("whatsappNumber") as string) || undefined;
  const email = (formData.get("email") as string) || undefined;

  await db.contact.update({
    where: { id, workspaceId: workspace.id },
    data: { name, companyId: companyId || null, role, phone, whatsappNumber, email },
  });

  revalidatePath("/dashboard/contacts");
  revalidatePath(`/dashboard/contacts/${id}`);
}

export async function deleteContact(id: string) {
  const workspace = await requireWorkspace();
  await db.contact.delete({ where: { id, workspaceId: workspace.id } });
  revalidatePath("/dashboard/contacts");
}
