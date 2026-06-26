"use server";

import { db } from "@/lib/db";
import { requireWorkspaceWithMember } from "@/lib/workspace";
import { canEdit } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { deleteObject } from "@/lib/storage";

export async function getProjectAssets(projectId: string, folderId?: string | null) {
  const { workspace } = await requireWorkspaceWithMember();

  const project = await db.project.findFirst({
    where: { id: projectId, workspaceId: workspace.id },
    select: { id: true },
  });
  if (!project) throw new Error("Project not found");

  const [folders, assets] = await Promise.all([
    db.projectFolder.findMany({
      where: { projectId, parentId: folderId || null },
      orderBy: { name: "asc" },
      include: { _count: { select: { assets: true, children: true } } },
    }),
    db.projectAsset.findMany({
      where: { projectId, folderId: folderId || null },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return { folders, assets };
}

export async function createFolder(projectId: string, name: string, parentId?: string | null) {
  const { member } = await requireWorkspaceWithMember();
  if (!canEdit(member, "projects")) throw new Error("Permission denied");

  await db.projectFolder.create({
    data: {
      projectId,
      parentId: parentId || null,
      name: name.trim(),
    },
  });

  revalidatePath(`/projects/${projectId}`);
}

export async function renameFolder(folderId: string, name: string) {
  const { member } = await requireWorkspaceWithMember();
  if (!canEdit(member, "projects")) throw new Error("Permission denied");

  const folder = await db.projectFolder.update({
    where: { id: folderId },
    data: { name: name.trim() },
  });

  revalidatePath(`/projects/${folder.projectId}`);
}

export async function deleteFolder(folderId: string) {
  const { member } = await requireWorkspaceWithMember();
  if (!canEdit(member, "projects")) throw new Error("Permission denied");

  const allAssets = await getNestedAssets(folderId);
  if (allAssets.length > 0) {
    await Promise.all(allAssets.map((a) => deleteObject(a.r2Key)));
  }

  const folder = await db.projectFolder.delete({ where: { id: folderId } });
  revalidatePath(`/projects/${folder.projectId}`);
}

async function getNestedAssets(folderId: string): Promise<{ r2Key: string }[]> {
  const assets = await db.projectAsset.findMany({
    where: { folderId },
    select: { r2Key: true },
  });
  const children = await db.projectFolder.findMany({
    where: { parentId: folderId },
    select: { id: true },
  });
  const nested = await Promise.all(children.map((c) => getNestedAssets(c.id)));
  return [...assets, ...nested.flat()];
}

export async function createAsset(data: {
  projectId: string;
  folderId?: string | null;
  name: string;
  fileSize: number;
  contentType: string;
  r2Key: string;
}) {
  const { member } = await requireWorkspaceWithMember();
  if (!canEdit(member, "projects")) throw new Error("Permission denied");

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
  const { member } = await requireWorkspaceWithMember();
  if (!canEdit(member, "projects")) throw new Error("Permission denied");

  const asset = await db.projectAsset.findUnique({ where: { id: assetId } });
  if (!asset) throw new Error("Asset not found");

  await deleteObject(asset.r2Key);
  await db.projectAsset.delete({ where: { id: assetId } });

  revalidatePath(`/projects/${asset.projectId}`);
}

export async function renameAsset(assetId: string, name: string) {
  const { member } = await requireWorkspaceWithMember();
  if (!canEdit(member, "projects")) throw new Error("Permission denied");

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
  const { member } = await requireWorkspaceWithMember();
  if (!canEdit(member, "projects")) throw new Error("Permission denied");

  const asset = await db.projectAsset.update({
    where: { id: assetId },
    data: { folderId: targetFolderId },
  });

  revalidatePath(`/projects/${asset.projectId}`);
}

export async function moveFolder(folderId: string, targetParentId: string | null) {
  const { member } = await requireWorkspaceWithMember();
  if (!canEdit(member, "projects")) throw new Error("Permission denied");

  if (folderId === targetParentId) return;

  const folder = await db.projectFolder.update({
    where: { id: folderId },
    data: { parentId: targetParentId },
  });

  revalidatePath(`/projects/${folder.projectId}`);
}
