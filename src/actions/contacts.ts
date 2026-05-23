"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/workspace";
import { logActivity } from "@/lib/activity";
import { revalidatePath } from "next/cache";
import { safeAction, type ActionResult } from "@/lib/action";

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

export async function createContact(formData: FormData): Promise<ActionResult<{ id: string }>> {
  return safeAction("Create Contact", async () => {
    const workspace = await requireWorkspace();
    const { userId } = await auth();
    const user = await currentUser();

    const firstName = formData.get("firstName") as string;
    const middleName = (formData.get("middleName") as string) || undefined;
    const lastName = formData.get("lastName") as string;
    const nameAr = (formData.get("nameAr") as string) || undefined;
    const mobile = formData.get("mobile") as string;
    const email = (formData.get("email") as string) || undefined;
    const role = (formData.get("role") as string) || undefined;
    const country = formData.get("country") as string;
    const companyId = (formData.get("companyId") as string) || undefined;

    const contact = await db.contact.create({
      data: {
        workspaceId: workspace.id,
        ownerId: userId,
        ownerName: user?.fullName || user?.firstName || undefined,
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
    return { id: contact.id };
  }, { formFields: Object.fromEntries(formData) });
}

export async function updateContact(id: string, formData: FormData): Promise<ActionResult> {
  return safeAction("Update Contact", async () => {
    const workspace = await requireWorkspace();

    const existing = await db.contact.findFirst({ where: { id, workspaceId: workspace.id } });

    const data: Record<string, unknown> = {};
    const changes: Record<string, { from: unknown; to: unknown }> = {};

    for (const [key, val] of formData.entries()) {
      data[key] = (val as string) || null;
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
  }, { contactId: id });
}

export async function deleteContact(id: string): Promise<ActionResult> {
  return safeAction("Delete Contact", async () => {
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
  }, { contactId: id });
}
