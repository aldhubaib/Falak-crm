"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { requireWorkspace, requireWorkspaceWithMember } from "@/lib/workspace";
import { canEdit } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { revalidatePath } from "next/cache";
import { safeAction, type ActionResult } from "@/lib/action";

async function requireContactsEdit() {
  const { member } = await requireWorkspaceWithMember();
  if (!canEdit(member, "contacts")) throw new Error("Permission denied");
}

// The contacts table filters/sorts/paginates client-side (like the Lovable
// design), so this returns the whole list capped at a sane maximum.
const LIST_MAX = 1000;

export async function getContacts() {
  const workspace = await requireWorkspace();
  return db.contact.findMany({
    where: { workspaceId: workspace.id, deletedAt: null },
    select: {
      id: true,
      firstName: true,
      middleName: true,
      lastName: true,
      mobile: true,
      email: true,
      country: true,
      role: true,
      createdAt: true,
      companies: {
        select: { company: { select: { id: true, name: true } }, primary: true, role: true },
        orderBy: { primary: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
    take: LIST_MAX,
  });
}

// Slim id/name list for pickers — avoids paying for the full contact graph.
export async function getContactOptions() {
  const workspace = await requireWorkspace();
  return db.contact.findMany({
    where: { workspaceId: workspace.id, deletedAt: null },
    select: { id: true, firstName: true, lastName: true },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });
}

export async function getContact(id: string) {
  const workspace = await requireWorkspace();
  return db.contact.findFirst({
    where: { id, workspaceId: workspace.id, deletedAt: null },
    include: {
      companies: {
        include: { company: { select: { id: true, name: true } } },
        orderBy: { primary: "desc" },
      },
      deals: { where: { deletedAt: null }, include: { stage: true } },
      invoices: true,
    },
  });
}

export async function createContact(formData: FormData): Promise<ActionResult<{ id: string }>> {
  return safeAction("Create Contact", async () => {
    await requireContactsEdit();
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
        ...(companyId && {
          companies: {
            create: { companyId, role, primary: true },
          },
        }),
      },
    });

    await logActivity({
      entityType: "contact",
      entityId: contact.id,
      entityName: `${firstName} ${lastName}`,
      action: "created",
    });

    revalidatePath("/contacts");
    revalidatePath("/companies");
    return { id: contact.id };
  }, { formFields: Object.fromEntries(formData) });
}

export async function updateContact(id: string, formData: FormData): Promise<ActionResult> {
  return safeAction("Update Contact", async () => {
    await requireContactsEdit();
    const workspace = await requireWorkspace();

    const existing = await db.contact.findFirst({ where: { id, workspaceId: workspace.id } });

    const data: Record<string, unknown> = {};
    const changes: Record<string, { from: unknown; to: unknown }> = {};

    for (const [key, val] of formData.entries()) {
      if (key === "companyId") continue; // handled via ContactCompany
      data[key] = (val as string) || null;
      const oldVal = existing ? (existing as Record<string, unknown>)[key] : null;
      if (oldVal !== data[key]) {
        changes[key] = { from: oldVal, to: data[key] };
      }
    }

    if (Object.keys(data).length > 0) {
      await db.contact.update({
        where: { id, workspaceId: workspace.id },
        data,
      });
    }

    if (Object.keys(changes).length > 0) {
      await logActivity({
        entityType: "contact",
        entityId: id,
        entityName: existing ? `${existing.firstName} ${existing.lastName}` : undefined,
        action: "updated",
        changes,
      });
    }

    revalidatePath("/contacts");
    revalidatePath(`/contacts/${id}`);
  }, { contactId: id });
}

export async function addContactCompany(
  contactId: string,
  companyId: string,
  role?: string
): Promise<ActionResult> {
  return safeAction("Link Contact to Company", async () => {
    await requireContactsEdit();
    const workspace = await requireWorkspace();
    const contact = await db.contact.findFirst({ where: { id: contactId, workspaceId: workspace.id } });
    if (!contact) throw new Error("Contact not found");

    const existingLinks = await db.contactCompany.findMany({ where: { contactId } });
    const isPrimary = existingLinks.length === 0;

    await db.contactCompany.create({
      data: { contactId, companyId, role: role || null, primary: isPrimary },
    });

    revalidatePath(`/contacts/${contactId}`);
    revalidatePath("/companies");
  });
}

export async function removeContactCompany(contactId: string, companyId: string): Promise<ActionResult> {
  return safeAction("Unlink Contact from Company", async () => {
    await requireContactsEdit();
    await db.contactCompany.delete({
      where: { contactId_companyId: { contactId, companyId } },
    });

    revalidatePath(`/contacts/${contactId}`);
    revalidatePath("/companies");
  });
}

export async function updateContactCompanyRole(
  contactId: string,
  companyId: string,
  role: string
): Promise<ActionResult> {
  return safeAction("Update Contact Role", async () => {
    await requireContactsEdit();
    await db.contactCompany.update({
      where: { contactId_companyId: { contactId, companyId } },
      data: { role: role || null },
    });

    revalidatePath(`/contacts/${contactId}`);
  });
}

export async function setContactPrimaryCompany(
  contactId: string,
  companyId: string
): Promise<ActionResult> {
  return safeAction("Set Primary Company", async () => {
    await requireContactsEdit();
    await db.contactCompany.updateMany({
      where: { contactId },
      data: { primary: false },
    });
    await db.contactCompany.update({
      where: { contactId_companyId: { contactId, companyId } },
      data: { primary: true },
    });

    revalidatePath(`/contacts/${contactId}`);
  });
}

export async function deleteContact(id: string): Promise<ActionResult> {
  return safeAction("Delete Contact", async () => {
    await requireContactsEdit();
    const workspace = await requireWorkspace();
    const contact = await db.contact.findFirst({ where: { id, workspaceId: workspace.id } });
    await db.contact.update({ where: { id, workspaceId: workspace.id }, data: { deletedAt: new Date() } });

    await logActivity({
      entityType: "contact",
      entityId: id,
      entityName: contact ? `${contact.firstName} ${contact.lastName}` : undefined,
      action: "deleted",
    });

    revalidatePath("/contacts");
    revalidatePath("/companies");
  }, { contactId: id });
}
