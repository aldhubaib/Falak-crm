"use server";

import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/workspace";
import { logActivity } from "@/lib/activity";
import { revalidatePath } from "next/cache";

export async function getCompanies() {
  const workspace = await requireWorkspace();
  return db.company.findMany({
    where: { workspaceId: workspace.id },
    include: { _count: { select: { contacts: true, deals: true, projects: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getCompany(id: string) {
  const workspace = await requireWorkspace();
  return db.company.findFirst({
    where: { id, workspaceId: workspace.id },
    include: {
      contacts: true,
      deals: { include: { stage: true } },
      projects: { include: { status: true } },
    },
  });
}

export async function createCompany(formData: FormData) {
  const workspace = await requireWorkspace();

  const name = formData.get("name") as string;
  const industry = (formData.get("industry") as string) || undefined;
  const phone = (formData.get("phone") as string) || undefined;
  const whatsappNumber = (formData.get("whatsappNumber") as string) || undefined;
  const email = (formData.get("email") as string) || undefined;
  const website = (formData.get("website") as string) || undefined;
  const address = (formData.get("address") as string) || undefined;

  const company = await db.company.create({
    data: {
      workspaceId: workspace.id,
      name,
      industry,
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

  revalidatePath("/dashboard/companies");
  return company;
}

export async function updateCompany(id: string, formData: FormData) {
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

  revalidatePath("/dashboard/companies");
  revalidatePath(`/dashboard/companies/${id}`);
}

export async function deleteCompany(id: string) {
  const workspace = await requireWorkspace();
  const company = await db.company.findFirst({ where: { id, workspaceId: workspace.id } });
  await db.company.delete({ where: { id, workspaceId: workspace.id } });

  await logActivity({
    entityType: "company",
    entityId: id,
    entityName: company?.name ?? undefined,
    action: "deleted",
  });

  revalidatePath("/dashboard/companies");
}
