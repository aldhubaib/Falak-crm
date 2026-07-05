"use server";

import { requireWorkspace, requireWorkspaceWithMember } from "@/lib/workspace";
import { checkDeletionBlocks, softDelete, restoreEntity, permanentDelete, type EntityType, type RelationBlock } from "@/lib/soft-delete";
import { logActivity } from "@/lib/activity";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { createPresignedGet } from "@/lib/storage";
import { safeAction, type ActionResult } from "@/lib/action";

export async function checkCanDelete(type: EntityType, id: string): Promise<RelationBlock[]> {
  await requireWorkspace();
  return checkDeletionBlocks(type, id);
}

export async function deleteRecord(type: EntityType, id: string): Promise<ActionResult<{ blocks?: RelationBlock[] }>> {
  return safeAction(`Delete ${type}`, async () => {
    const { member } = await requireWorkspaceWithMember();

    if (type !== "task") {
      const blocks = await checkDeletionBlocks(type, id);
      if (blocks.length > 0) {
        return { blocks };
      }
    }

    await softDelete(type, id, member.id);

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
    await requireWorkspace();

    // getTrashItems is bounded per entity type, so drain in batches until the
    // trash is actually empty.
    for (;;) {
      const items = await getTrashItems();
      if (items.length === 0) break;
      for (const item of items) {
        await permanentDelete(item.type, item.id);
      }
    }

    revalidatePath("/settings/trash");
    revalidatePath("/dashboard");
  });
}

// Bounded to the most recent deletions per entity type so the trash page never
// loads an unbounded workspace history in one query.
const TRASH_PAGE_SIZE = 50;

export async function getTrashItems() {
  const workspace = await requireWorkspace();

  const [companies, contacts, deals, projects, tasks, assets, folders] = await Promise.all([
    db.company.findMany({
      where: { workspaceId: workspace.id, deletedAt: { not: null } },
      select: { id: true, name: true, deletedAt: true, deletedBy: true },
      orderBy: { deletedAt: "desc" },
      take: TRASH_PAGE_SIZE,
    }),
    db.contact.findMany({
      where: { workspaceId: workspace.id, deletedAt: { not: null } },
      select: { id: true, firstName: true, lastName: true, deletedAt: true, deletedBy: true },
      orderBy: { deletedAt: "desc" },
      take: TRASH_PAGE_SIZE,
    }),
    db.deal.findMany({
      where: { workspaceId: workspace.id, deletedAt: { not: null } },
      select: { id: true, title: true, deletedAt: true, deletedBy: true },
      orderBy: { deletedAt: "desc" },
      take: TRASH_PAGE_SIZE,
    }),
    db.project.findMany({
      where: { workspaceId: workspace.id, deletedAt: { not: null } },
      select: { id: true, name: true, deletedAt: true, deletedBy: true },
      orderBy: { deletedAt: "desc" },
      take: TRASH_PAGE_SIZE,
    }),
    db.task.findMany({
      where: { project: { workspaceId: workspace.id }, deletedAt: { not: null } },
      select: { id: true, title: true, deletedAt: true, deletedBy: true, project: { select: { id: true, name: true } } },
      orderBy: { deletedAt: "desc" },
      take: TRASH_PAGE_SIZE,
    }),
    db.projectAsset.findMany({
      where: { project: { workspaceId: workspace.id }, deletedAt: { not: null } },
      select: { id: true, name: true, deletedAt: true, deletedBy: true, project: { select: { name: true } } },
      orderBy: { deletedAt: "desc" },
      take: TRASH_PAGE_SIZE,
    }),
    db.projectFolder.findMany({
      where: { project: { workspaceId: workspace.id }, deletedAt: { not: null } },
      select: { id: true, name: true, deletedAt: true, deletedBy: true, project: { select: { name: true } } },
      orderBy: { deletedAt: "desc" },
      take: TRASH_PAGE_SIZE,
    }),
  ]);

  const items = [
    ...companies.map((c) => ({ id: c.id, type: "company" as EntityType, name: c.name, deletedAt: c.deletedAt!, deletedBy: c.deletedBy, href: null as string | null })),
    ...contacts.map((c) => ({ id: c.id, type: "contact" as EntityType, name: `${c.firstName} ${c.lastName}`, deletedAt: c.deletedAt!, deletedBy: c.deletedBy, href: null as string | null })),
    ...deals.map((d) => ({ id: d.id, type: "deal" as EntityType, name: d.title, deletedAt: d.deletedAt!, deletedBy: d.deletedBy, href: null as string | null })),
    ...projects.map((p) => ({ id: p.id, type: "project" as EntityType, name: p.name, deletedAt: p.deletedAt!, deletedBy: p.deletedBy, href: null as string | null })),
    // Tasks open the real task page (read-only with a trash banner) so they can
    // be reviewed exactly as they were before deletion.
    ...tasks.map((t) => ({ id: t.id, type: "task" as EntityType, name: `${t.title} (${t.project.name})`, deletedAt: t.deletedAt!, deletedBy: t.deletedBy, href: `/projects/${t.project.id}/tasks/${t.id}` as string | null })),
    ...assets.map((a) => ({ id: a.id, type: "asset" as EntityType, name: `${a.name} (${a.project.name})`, deletedAt: a.deletedAt!, deletedBy: a.deletedBy, href: null as string | null })),
    ...folders.map((f) => ({ id: f.id, type: "folder" as EntityType, name: `${f.name} (${f.project.name})`, deletedAt: f.deletedAt!, deletedBy: f.deletedBy, href: null as string | null })),
  ].sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime());

  const memberNames = await resolveMemberNames(items.map((i) => i.deletedBy));

  return items.map(({ deletedBy, ...rest }) => ({
    ...rest,
    deletedByName: deletedBy ? memberNames.get(deletedBy) ?? null : null,
  }));
}

async function resolveMemberNames(ids: (string | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => !!id))];
  if (unique.length === 0) return new Map();
  const members = await db.workspaceMember.findMany({
    where: { id: { in: unique } },
    select: { id: true, name: true, email: true },
  });
  return new Map(members.map((m) => [m.id, m.name || m.email]));
}

// ─── Trash item preview ─────────────────────────────────────────────────────────

export type TrashPreview = {
  title: string;
  deletedByName: string | null;
  deletedAt: string | null;
  fields: { label: string; value: string }[];
  media: { kind: "image" | "video" | "audio"; url: string; name: string }[];
  list: { kind: "file" | "folder" | "done" | "todo"; label: string; hint?: string }[];
};

function mediaKind(contentType: string | null | undefined): "image" | "video" | "audio" | null {
  if (!contentType) return null;
  if (contentType.startsWith("image/")) return "image";
  if (contentType.startsWith("video/")) return "video";
  if (contentType.startsWith("audio/")) return "audio";
  return null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDate(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function pushField(fields: { label: string; value: string }[], label: string, value: string | null | undefined) {
  if (value) fields.push({ label, value });
}

export async function getTrashPreview(type: EntityType, id: string): Promise<TrashPreview | null> {
  const workspace = await requireWorkspace();

  const fields: TrashPreview["fields"] = [];
  const media: TrashPreview["media"] = [];
  const list: TrashPreview["list"] = [];

  if (type === "company") {
    const c = await db.company.findFirst({
      where: { id, workspaceId: workspace.id },
      include: { _count: { select: { contacts: true, deals: true, projects: true } } },
    });
    if (!c) return null;
    pushField(fields, "Arabic name", c.nameAr);
    pushField(fields, "Industry", c.industry);
    pushField(fields, "Email", c.email);
    pushField(fields, "Phone", c.phone);
    pushField(fields, "WhatsApp", c.whatsappNumber);
    pushField(fields, "Website", c.website);
    pushField(fields, "Address", c.address);
    pushField(fields, "Notes", c.notes);
    pushField(fields, "Linked records", `${c._count.contacts} contacts · ${c._count.deals} deals · ${c._count.projects} projects`);
    return await finishPreview(c.name, c.deletedAt, c.deletedBy, fields, media, list);
  }

  if (type === "contact") {
    const c = await db.contact.findFirst({
      where: { id, workspaceId: workspace.id },
      include: { companies: { include: { company: { select: { name: true } } } } },
    });
    if (!c) return null;
    pushField(fields, "Mobile", c.mobile);
    pushField(fields, "Email", c.email);
    pushField(fields, "Role", c.role);
    pushField(fields, "Country", c.country);
    pushField(fields, "Companies", c.companies.map((cc) => cc.company.name).join(", ") || null);
    pushField(fields, "Notes", c.notes);
    return await finishPreview(`${c.firstName} ${c.lastName}`, c.deletedAt, c.deletedBy, fields, media, list);
  }

  if (type === "deal") {
    const d = await db.deal.findFirst({
      where: { id, workspaceId: workspace.id },
      include: {
        stage: { select: { name: true } },
        pipeline: { select: { name: true } },
        company: { select: { name: true } },
        contact: { select: { firstName: true, lastName: true } },
      },
    });
    if (!d) return null;
    pushField(fields, "Value", `${Number(d.value).toLocaleString()} ${d.currency}`);
    pushField(fields, "Pipeline", d.pipeline?.name);
    pushField(fields, "Stage", d.stage?.name);
    pushField(fields, "Company", d.company?.name);
    pushField(fields, "Contact", d.contact ? `${d.contact.firstName} ${d.contact.lastName}` : null);
    pushField(fields, "Expected close", formatDate(d.expectedCloseDate));
    pushField(fields, "Notes", d.notes);
    return await finishPreview(d.title, d.deletedAt, d.deletedBy, fields, media, list);
  }

  if (type === "project") {
    const p = await db.project.findFirst({
      where: { id, workspaceId: workspace.id },
      include: {
        status: { select: { name: true } },
        company: { select: { name: true } },
        _count: {
          select: {
            tasks: { where: { deletedAt: null } },
            assets: { where: { deletedAt: null } },
          },
        },
      },
    });
    if (!p) return null;
    pushField(fields, "Status", p.status?.name);
    pushField(fields, "Company", p.company?.name);
    pushField(fields, "Description", p.description);
    pushField(fields, "Deadline", formatDate(p.deadline));
    pushField(fields, "Contents", `${p._count.tasks} tasks · ${p._count.assets} files`);
    if (p.thumbnailId) {
      const thumb = await db.attachment.findUnique({
        where: { id: p.thumbnailId },
        select: { r2Key: true, name: true },
      });
      if (thumb?.r2Key) {
        media.push({ kind: "image", url: await createPresignedGet(thumb.r2Key), name: thumb.name });
      }
    }
    return await finishPreview(p.name, p.deletedAt, p.deletedBy, fields, media, list);
  }

  if (type === "task") {
    const t = await db.task.findFirst({
      where: { id, project: { workspaceId: workspace.id } },
      include: {
        project: { select: { name: true } },
        status: { select: { name: true } },
        assignee: { select: { name: true, email: true } },
        checklistItems: { orderBy: { order: "asc" } },
      },
    });
    if (!t) return null;
    pushField(fields, "Project", t.project.name);
    pushField(fields, "Stage", t.status?.name);
    pushField(fields, "Assignee", t.assignee ? t.assignee.name || t.assignee.email : null);
    pushField(fields, "Due date", formatDate(t.dueDate));
    pushField(fields, "Description", t.description);

    const attachmentIds = t.checklistItems
      .map((ci) => ci.attachmentId)
      .filter((aid): aid is string => !!aid);
    const attachments = attachmentIds.length
      ? await db.attachment.findMany({
          where: { id: { in: attachmentIds } },
          select: { id: true, name: true, contentType: true, r2Key: true },
        })
      : [];
    const attachmentById = new Map(attachments.map((a) => [a.id, a]));

    for (const ci of t.checklistItems) {
      const attachment = ci.attachmentId ? attachmentById.get(ci.attachmentId) : null;
      list.push({
        kind: ci.completed ? "done" : "todo",
        label: ci.name,
        hint: attachment?.name ?? (ci.textValue || undefined),
      });
      const kind = mediaKind(attachment?.contentType);
      if (attachment?.r2Key && kind) {
        media.push({ kind, url: await createPresignedGet(attachment.r2Key), name: attachment.name });
      }
    }
    return await finishPreview(t.title, t.deletedAt, t.deletedBy, fields, media, list);
  }

  if (type === "asset") {
    const a = await db.projectAsset.findFirst({
      where: { id, project: { workspaceId: workspace.id } },
      include: { project: { select: { name: true } }, folder: { select: { name: true } } },
    });
    if (!a) return null;
    pushField(fields, "Project", a.project.name);
    pushField(fields, "Folder", a.folder?.name);
    pushField(fields, "Type", a.contentType);
    pushField(fields, "Size", formatBytes(a.fileSize));
    pushField(fields, "Uploaded", formatDate(a.createdAt));
    if (a.uploadedBy) {
      const names = await resolveMemberNames([a.uploadedBy]);
      pushField(fields, "Uploaded by", names.get(a.uploadedBy));
    }
    const kind = mediaKind(a.contentType);
    if (kind) {
      media.push({ kind, url: await createPresignedGet(a.r2Key), name: a.name });
    }
    return await finishPreview(a.name, a.deletedAt, a.deletedBy, fields, media, list);
  }

  if (type === "folder") {
    const f = await db.projectFolder.findFirst({
      where: { id, project: { workspaceId: workspace.id } },
      include: { project: { select: { name: true } } },
    });
    if (!f) return null;
    pushField(fields, "Project", f.project.name);

    let totalFiles = 0;
    let totalBytes = 0;
    const MAX_LIST = 50;
    const walk = async (folderId: string, prefix: string) => {
      const [assets, children] = await Promise.all([
        db.projectAsset.findMany({
          where: { folderId },
          select: { name: true, fileSize: true, contentType: true, r2Key: true },
          orderBy: { name: "asc" },
        }),
        db.projectFolder.findMany({
          where: { parentId: folderId },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        }),
      ]);
      for (const asset of assets) {
        totalFiles += 1;
        totalBytes += asset.fileSize;
        if (list.length < MAX_LIST) {
          list.push({ kind: "file", label: `${prefix}${asset.name}`, hint: formatBytes(asset.fileSize) });
        }
        const kind = mediaKind(asset.contentType);
        if (kind === "image" && media.length < 6) {
          media.push({ kind, url: await createPresignedGet(asset.r2Key), name: asset.name });
        }
      }
      for (const child of children) {
        if (list.length < MAX_LIST) {
          list.push({ kind: "folder", label: `${prefix}${child.name}` });
        }
        await walk(child.id, `${prefix}${child.name} / `);
      }
    };
    await walk(id, "");
    pushField(fields, "Contents", `${totalFiles} files · ${formatBytes(totalBytes)}`);
    return await finishPreview(f.name, f.deletedAt, f.deletedBy, fields, media, list);
  }

  return null;
}

async function finishPreview(
  title: string,
  deletedAt: Date | null,
  deletedBy: string | null,
  fields: TrashPreview["fields"],
  media: TrashPreview["media"],
  list: TrashPreview["list"],
): Promise<TrashPreview> {
  const names = await resolveMemberNames([deletedBy]);
  return {
    title,
    deletedAt: deletedAt ? deletedAt.toISOString() : null,
    deletedByName: deletedBy ? names.get(deletedBy) ?? null : null,
    fields,
    media,
    list,
  };
}
