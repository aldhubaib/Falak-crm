"use server";

import { requireWorkspace } from "@/lib/workspace";
import { checkDeletionBlocks, softDelete, restoreEntity, permanentDelete, type EntityType, type RelationBlock } from "@/lib/soft-delete";
import { logActivity } from "@/lib/activity";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { safeAction, type ActionResult } from "@/lib/action";

export async function checkCanDelete(type: EntityType, id: string): Promise<RelationBlock[]> {
  await requireWorkspace();
  return checkDeletionBlocks(type, id);
}

export async function deleteRecord(type: EntityType, id: string): Promise<ActionResult<{ blocks?: RelationBlock[] }>> {
  return safeAction(`Delete ${type}`, async () => {
    await requireWorkspace();

    if (type !== "task") {
      const blocks = await checkDeletionBlocks(type, id);
      if (blocks.length > 0) {
        return { blocks };
      }
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
    } else if (type === "task") {
      const t = await db.task.findFirst({ where: { id } });
      entityName = t?.title;
    }

    await logActivity({
      entityType: type,
      entityId: id,
      entityName,
      action: "deleted",
    });

    revalidatePath("/dashboard");
    return {};
  }, { type, id });
}

export async function restoreRecord(type: EntityType, id: string): Promise<ActionResult> {
  return safeAction(`Restore ${type}`, async () => {
    await requireWorkspace();
    await restoreEntity(type, id);

    await logActivity({
      entityType: type,
      entityId: id,
      action: "created",
    });

    revalidatePath("/dashboard");
    revalidatePath("/settings/trash");
  }, { type, id });
}

export async function permanentDeleteRecord(type: EntityType, id: string): Promise<ActionResult> {
  return safeAction(`Permanently delete ${type}`, async () => {
    await requireWorkspace();
    await permanentDelete(type, id);
    revalidatePath("/settings/trash");
  }, { type, id });
}

export async function emptyTrash(): Promise<ActionResult> {
  return safeAction("Empty trash", async () => {
    const workspace = await requireWorkspace();

    const items = await getTrashItems();
    for (const item of items) {
      await permanentDelete(item.type, item.id);
    }

    revalidatePath("/settings/trash");
    revalidatePath("/dashboard");
  });
}

export async function getTrashItems() {
  const workspace = await requireWorkspace();

  const [companies, contacts, deals, projects, tasks] = await Promise.all([
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
    db.task.findMany({
      where: { project: { workspaceId: workspace.id }, deletedAt: { not: null } },
      select: { id: true, title: true, deletedAt: true, project: { select: { name: true } } },
      orderBy: { deletedAt: "desc" },
    }),
  ]);

  return [
    ...companies.map((c) => ({ id: c.id, type: "company" as EntityType, name: c.name, deletedAt: c.deletedAt! })),
    ...contacts.map((c) => ({ id: c.id, type: "contact" as EntityType, name: `${c.firstName} ${c.lastName}`, deletedAt: c.deletedAt! })),
    ...deals.map((d) => ({ id: d.id, type: "deal" as EntityType, name: d.title, deletedAt: d.deletedAt! })),
    ...projects.map((p) => ({ id: p.id, type: "project" as EntityType, name: p.name, deletedAt: p.deletedAt! })),
    ...tasks.map((t) => ({ id: t.id, type: "task" as EntityType, name: `${t.title} (${t.project.name})`, deletedAt: t.deletedAt! })),
  ].sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime());
}
