"use server";

import { db } from "@/lib/db";
import { getProjectAccess, requireProjectWork } from "@/lib/workspace";
import { revalidatePath } from "next/cache";
import { softDelete } from "@/lib/soft-delete";

export async function getProjectAssets(projectId: string, folderId?: string | null) {
  const access = await getProjectAccess(projectId);
  if (!access.hasAccess || !access.project) throw new Error("Project not found");

  const [folders, assets] = await Promise.all([
    db.projectFolder.findMany({
      where: { projectId, parentId: folderId || null, deletedAt: null },
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: {
            assets: { where: { deletedAt: null } },
            children: { where: { deletedAt: null } },
          },
        },
      },
    }),
    db.projectAsset.findMany({
      where: { projectId, folderId: folderId || null, deletedAt: null },
      orderBy: { createdAt: "desc" },
      // Newest 500 per folder — bounds the query for bulk-imported folders.
      take: 500,
    }),
  ]);

  return { folders, assets };
}

export async function getAllProjectFolders(projectId: string) {
  const access = await getProjectAccess(projectId);
  if (!access.hasAccess || !access.project) throw new Error("Project not found");

  return db.projectFolder.findMany({
    where: { projectId, deletedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true, parentId: true },
  });
}

export async function createFolder(projectId: string, name: string, parentId?: string | null) {
  await requireProjectWork(projectId);

  const folder = await db.projectFolder.create({
    data: {
      projectId,
      parentId: parentId || null,
      name: name.trim(),
    },
  });

  revalidatePath(`/projects/${projectId}`);

  return folder.id;
}

export async function renameFolder(folderId: string, name: string) {
  const existing = await db.projectFolder.findUnique({ where: { id: folderId }, select: { projectId: true } });
  if (!existing) throw new Error("Folder not found");
  await requireProjectWork(existing.projectId);

  const folder = await db.projectFolder.update({
    where: { id: folderId },
    data: { name: name.trim() },
  });

  revalidatePath(`/projects/${folder.projectId}`);
}

export async function deleteFolder(folderId: string) {
  const existing = await db.projectFolder.findUnique({ where: { id: folderId }, select: { projectId: true } });
  if (!existing) throw new Error("Folder not found");
  const { member } = await requireProjectWork(existing.projectId);

  // Goes to Settings → Trash; files stay in R2 until the trash is emptied.
  await softDelete("folder", folderId, member.id);

  revalidatePath(`/projects/${existing.projectId}`);
  revalidatePath("/settings/trash");
}

export async function createAsset(data: {
  projectId: string;
  folderId?: string | null;
  name: string;
  fileSize: number;
  contentType: string;
  r2Key: string;
}) {
  const { member } = await requireProjectWork(data.projectId);

  const asset = await db.projectAsset.create({
    data: {
      projectId: data.projectId,
      folderId: data.folderId || null,
      name: data.name,
      fileSize: data.fileSize,
      contentType: data.contentType,
      r2Key: data.r2Key,
      uploadedBy: member.id,
    },
  });

  revalidatePath(`/projects/${data.projectId}`);
  return asset;
}

export async function deleteAsset(assetId: string) {
  const asset = await db.projectAsset.findUnique({ where: { id: assetId } });
  if (!asset) throw new Error("Asset not found");
  const { member } = await requireProjectWork(asset.projectId);

  // Goes to Settings → Trash; the file stays in R2 until the trash is emptied.
  await softDelete("asset", assetId, member.id);

  revalidatePath(`/projects/${asset.projectId}`);
  revalidatePath("/settings/trash");
}

export async function renameAsset(assetId: string, name: string) {
  const existing = await db.projectAsset.findUnique({ where: { id: assetId }, select: { projectId: true } });
  if (!existing) throw new Error("Asset not found");
  await requireProjectWork(existing.projectId);

  const asset = await db.projectAsset.update({
    where: { id: assetId },
    data: { name: name.trim() },
  });

  revalidatePath(`/projects/${asset.projectId}`);
}

export async function getFolderBreadcrumbs(folderId: string) {
  const crumbs: { id: string; name: string }[] = [];
  let current = await db.projectFolder.findUnique({
    where: { id: folderId },
    select: { id: true, name: true, parentId: true },
  });
  while (current) {
    crumbs.unshift({ id: current.id, name: current.name });
    if (!current.parentId) break;
    current = await db.projectFolder.findUnique({
      where: { id: current.parentId },
      select: { id: true, name: true, parentId: true },
    });
  }
  return crumbs;
}

export async function moveAsset(assetId: string, targetFolderId: string | null) {
  const existing = await db.projectAsset.findUnique({ where: { id: assetId }, select: { projectId: true } });
  if (!existing) throw new Error("Asset not found");
  await requireProjectWork(existing.projectId);

  const asset = await db.projectAsset.update({
    where: { id: assetId },
    data: { folderId: targetFolderId },
  });

  revalidatePath(`/projects/${asset.projectId}`);
}

export async function moveFolder(folderId: string, targetParentId: string | null) {
  const existing = await db.projectFolder.findUnique({ where: { id: folderId }, select: { projectId: true } });
  if (!existing) throw new Error("Folder not found");
  await requireProjectWork(existing.projectId);

  if (folderId === targetParentId) return;

  const folder = await db.projectFolder.update({
    where: { id: folderId },
    data: { parentId: targetParentId },
  });

  revalidatePath(`/projects/${folder.projectId}`);
}
