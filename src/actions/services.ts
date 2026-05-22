"use server";

import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/workspace";
import { logActivity } from "@/lib/activity";
import { revalidatePath } from "next/cache";
import { PricingType } from "@/generated/prisma";

export async function getServices() {
  const workspace = await requireWorkspace();
  return db.service.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "desc" },
  });
}

export async function createService(formData: FormData) {
  const workspace = await requireWorkspace();

  const name = formData.get("name") as string;
  const description = (formData.get("description") as string) || undefined;
  const pricingType = (formData.get("pricingType") as PricingType) || "FIXED";
  const unitPrice = parseFloat(formData.get("unitPrice") as string) || 0;
  const unit = (formData.get("unit") as string) || undefined;

  const service = await db.service.create({
    data: {
      workspaceId: workspace.id,
      name,
      description,
      pricingType,
      unitPrice,
      unit,
    },
  });

  await logActivity({
    entityType: "service",
    entityId: service.id,
    entityName: name,
    action: "created",
  });

  revalidatePath("/dashboard/services");
}

export async function updateService(id: string, formData: FormData) {
  const workspace = await requireWorkspace();

  const name = formData.get("name") as string;
  const description = (formData.get("description") as string) || undefined;
  const pricingType = (formData.get("pricingType") as PricingType) || "FIXED";
  const unitPrice = parseFloat(formData.get("unitPrice") as string) || 0;
  const unit = (formData.get("unit") as string) || undefined;
  const active = formData.get("active") !== "false";

  await db.service.update({
    where: { id, workspaceId: workspace.id },
    data: { name, description, pricingType, unitPrice, unit, active },
  });

  revalidatePath("/dashboard/services");
}

export async function deleteService(id: string) {
  const workspace = await requireWorkspace();

  await db.service.delete({
    where: { id, workspaceId: workspace.id },
  });

  revalidatePath("/dashboard/services");
}
