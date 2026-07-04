"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { requireWorkspace, requireWorkspaceWithMember } from "@/lib/workspace";
import { canEdit } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { revalidatePath } from "next/cache";
import { safeAction, type ActionResult } from "@/lib/action";

async function requireCompaniesEdit() {
  const { member } = await requireWorkspaceWithMember();
  if (!canEdit(member, "companies")) throw new Error("Permission denied");
}

const LIST_PAGE_SIZE = 50;

export async function getCompanies(opts?: { page?: number }) {
  const workspace = await requireWorkspace();
  const page = Math.max(1, opts?.page ?? 1);
  const rows = await db.company.findMany({
    where: { workspaceId: workspace.id, deletedAt: null },
    select: {
      id: true,
      name: true,
      nameAr: true,
      industry: true,
      referral: true,
      address: true,
      phone: true,
      email: true,
      createdAt: true,
      _count: {
        select: {
          contacts: true,
          deals: { where: { deletedAt: null } },
          projects: { where: { deletedAt: null } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * LIST_PAGE_SIZE,
    take: LIST_PAGE_SIZE + 1,
  });
  return {
    items: rows.slice(0, LIST_PAGE_SIZE),
    page,
    hasMore: rows.length > LIST_PAGE_SIZE,
  };
}

// Slim id/name list for pickers (selects, comboboxes) — no counts or details.
export async function getCompanyOptions() {
  const workspace = await requireWorkspace();
  return db.company.findMany({
    where: { workspaceId: workspace.id, deletedAt: null },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function getCompany(id: string) {
  const workspace = await requireWorkspace();
  return db.company.findFirst({
    where: { id, workspaceId: workspace.id, deletedAt: null },
    include: {
      contacts: {
        include: {
          contact: {
            select: {
              id: true,
              firstName: true,
              middleName: true,
              lastName: true,
              mobile: true,
              email: true,
              country: true,
              deletedAt: true,
            },
          },
        },
      },
      deals: { where: { deletedAt: null }, include: { stage: true } },
      projects: { where: { deletedAt: null }, include: { status: true } },
    },
  });
}

export async function createCompany(formData: FormData): Promise<ActionResult<{ id: string }>> {
  return safeAction("Create Company", async () => {
    await requireCompaniesEdit();
    const workspace = await requireWorkspace();
    const { userId } = await auth();
    const user = await currentUser();

    const name = formData.get("name") as string;
    const nameAr = (formData.get("nameAr") as string) || undefined;
    const industry = (formData.get("industry") as string) || undefined;
    const referral = (formData.get("referral") as string) || undefined;
    const phone = (formData.get("phone") as string) || undefined;
    const whatsappNumber = (formData.get("whatsappNumber") as string) || undefined;
    const email = (formData.get("email") as string) || undefined;
    const website = (formData.get("website") as string) || undefined;
    const address = (formData.get("address") as string) || undefined;

    const company = await db.company.create({
      data: {
        workspaceId: workspace.id,
        ownerId: userId,
        ownerName: user?.fullName || user?.firstName || undefined,
        name,
        nameAr,
        industry,
        referral,
        phone,
        whatsappNumber,
        email,
        website,
        address,
      },
    });

    await logActivity({
      entityType: "company",
      entityId: company.id,
      entityName: name,
      action: "created",
    });

    revalidatePath("/companies");
    return { id: company.id };
  }, { formFields: Object.fromEntries(formData) });
}

export async function updateCompany(id: string, formData: FormData): Promise<ActionResult> {
  return safeAction("Update Company", async () => {
    await requireCompaniesEdit();
    const workspace = await requireWorkspace();

    const existing = await db.company.findFirst({ where: { id, workspaceId: workspace.id } });

    const data: Record<string, string | null> = {};
    const changes: Record<string, { from: unknown; to: unknown }> = {};

    for (const [key, value] of formData.entries()) {
      const newVal = (value as string) || null;
      data[key] = newVal;
      const oldVal = existing ? (existing as Record<string, unknown>)[key] : null;
      if (oldVal !== newVal) {
        changes[key] = { from: oldVal, to: newVal };
      }
    }

    await db.company.update({
      where: { id, workspaceId: workspace.id },
      data,
    });

    if (Object.keys(changes).length > 0) {
      await logActivity({
        entityType: "company",
        entityId: id,
        entityName: existing?.name ?? undefined,
        action: "updated",
        changes,
      });
    }

    revalidatePath("/companies");
    revalidatePath(`/companies/${id}`);
  }, { companyId: id });
}

export async function deleteCompany(id: string): Promise<ActionResult> {
  return safeAction("Delete Company", async () => {
    await requireCompaniesEdit();
    const workspace = await requireWorkspace();
    const company = await db.company.findFirst({ where: { id, workspaceId: workspace.id } });
    await db.company.update({ where: { id, workspaceId: workspace.id }, data: { deletedAt: new Date() } });

    await logActivity({
      entityType: "company",
      entityId: id,
      entityName: company?.name ?? undefined,
      action: "deleted",
    });

    revalidatePath("/companies");
  }, { companyId: id });
}
