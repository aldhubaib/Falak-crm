import { db } from "@/lib/db";

export type EntityType = "company" | "contact" | "deal" | "project";

export type RelationBlock = {
  type: EntityType;
  label: string;
  count: number;
  items: { id: string; name: string }[];
};

/**
 * Check what relations would block deletion of an entity.
 * Returns an array of blocking relations (empty means safe to delete).
 */
export async function checkDeletionBlocks(
  type: EntityType,
  id: string
): Promise<RelationBlock[]> {
  const blocks: RelationBlock[] = [];

  if (type === "company") {
    const contacts = await db.contact.findMany({
      where: { companyId: id, deletedAt: null },
      select: { id: true, firstName: true, lastName: true },
      take: 5,
    });
    if (contacts.length > 0) {
      blocks.push({
        type: "contact",
        label: "Contacts",
        count: contacts.length,
        items: contacts.map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}` })),
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

/**
 * Soft delete an entity (set deletedAt).
 */
export async function softDelete(type: EntityType, id: string) {
  const now = new Date();

  switch (type) {
    case "company":
      await db.company.update({ where: { id }, data: { deletedAt: now } });
      break;
    case "contact":
      await db.contact.update({ where: { id }, data: { deletedAt: now } });
      break;
    case "deal":
      await db.deal.update({ where: { id }, data: { deletedAt: now } });
      break;
    case "project":
      await db.project.update({ where: { id }, data: { deletedAt: now } });
      break;
  }
}

/**
 * Restore a soft-deleted entity.
 */
export async function restoreEntity(type: EntityType, id: string) {
  switch (type) {
    case "company":
      await db.company.update({ where: { id }, data: { deletedAt: null } });
      break;
    case "contact":
      await db.contact.update({ where: { id }, data: { deletedAt: null } });
      break;
    case "deal":
      await db.deal.update({ where: { id }, data: { deletedAt: null } });
      break;
    case "project":
      await db.project.update({ where: { id }, data: { deletedAt: null } });
      break;
  }
}
