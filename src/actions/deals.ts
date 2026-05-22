"use server";

import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/workspace";
import { logActivity } from "@/lib/activity";
import { revalidatePath } from "next/cache";

export async function getPipeline() {
  const workspace = await requireWorkspace();
  const pipeline = await db.pipeline.findFirst({
    where: { workspaceId: workspace.id, isDefault: true },
    include: {
      stages: { orderBy: { order: "asc" } },
      deals: {
        where: { deletedAt: null },
        include: {
          company: { select: { id: true, name: true } },
          contact: { select: { id: true, firstName: true, lastName: true, mobile: true } },
          stage: true,
          items: { include: { service: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  return pipeline;
}

export async function getDeals() {
  const workspace = await requireWorkspace();
  return db.deal.findMany({
    where: { workspaceId: workspace.id, deletedAt: null },
    include: {
      company: { select: { id: true, name: true } },
      contact: { select: { id: true, firstName: true, lastName: true, mobile: true } },
      stage: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getDeal(id: string) {
  const workspace = await requireWorkspace();
  return db.deal.findFirst({
    where: { id, workspaceId: workspace.id, deletedAt: null },
    include: {
      company: true,
      contact: true,
      stage: true,
      pipeline: { include: { stages: { orderBy: { order: "asc" } } } },
      items: { include: { service: true } },
      project: true,
    },
  });
}

export async function createDeal(formData: FormData) {
  const workspace = await requireWorkspace();

  const title = formData.get("title") as string;
  const value = parseFloat(formData.get("value") as string) || 0;
  const companyId = (formData.get("companyId") as string) || undefined;
  const contactId = (formData.get("contactId") as string) || undefined;
  let pipelineId = (formData.get("pipelineId") as string) || "";
  let stageId = (formData.get("stageId") as string) || "";

  if (!pipelineId || !stageId) {
    const defaultPipeline = await db.pipeline.findFirst({
      where: { workspaceId: workspace.id, isDefault: true },
      include: { stages: { where: { type: "OPEN" }, orderBy: { order: "asc" }, take: 1 } },
    });
    if (defaultPipeline) {
      pipelineId = defaultPipeline.id;
      stageId = defaultPipeline.stages[0]?.id || "";
    }
  }

  const deal = await db.deal.create({
    data: {
      workspaceId: workspace.id,
      pipelineId,
      stageId,
      title,
      value,
      companyId: companyId || null,
      contactId: contactId || null,
    },
  });

  await logActivity({
    entityType: "deal",
    entityId: deal.id,
    entityName: title,
    action: "created",
  });

  revalidatePath("/dashboard/deals");
  return deal;
}

export async function moveDeal(id: string, stageId: string) {
  const workspace = await requireWorkspace();

  const deal = await db.deal.findFirst({ where: { id, workspaceId: workspace.id }, include: { stage: true } });
  const stage = await db.pipelineStage.findUnique({ where: { id: stageId } });

  await db.deal.update({
    where: { id, workspaceId: workspace.id },
    data: {
      stageId,
      closedAt: stage?.type === "WON" || stage?.type === "LOST" ? new Date() : null,
    },
  });

  await logActivity({
    entityType: "deal",
    entityId: id,
    entityName: deal?.title ?? undefined,
    action: "moved",
    changes: { stage: { from: deal?.stage.name, to: stage?.name } },
    metadata: { stageType: stage?.type },
  });

  revalidatePath("/dashboard/deals");
}

export async function addDealItem(dealId: string, formData: FormData) {
  const serviceId = formData.get("serviceId") as string;
  const quantity = parseInt(formData.get("quantity") as string) || 1;
  const unitPrice = parseFloat(formData.get("unitPrice") as string) || 0;
  const description = (formData.get("description") as string) || undefined;

  await db.dealItem.create({
    data: { dealId, serviceId, quantity, unitPrice, description },
  });

  // Recalculate deal value
  const items = await db.dealItem.findMany({ where: { dealId } });
  const total = items.reduce(
    (sum, item) => sum + Number(item.unitPrice) * item.quantity,
    0
  );
  await db.deal.update({ where: { id: dealId }, data: { value: total } });

  revalidatePath("/dashboard/deals");
  revalidatePath(`/dashboard/deals/${dealId}`);
}

export async function removeDealItem(itemId: string, dealId: string) {
  await db.dealItem.delete({ where: { id: itemId } });

  const items = await db.dealItem.findMany({ where: { dealId } });
  const total = items.reduce(
    (sum, item) => sum + Number(item.unitPrice) * item.quantity,
    0
  );
  await db.deal.update({ where: { id: dealId }, data: { value: total } });

  revalidatePath("/dashboard/deals");
  revalidatePath(`/dashboard/deals/${dealId}`);
}

export async function createProjectFromDeal(dealId: string) {
  const workspace = await requireWorkspace();

  const deal = await db.deal.findFirst({
    where: { id: dealId, workspaceId: workspace.id },
    include: { items: { include: { service: true } } },
  });

  if (!deal) throw new Error("Deal not found");

  const firstStatus = await db.projectStatus.findFirst({
    where: { workspaceId: workspace.id },
    orderBy: { order: "asc" },
  });

  const firstTaskStatus = await db.taskStatus.findFirst({
    where: { workspaceId: workspace.id },
    orderBy: { order: "asc" },
  });

  const project = await db.project.create({
    data: {
      workspaceId: workspace.id,
      dealId: deal.id,
      companyId: deal.companyId,
      contactId: deal.contactId,
      statusId: firstStatus?.id,
      name: deal.title,
      tasks: {
        create: deal.items.map((item, index) => ({
          title: item.description || item.service.name,
          serviceId: item.serviceId,
          billable: true,
          price: Number(item.unitPrice) * item.quantity,
          order: index + 1,
          statusId: firstTaskStatus?.id,
        })),
      },
    },
  });

  revalidatePath("/dashboard/deals");
  revalidatePath("/dashboard/projects");
}
