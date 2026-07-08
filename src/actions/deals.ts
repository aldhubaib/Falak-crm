"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { requireWorkspace, requireWorkspaceWithMember } from "@/lib/workspace";
import { canEdit } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { getLatestRateForCurrency } from "@/actions/currencies";
import { revalidatePath } from "next/cache";
import { safeAction, type ActionResult } from "@/lib/action";

export async function getPipeline() {
  const workspace = await requireWorkspace();
  const pipeline = await db.pipeline.findFirst({
    where: { workspaceId: workspace.id, isDefault: true },
    include: {
      stages: { orderBy: { order: "asc" } },
      deals: {
        where: { deletedAt: null },
        select: {
          id: true,
          title: true,
          value: true,
          currency: true,
          stageId: true,
          companyId: true,
          contactId: true,
          ownerId: true,
          ownerName: true,
          createdAt: true,
          expectedCloseDate: true,
          company: { select: { id: true, name: true } },
          contact: { select: { id: true, firstName: true, lastName: true, mobile: true } },
          stage: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  return pipeline;
}

export async function getPipelineStages() {
  const workspace = await requireWorkspace();
  const pipeline = await db.pipeline.findFirst({
    where: { workspaceId: workspace.id, isDefault: true },
    select: {
      id: true,
      name: true,
      stages: {
        select: { id: true, name: true, order: true, color: true, type: true },
        orderBy: { order: "asc" },
      },
    },
  });
  return pipeline;
}

const LIST_PAGE_SIZE = 50;

export async function getDeals(opts?: { page?: number }) {
  const workspace = await requireWorkspace();
  const page = Math.max(1, opts?.page ?? 1);
  const rows = await db.deal.findMany({
    where: { workspaceId: workspace.id, deletedAt: null },
    select: {
      id: true,
      title: true,
      value: true,
      currency: true,
      stageId: true,
      createdAt: true,
      expectedCloseDate: true,
      ownerName: true,
      company: { select: { id: true, name: true } },
      contact: { select: { id: true, firstName: true, lastName: true, mobile: true } },
      stage: true,
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

// Slim list for link pickers (e.g. the Related Data "+" on companies/contacts).
export async function getDealOptions() {
  const workspace = await requireWorkspace();
  return db.deal.findMany({
    where: { workspaceId: workspace.id, deletedAt: null },
    select: {
      id: true,
      title: true,
      companyId: true,
      contactId: true,
      stage: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

async function requireDealsEdit() {
  const { member } = await requireWorkspaceWithMember();
  if (!canEdit(member, "deals")) throw new Error("Permission denied");
}

// Link/unlink a deal to a company (null unlinks). Used by the Related Data
// tables on the company and deal detail pages.
export async function setDealCompany(
  dealId: string,
  companyId: string | null,
): Promise<ActionResult> {
  return safeAction("Link Deal to Company", async () => {
    await requireDealsEdit();
    const workspace = await requireWorkspace();
    const deal = await db.deal.findFirst({
      where: { id: dealId, workspaceId: workspace.id },
    });
    if (!deal) throw new Error("Deal not found");

    await db.deal.update({ where: { id: dealId }, data: { companyId } });

    revalidatePath(`/deals/${dealId}`);
    revalidatePath("/deals");
    if (companyId) revalidatePath(`/companies/${companyId}`);
    if (deal.companyId) revalidatePath(`/companies/${deal.companyId}`);
  });
}

// Link/unlink a deal to a contact (null unlinks).
export async function setDealContact(
  dealId: string,
  contactId: string | null,
): Promise<ActionResult> {
  return safeAction("Link Deal to Contact", async () => {
    await requireDealsEdit();
    const workspace = await requireWorkspace();
    const deal = await db.deal.findFirst({
      where: { id: dealId, workspaceId: workspace.id },
    });
    if (!deal) throw new Error("Deal not found");

    await db.deal.update({ where: { id: dealId }, data: { contactId } });

    revalidatePath(`/deals/${dealId}`);
    revalidatePath("/deals");
    if (contactId) revalidatePath(`/contacts/${contactId}`);
    if (deal.contactId) revalidatePath(`/contacts/${deal.contactId}`);
  });
}

export async function getDeal(id: string) {
  const workspace = await requireWorkspace();
  return db.deal.findFirst({
    where: { id, workspaceId: workspace.id, deletedAt: null },
    include: {
      company: {
        include: {
          contacts: {
            where: { contact: { deletedAt: null } },
            include: {
              contact: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  mobile: true,
                },
              },
            },
            orderBy: { createdAt: "asc" },
          },
        },
      },
      contact: true,
      stage: true,
      pipeline: { include: { stages: { orderBy: { order: "asc" } } } },
      items: { include: { service: true } },
      project: { select: { id: true } },
    },
  });
}

export async function createDeal(formData: FormData): Promise<ActionResult<{ id: string }>> {
  return safeAction("Create Deal", async () => {
    const { workspace, member } = await requireWorkspaceWithMember();
    if (!canEdit(member, "deals")) throw new Error("Permission denied");
    const { userId } = await auth();
    const user = await currentUser();

    const title = (formData.get("title") as string)?.trim();
    if (!title) throw new Error("Title is required");
    const value = parseFloat(formData.get("value") as string) || 0;
    const companyId = (formData.get("companyId") as string) || undefined;
    if (!companyId) throw new Error("Company is required");
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

    const currency = workspace.baseCurrency;
    const rateToBase = await getLatestRateForCurrency(currency);
    const valueInBase = rateToBase != null ? value * rateToBase : null;

    const deal = await db.deal.create({
      data: {
        workspaceId: workspace.id,
        pipelineId,
        stageId,
        ownerId: userId,
        ownerName: user?.fullName || user?.firstName || undefined,
        title,
        value,
        currency,
        rateToBase,
        valueInBase,
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

    revalidatePath("/deals");
    return { id: deal.id };
  }, { formFields: Object.fromEntries(formData) });
}

export async function updateDeal(
  id: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  return safeAction("Update Deal", async () => {
    const { workspace, member } = await requireWorkspaceWithMember();
    if (!canEdit(member, "deals")) throw new Error("Permission denied");

    const existing = await db.deal.findFirst({
      where: { id, workspaceId: workspace.id, deletedAt: null },
      select: { id: true, currency: true },
    });
    if (!existing) throw new Error("Deal not found");

    const title = (formData.get("title") as string)?.trim();
    if (!title) throw new Error("Title is required");
    const value = parseFloat(formData.get("value") as string) || 0;
    const companyId = (formData.get("companyId") as string) || null;
    if (!companyId) throw new Error("Company is required");
    const contactId = (formData.get("contactId") as string) || null;
    const stageId = (formData.get("stageId") as string) || undefined;

    const rateToBase = await getLatestRateForCurrency(existing.currency);
    const valueInBase = rateToBase != null ? value * rateToBase : null;

    await db.deal.update({
      where: { id: existing.id },
      data: {
        title,
        value,
        rateToBase,
        valueInBase,
        companyId,
        contactId,
        ...(stageId ? { stageId } : {}),
      },
    });

    await logActivity({
      entityType: "deal",
      entityId: existing.id,
      entityName: title,
      action: "updated",
    });

    revalidatePath("/deals");
    revalidatePath(`/deals/${existing.id}`);
    return { id: existing.id };
  }, { formFields: Object.fromEntries(formData) });
}

export async function moveDeal(id: string, stageId: string): Promise<ActionResult> {
  return safeAction("Move Deal", async () => {
    const { workspace, member } = await requireWorkspaceWithMember();
    if (!canEdit(member, "pipeline")) throw new Error("Permission denied");

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

    revalidatePath("/deals");
    revalidatePath(`/deals/${id}`);
  }, { dealId: id, stageId });
}

export async function addDealItem(dealId: string, formData: FormData): Promise<ActionResult> {
  return safeAction("Add Deal Item", async () => {
    const { member } = await requireWorkspaceWithMember();
    if (!canEdit(member, "deals")) throw new Error("Permission denied");

    const serviceId = formData.get("serviceId") as string;
    if (!serviceId) throw new Error("Please select a service");

    const quantity = parseInt(formData.get("quantity") as string) || 1;
    const unitPrice = parseFloat(formData.get("unitPrice") as string) || 0;
    const description = (formData.get("description") as string) || undefined;

    const service = await db.service.findUnique({ where: { id: serviceId } });
    if (!service) throw new Error("Service not found");

    await db.dealItem.create({
      data: { dealId, serviceId, quantity, unitPrice, description },
    });

    const items = await db.dealItem.findMany({ where: { dealId } });
    const total = items.reduce(
      (sum, item) => sum + Number(item.unitPrice) * item.quantity,
      0
    );

    const deal = await db.deal.findUnique({ where: { id: dealId } });
    const lockedRate = deal?.rateToBase ? Number(deal.rateToBase) : null;
    const valueInBase = lockedRate != null ? total * lockedRate : null;

    await db.deal.update({ where: { id: dealId }, data: { value: total, valueInBase } });

    revalidatePath("/deals");
    revalidatePath(`/deals/${dealId}`);
  }, { dealId });
}

export async function updateDealDiscount(
  dealId: string,
  discountType: string,
  discountValue: number
): Promise<ActionResult> {
  return safeAction("Update Discount", async () => {
    const { member } = await requireWorkspaceWithMember();
    if (!canEdit(member, "deals")) throw new Error("Permission denied");

    await db.deal.update({
      where: { id: dealId },
      data: { discountType, discountValue },
    });

    revalidatePath("/deals");
    revalidatePath(`/deals/${dealId}`);
  }, { dealId });
}

export async function removeDealItem(itemId: string, dealId: string): Promise<ActionResult> {
  return safeAction("Remove Deal Item", async () => {
    const { member } = await requireWorkspaceWithMember();
    if (!canEdit(member, "deals")) throw new Error("Permission denied");

    await db.dealItem.delete({ where: { id: itemId } });

    const items = await db.dealItem.findMany({ where: { dealId } });
    const total = items.reduce(
      (sum, item) => sum + Number(item.unitPrice) * item.quantity,
      0
    );

    const deal = await db.deal.findUnique({ where: { id: dealId } });
    const lockedRate = deal?.rateToBase ? Number(deal.rateToBase) : null;
    const valueInBase = lockedRate != null ? total * lockedRate : null;

    await db.deal.update({ where: { id: dealId }, data: { value: total, valueInBase } });

    revalidatePath("/deals");
    revalidatePath(`/deals/${dealId}`);
  }, { itemId, dealId });
}

export async function createProjectFromDeal(dealId: string): Promise<ActionResult<{ projectId: string }>> {
  return safeAction("Create Project from Deal", async () => {
    const { workspace, member } = await requireWorkspaceWithMember();
    if (!canEdit(member, "projects")) throw new Error("Permission denied");

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

    revalidatePath("/deals");
    revalidatePath("/projects");
    return { projectId: project.id };
  }, { dealId });
}
