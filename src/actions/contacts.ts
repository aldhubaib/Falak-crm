"use server";

import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/workspace";
import { logActivity } from "@/lib/activity";
import { revalidatePath } from "next/cache";

export async function getContacts() {
  const workspace = await requireWorkspace();
  return db.contact.findMany({
    where: { workspaceId: workspace.id, deletedAt: null },
    include: { company: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getContact(id: string) {
  const workspace = await requireWorkspace();
  return db.contact.findFirst({
    where: { id, workspaceId: workspace.id, deletedAt: null },
    include: {
      company: true,
      deals: { where: { deletedAt: null }, include: { stage: true } },
      invoices: true,
    },
  });
}

export async function createContact(formData: FormData) {
  const workspace = await requireWorkspace();

  const firstName = formData.get("firstName") as string;
  const middleName = (formData.get("middleName") as string) || undefined;
  const lastName = formData.get("lastName") as string;
  const nameAr = (formData.get("nameAr") as string) || undefined;
  const mobile = formData.get("mobile") as string;
  const email = (formData.get("email") as string) || undefined;
  const role = (formData.get("role") as string) || undefined;
  const country = formData.get("country") as string;
  const companyId = (formData.get("companyId") as string) || undefined;

  try {
    const contact = await db.contact.create({
      data: {
        workspaceId: workspace.id,
        firstName,
        middleName,
        lastName,
        nameAr,
        mobile,
        email,
        role,
        country,
        companyId: companyId || null,
      },
    });

    await logActivity({
      entityType: "contact",
      entityId: contact.id,
      entityName: `${firstName} ${lastName}`,
      action: "created",
    });

    revalidatePath("/dashboard/contacts");
    revalidatePath("/dashboard/companies");
    return contact;
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return { error: "A contact with this mobile number already exists" };
    }
    throw e;
  }
}

export async function updateContact(id: string, formData: FormData) {
  const workspace = await requireWorkspace();

  const existing = await db.contact.findFirst({ where: { id, workspaceId: workspace.id } });

  const data: Record<string, unknown> = {};
  const changes: Record<string, { from: unknown; to: unknown }> = {};

  for (const [key, val] of formData.entries()) {
    if (key === "companyId") {
      data[key] = (val as string) || null;
    } else {
      data[key] = (val as string) || null;
    }
    const oldVal = existing ? (existing as Record<string, unknown>)[key] : null;
    if (oldVal !== data[key]) {
      changes[key] = { from: oldVal, to: data[key] };
    }
  }

  await db.contact.update({
    where: { id, workspaceId: workspace.id },
    data,
  });

  if (Object.keys(changes).length > 0) {
    await logActivity({
      entityType: "contact",
      entityId: id,
      entityName: existing ? `${existing.firstName} ${existing.lastName}` : undefined,
      action: "updated",
      changes,
    });
  }

  revalidatePath("/dashboard/contacts");
  revalidatePath(`/dashboard/contacts/${id}`);
}

export async function deleteContact(id: string) {
  const workspace = await requireWorkspace();
  const contact = await db.contact.findFirst({ where: { id, workspaceId: workspace.id } });
  await db.contact.update({ where: { id, workspaceId: workspace.id }, data: { deletedAt: new Date() } });

  await logActivity({
    entityType: "contact",
    entityId: id,
    entityName: contact ? `${contact.firstName} ${contact.lastName}` : undefined,
    action: "deleted",
  });

  revalidatePath("/dashboard/contacts");
  revalidatePath("/dashboard/companies");
}
