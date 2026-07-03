"use server";

import { requireWorkspaceWithMember } from "@/lib/workspace";
import { canEdit } from "@/lib/permissions";
import { db } from "@/lib/db";
import {
  generateR2Key,
  uploadBytes,
  deleteObject,
  createPresignedGet,
} from "@/lib/storage";

export type LoginPhotoDTO = {
  id: string;
  column: "a" | "b";
  order: number;
  url: string;
};

async function requireSettingsEditor() {
  const { member } = await requireWorkspaceWithMember();
  if (!canEdit(member, "settings")) throw new Error("Permission denied");
  return member;
}

function normalizeColumn(value: unknown): "a" | "b" {
  return value === "b" ? "b" : "a";
}

// Authenticated read for the settings screen (presigned URLs).
export async function getLoginPhotos(): Promise<LoginPhotoDTO[]> {
  await requireSettingsEditor();

  const photos = await db.loginPhoto.findMany({
    orderBy: [{ column: "asc" }, { order: "asc" }, { createdAt: "asc" }],
  });

  return Promise.all(
    photos.map(async (p) => ({
      id: p.id,
      column: normalizeColumn(p.column),
      order: p.order,
      url: await createPresignedGet(p.r2Key),
    })),
  );
}

export async function addLoginPhoto(formData: FormData): Promise<void> {
  await requireSettingsEditor();

  const file = formData.get("file");
  const column = normalizeColumn(formData.get("column"));

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("No image provided");
  }
  if (!file.type.startsWith("image/")) {
    throw new Error("Only image files are allowed");
  }

  const key = generateR2Key("login_photo", file.name || "photo.jpg");
  const bytes = Buffer.from(await file.arrayBuffer());
  await uploadBytes(bytes, key, file.type || "application/octet-stream");

  const last = await db.loginPhoto.findFirst({
    where: { column },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  await db.loginPhoto.create({
    data: {
      r2Key: key,
      contentType: file.type || null,
      column,
      order: (last?.order ?? -1) + 1,
    },
  });
}

export async function removeLoginPhoto(id: string): Promise<void> {
  await requireSettingsEditor();

  const photo = await db.loginPhoto.findUnique({ where: { id } });
  if (!photo) return;

  await deleteObject(photo.r2Key);
  await db.loginPhoto.delete({ where: { id } });
}

export async function setLoginPhotoColumn(
  id: string,
  column: "a" | "b",
): Promise<void> {
  await requireSettingsEditor();

  const target = normalizeColumn(column);
  const last = await db.loginPhoto.findFirst({
    where: { column: target },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  await db.loginPhoto.update({
    where: { id },
    data: { column: target, order: (last?.order ?? -1) + 1 },
  });
}
