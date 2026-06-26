"use server";

import { db } from "@/lib/db";
import { requireWorkspace, requireWorkspaceWithMember } from "@/lib/workspace";
import { canEdit } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { safeAction, type ActionResult } from "@/lib/action";

export interface ClientPortalPermissions {
  project: boolean;
  tasks: boolean;
  invoices: boolean;
}

const DEFAULT_CLIENT_PERMISSIONS: ClientPortalPermissions = {
  project: true,
  tasks: true,
  invoices: true,
};

export async function getDealAccessGrants(dealId: string) {
  const workspace = await requireWorkspace();
  const deal = await db.deal.findFirst({
    where: { id: dealId, workspaceId: workspace.id },
  });
  if (!deal) return [];

  return db.dealAccess.findMany({
    where: { dealId },
    orderBy: { createdAt: "desc" },
  });
}

export async function shareDealWithClient(
  dealId: string,
  formData: FormData
): Promise<ActionResult<{ token: string }>> {
  return safeAction("Share Deal", async () => {
    const { workspace, member } = await requireWorkspaceWithMember();
    if (!canEdit(member, "deals")) throw new Error("Permission denied");

    const deal = await db.deal.findFirst({
      where: { id: dealId, workspaceId: workspace.id },
    });
    if (!deal) throw new Error("Deal not found");

    const email = formData.get("email") as string;
    const name = (formData.get("name") as string) || undefined;
    const showProject = formData.get("showProject") === "true";
    const showTasks = formData.get("showTasks") === "true";
    const showInvoices = formData.get("showInvoices") === "true";

    const permissions: ClientPortalPermissions = {
      project: showProject,
      tasks: showTasks,
      invoices: showInvoices,
    };

    const access = await db.dealAccess.upsert({
      where: { dealId_email: { dealId, email } },
      create: {
        dealId,
        email,
        name,
        permissions: permissions as unknown as Record<string, boolean>,
      },
      update: {
        name,
        permissions: permissions as unknown as Record<string, boolean>,
      },
    });

    revalidatePath(`/deals/${dealId}`);
    return { token: access.token };
  }, { dealId });
}

export async function revokeDealAccess(accessId: string, dealId: string): Promise<ActionResult> {
  return safeAction("Revoke Access", async () => {
    const { workspace, member } = await requireWorkspaceWithMember();
    if (!canEdit(member, "deals")) throw new Error("Permission denied");

    const deal = await db.deal.findFirst({
      where: { id: dealId, workspaceId: workspace.id },
    });
    if (!deal) throw new Error("Deal not found");

    await db.dealAccess.delete({ where: { id: accessId } });
    revalidatePath(`/deals/${dealId}`);
  }, { accessId, dealId });
}

export async function getPortalDeal(token: string) {
  const access = await db.dealAccess.findUnique({
    where: { token },
    include: {
      deal: {
        include: {
          company: { select: { name: true } },
          project: {
            include: {
              status: true,
              tasks: {
                include: { status: true },
                orderBy: { order: "asc" },
              },
              invoices: {
                orderBy: { createdAt: "desc" },
                select: {
                  id: true,
                  number: true,
                  status: true,
                  total: true,
                  currency: true,
                  publicToken: true,
                  createdAt: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!access) return null;

  if (access.expiresAt && access.expiresAt < new Date()) {
    return null;
  }

  const permissions = (access.permissions as unknown as ClientPortalPermissions) ?? DEFAULT_CLIENT_PERMISSIONS;

  return {
    deal: access.deal,
    permissions,
    clientName: access.name,
    clientEmail: access.email,
  };
}
