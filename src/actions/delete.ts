"use server";

import { requireWorkspace } from "@/lib/workspace";
import { checkDeletionBlocks, softDelete, restoreEntity, type EntityType, type RelationBlock } from "@/lib/soft-delete";
import { logActivity } from "@/lib/activity";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

export type { RelationBlock };

export async function checkCanDelete(type: EntityType, id: string): Promise<RelationBlock[]> {
  await requireWorkspace();
  return checkDeletionBlocks(type, id);
}

export async function deleteRecord(type: EntityType, id: string): Promise<{ success: boolean; blocks?: RelationBlock[] }> {
  const workspace = await requireWorkspace();

  const blocks = await checkDeletionBlocks(type, id);
  if (blocks.length > 0) {
    return { success: false, blocks };
  }

  await softDelete(type, id);

  let entityName: string | undefined;
  if (type === "company") {
    const c = await db.company.findFirst({ where: { id } });
    entityName = c?.name;
  } else if (type === "contact") {
    const c = await db.contact.findFirst({ where: { id } });
    entityName = c ? `${c.firstName} ${c.lastName}` : undefined;
  } else if (type === "deal") {
    const d = await db.deal.findFirst({ where: { id } });
    entityName = d?.title;
  } else if (type === "project") {
    const p = await db.project.findFirst({ where: { id } });
    entityName = p?.name;
  }

  await logActivity({
    entityType: type,
    entityId: id,
    entityName,
    action: "deleted",
  });

  revalidatePath("/dashboard");
  return { success: true };
}

export async function restoreRecord(type: EntityType, id: string) {
  await requireWorkspace();
  await restoreEntity(type, id);

  await logActivity({
    entityType: type,
    entityId: id,
    action: "created",
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings/trash");
}

export async function getTrashItems() {
  const workspace = await requireWorkspace();

  const [companies, contacts, deals, projects] = await Promise.all([
    db.company.findMany({
      where: { workspaceId: workspace.id, deletedAt: { not: null } },
      select: { id: true, name: true, deletedAt: true },
      orderBy: { deletedAt: "desc" },
    }),
    db.contact.findMany({
      where: { workspaceId: workspace.id, deletedAt: { not: null } },
      select: { id: true, firstName: true, lastName: true, deletedAt: true },
      orderBy: { deletedAt: "desc" },
    }),
    db.deal.findMany({
      where: { workspaceId: workspace.id, deletedAt: { not: null } },
      select: { id: true, title: true, deletedAt: true },
      orderBy: { deletedAt: "desc" },
    }),
    db.project.findMany({
      where: { workspaceId: workspace.id, deletedAt: { not: null } },
      select: { id: true, name: true, deletedAt: true },
      orderBy: { deletedAt: "desc" },
    }),
  ]);

  return [
    ...companies.map((c) => ({ id: c.id, type: "company" as EntityType, name: c.name, deletedAt: c.deletedAt! })),
    ...contacts.map((c) => ({ id: c.id, type: "contact" as EntityType, name: `${c.firstName} ${c.lastName}`, deletedAt: c.deletedAt! })),
    ...deals.map((d) => ({ id: d.id, type: "deal" as EntityType, name: d.title, deletedAt: d.deletedAt! })),
    ...projects.map((p) => ({ id: p.id, type: "project" as EntityType, name: p.name, deletedAt: p.deletedAt! })),
  ].sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime());
}
