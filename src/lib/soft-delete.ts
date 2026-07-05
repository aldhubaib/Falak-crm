import { db } from "@/lib/db";
import { deleteObject } from "@/lib/storage";

export type EntityType = "company" | "contact" | "deal" | "project" | "task" | "asset" | "folder";

export type RelationBlock = {
  type: EntityType;
  label: string;
  count: number;
  items: { id: string; name: string }[];
};

export async function checkDeletionBlocks(
  type: EntityType,
  id: string
): Promise<RelationBlock[]> {
  const blocks: RelationBlock[] = [];

  if (type === "company") {
    const contactLinks = await db.contactCompany.findMany({
      where: { companyId: id, contact: { deletedAt: null } },
      include: { contact: { select: { id: true, firstName: true, lastName: true } } },
      take: 5,
    });
    if (contactLinks.length > 0) {
      blocks.push({
        type: "contact",
        label: "Contacts",
        count: contactLinks.length,
        items: contactLinks.map((c) => ({ id: c.contact.id, name: `${c.contact.firstName} ${c.contact.lastName}` })),
      });
    }

    const deals = await db.deal.findMany({
      where: { companyId: id, deletedAt: null },
      select: { id: true, title: true },
      take: 5,
    });
    if (deals.length > 0) {
      blocks.push({
        type: "deal",
        label: "Deals",
        count: deals.length,
        items: deals.map((d) => ({ id: d.id, name: d.title })),
      });
    }

    const projects = await db.project.findMany({
      where: { companyId: id, deletedAt: null },
      select: { id: true, name: true },
      take: 5,
    });
    if (projects.length > 0) {
      blocks.push({
        type: "project",
        label: "Projects",
        count: projects.length,
        items: projects.map((p) => ({ id: p.id, name: p.name })),
      });
    }
  }

  if (type === "contact") {
    const deals = await db.deal.findMany({
      where: { contactId: id, deletedAt: null },
      select: { id: true, title: true },
      take: 5,
    });
    if (deals.length > 0) {
      blocks.push({
        type: "deal",
        label: "Deals",
        count: deals.length,
        items: deals.map((d) => ({ id: d.id, name: d.title })),
      });
    }

    const invoices = await db.invoice.findMany({
      where: { contactId: id },
      select: { id: true, number: true },
      take: 5,
    });
    if (invoices.length > 0) {
      blocks.push({
        type: "deal",
        label: "Invoices",
        count: invoices.length,
        items: invoices.map((i) => ({ id: i.id, name: i.number })),
      });
    }
  }

  if (type === "deal") {
    const project = await db.project.findFirst({
      where: { dealId: id, deletedAt: null },
      select: { id: true, name: true },
    });
    if (project) {
      blocks.push({
        type: "project",
        label: "Projects",
        count: 1,
        items: [{ id: project.id, name: project.name }],
      });
    }
  }

  if (type === "project") {
    const invoices = await db.invoice.findMany({
      where: { projectId: id },
      select: { id: true, number: true },
      take: 5,
    });
    if (invoices.length > 0) {
      blocks.push({
        type: "deal",
        label: "Invoices",
        count: invoices.length,
        items: invoices.map((i) => ({ id: i.id, name: i.number })),
      });
    }
  }

  return blocks;
}

export async function softDelete(type: EntityType, id: string, deletedBy?: string | null) {
  const data = { deletedAt: new Date(), deletedBy: deletedBy ?? null };

  switch (type) {
    case "company":
      await db.company.update({ where: { id }, data });
      break;
    case "contact":
      await db.contact.update({ where: { id }, data });
      break;
    case "deal":
      await db.deal.update({ where: { id }, data });
      break;
    case "project":
      await db.project.update({ where: { id }, data });
      break;
    case "task":
      await db.task.update({ where: { id }, data });
      break;
    case "asset":
      await db.projectAsset.update({ where: { id }, data });
      break;
    case "folder":
      // Only the folder itself is marked. Nested folders/files stay untouched
      // (they're unreachable while an ancestor is trashed) so a restore brings
      // the whole subtree back exactly as it was.
      await db.projectFolder.update({ where: { id }, data });
      break;
  }
}

export async function restoreEntity(type: EntityType, id: string) {
  const data = { deletedAt: null, deletedBy: null };

  switch (type) {
    case "company":
      await db.company.update({ where: { id }, data });
      break;
    case "contact":
      await db.contact.update({ where: { id }, data });
      break;
    case "deal":
      await db.deal.update({ where: { id }, data });
      break;
    case "project":
      await db.project.update({ where: { id }, data });
      break;
    case "task":
      await db.task.update({ where: { id }, data });
      break;
    case "asset": {
      const asset = await db.projectAsset.findUnique({
        where: { id },
        select: { folderId: true, folder: { select: { deletedAt: true } } },
      });
      if (!asset) return;
      // If the parent folder is (still) trashed, restore the file to the
      // project root so it doesn't reappear inside an invisible folder.
      const folderGone = asset.folderId != null && asset.folder?.deletedAt != null;
      await db.projectAsset.update({
        where: { id },
        data: { ...data, ...(folderGone ? { folderId: null } : {}) },
      });
      break;
    }
    case "folder": {
      const folder = await db.projectFolder.findUnique({
        where: { id },
        select: { parentId: true, parent: { select: { deletedAt: true } } },
      });
      if (!folder) return;
      const parentGone = folder.parentId != null && folder.parent?.deletedAt != null;
      await db.projectFolder.update({
        where: { id },
        data: { ...data, ...(parentGone ? { parentId: null } : {}) },
      });
      break;
    }
  }
}

/**
 * Delete attachment rows matching `where` plus their R2 objects.
 * R2 failures are logged but don't abort the purge.
 */
async function purgeAttachments(where: NonNullable<Parameters<typeof db.attachment.findMany>[0]>["where"]) {
  const rows = await db.attachment.findMany({ where, select: { id: true, r2Key: true } });
  if (rows.length === 0) return;
  await purgeR2Keys(rows.map((r) => r.r2Key));
  await db.attachment.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } });
}

async function purgeR2Keys(keys: (string | null)[]) {
  const results = await Promise.allSettled(
    keys.filter((k): k is string => !!k).map((k) => deleteObject(k)),
  );
  for (const r of results) {
    if (r.status === "rejected") {
      console.error("[trash] Failed to delete R2 object:", r.reason);
    }
  }
}

/** Collect every asset under a folder subtree (including trashed ones). */
async function collectFolderAssets(folderId: string): Promise<{ r2Key: string }[]> {
  const assets = await db.projectAsset.findMany({
    where: { folderId },
    select: { r2Key: true },
  });
  const children = await db.projectFolder.findMany({
    where: { parentId: folderId },
    select: { id: true },
  });
  const nested = await Promise.all(children.map((c) => collectFolderAssets(c.id)));
  return [...assets, ...nested.flat()];
}

/** Purge all R2-backed files owned by a task: checklist uploads, task attachments, comment attachments. */
async function purgeTaskFiles(taskId: string) {
  const checklistItems = await db.taskChecklistItem.findMany({
    where: { taskId },
    select: { id: true, attachmentId: true },
  });
  const messages = await db.message.findMany({
    where: { taskId },
    select: { id: true },
  });

  const directAttachmentIds = checklistItems
    .map((ci) => ci.attachmentId)
    .filter((aid): aid is string => !!aid);

  await purgeAttachments({
    OR: [
      ...(directAttachmentIds.length > 0 ? [{ id: { in: directAttachmentIds } }] : []),
      { entityType: "checklist_item", entityId: { in: checklistItems.map((ci) => ci.id) } },
      { entityType: "task", entityId: taskId },
      ...(messages.length > 0
        ? [{ entityType: "message", entityId: { in: messages.map((m) => m.id) } }]
        : []),
    ],
  });
}

export async function permanentDelete(type: EntityType, id: string) {
  switch (type) {
    case "company":
      await db.company.deleteMany({ where: { id } });
      break;
    case "contact":
      await db.contact.deleteMany({ where: { id } });
      break;
    case "deal":
      await db.deal.deleteMany({ where: { id } });
      break;
    case "project": {
      const project = await db.project.findUnique({ where: { id }, select: { id: true } });
      if (!project) return;

      // Media library files (assets, including ones nested in folders)
      const assets = await db.projectAsset.findMany({
        where: { projectId: id },
        select: { r2Key: true },
      });
      await purgeR2Keys(assets.map((a) => a.r2Key));

      // Files owned by every task in the project (checklist uploads, comments)
      const tasks = await db.task.findMany({ where: { projectId: id }, select: { id: true } });
      for (const task of tasks) {
        await purgeTaskFiles(task.id);
      }

      // Project-level comment attachments and thumbnail
      const projectMessages = await db.message.findMany({
        where: { projectId: id },
        select: { id: true },
      });
      await purgeAttachments({
        OR: [
          { entityType: "project_thumbnail", entityId: id },
          { entityType: "project", entityId: id },
          ...(projectMessages.length > 0
            ? [{ entityType: "message", entityId: { in: projectMessages.map((m) => m.id) } }]
            : []),
        ],
      });

      await db.project.delete({ where: { id } });
      break;
    }
    case "task": {
      const task = await db.task.findUnique({ where: { id }, select: { id: true } });
      if (!task) return;
      await purgeTaskFiles(id);
      await db.task.delete({ where: { id } });
      break;
    }
    case "asset": {
      const asset = await db.projectAsset.findUnique({ where: { id }, select: { r2Key: true } });
      if (!asset) return;
      await purgeR2Keys([asset.r2Key]);
      await db.projectAsset.delete({ where: { id } });
      break;
    }
    case "folder": {
      const folder = await db.projectFolder.findUnique({ where: { id }, select: { id: true } });
      if (!folder) return;
      const assets = await collectFolderAssets(id);
      await purgeR2Keys(assets.map((a) => a.r2Key));
      // Row deletion cascades to nested folders and asset rows.
      await db.projectFolder.delete({ where: { id } });
      break;
    }
  }
}
