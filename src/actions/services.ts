"use server";

import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/workspace";
import { logActivity } from "@/lib/activity";
import { revalidatePath } from "next/cache";
import { PricingType } from "@/generated/prisma";
import { safeAction, type ActionResult } from "@/lib/action";

export async function getServices() {
  const workspace = await requireWorkspace();
  return db.service.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { name: "asc" },
  });
}

export async function getService(id: string) {
  const workspace = await requireWorkspace();
  return db.service.findFirst({
    where: { id, workspaceId: workspace.id },
  });
}

export async function createService(formData: FormData): Promise<ActionResult<{ id: string }>> {
  return safeAction("Create Service", async () => {
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

    revalidatePath("/settings/services");
    return { id: service.id };
  });
}

export async function updateService(id: string, formData: FormData): Promise<ActionResult> {
  return safeAction("Update Service", async () => {
    const workspace = await requireWorkspace();

    const data: Record<string, unknown> = {};

    if (formData.has("name")) data.name = formData.get("name") as string;
    if (formData.has("description")) data.description = (formData.get("description") as string) || null;
    if (formData.has("pricingType")) data.pricingType = formData.get("pricingType") as PricingType;
    if (formData.has("unitPrice")) data.unitPrice = parseFloat(formData.get("unitPrice") as string) || 0;
    if (formData.has("unit")) data.unit = (formData.get("unit") as string) || null;
    if (formData.has("active")) data.active = formData.get("active") !== "false";

    await db.service.update({
      where: { id, workspaceId: workspace.id },
      data,
    });

    revalidatePath("/settings/services");
    revalidatePath(`/settings/services/${id}`);
  });
}

export async function deleteService(id: string) {
  const workspace = await requireWorkspace();

  await db.service.delete({
    where: { id, workspaceId: workspace.id },
  });

  revalidatePath("/settings/services");
}
