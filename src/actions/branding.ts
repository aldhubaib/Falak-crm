"use server";

import sharp from "sharp";
import { requireWorkspaceWithMember } from "@/lib/workspace";
import { canEdit } from "@/lib/permissions";
import { db } from "@/lib/db";
import {
  generateR2Key,
  uploadBytes,
  deleteObject,
  createPresignedGet,
} from "@/lib/storage";
import {
  getBrandingSlot,
  storageSlotsFor,
  validateBrandingFile,
  type BrandingSlotId,
} from "@/lib/branding-slots";

export type BrandingAssetDTO = {
  slot: BrandingSlotId;
  url: string;
  name: string;
  mime: string;
  width: number;
  height: number;
  size: number;
  updatedAt: number;
};

async function requireSettingsEditor() {
  const { member } = await requireWorkspaceWithMember();
  if (!canEdit(member, "settings")) throw new Error("Permission denied");
  return member;
}

// Authenticated read for the settings screen (presigned preview URLs).
export async function getBrandingAssets(): Promise<
  Partial<Record<BrandingSlotId, BrandingAssetDTO>>
> {
  await requireSettingsEditor();

  const rows = await db.brandingAsset.findMany();
  const bySlot = new Map(rows.map((r) => [r.slot, r]));

  const result: Partial<Record<BrandingSlotId, BrandingAssetDTO>> = {};
  for (const slot of [
    "favicon",
    "faviconDark",
    "appleTouchIcon",
    "androidAny",
    "androidMaskable",
    "webLogo",
    "ogImage",
    "androidMonochrome",
    "iosSplash",
  ] as BrandingSlotId[]) {
    // For the Android slots prefer the 512 row (better preview quality).
    const row = storageSlotsFor(slot)
      .slice()
      .reverse()
      .map((s) => bySlot.get(s))
      .find(Boolean);
    if (!row) continue;
    result[slot] = {
      slot,
      url: await createPresignedGet(row.r2Key),
      name: row.fileName,
      mime: row.contentType,
      width: row.width,
      height: row.height,
      size: row.size,
      updatedAt: row.updatedAt.getTime(),
    };
  }
  return result;
}

// ICO isn't supported by sharp — read the first ICONDIRENTRY from the header.
function icoDimensions(
  buf: Buffer,
): { width: number; height: number } | null {
  if (buf.length < 8) return null;
  if (buf.readUInt16LE(0) !== 0 || buf.readUInt16LE(2) !== 1) return null;
  return {
    width: buf[6] === 0 ? 256 : buf[6],
    height: buf[7] === 0 ? 256 : buf[7],
  };
}

async function measureBytes(
  bytes: Buffer,
  mime: string,
): Promise<{ width: number; height: number }> {
  if (mime === "image/svg+xml") return { width: 0, height: 0 };
  if (mime === "image/x-icon" || mime === "image/vnd.microsoft.icon") {
    const dims = icoDimensions(bytes);
    if (!dims) throw new Error("Could not read image dimensions");
    return dims;
  }
  const meta = await sharp(bytes).metadata();
  if (!meta.width || !meta.height)
    throw new Error("Could not read image dimensions");
  return { width: meta.width, height: meta.height };
}

async function upsertAsset(
  slot: string,
  data: {
    bytes: Buffer;
    mime: string;
    fileName: string;
    width: number;
    height: number;
  },
) {
  const key = generateR2Key("branding", data.fileName || "logo.png");
  await uploadBytes(data.bytes, key, data.mime);

  const existing = await db.brandingAsset.findUnique({ where: { slot } });
  await db.brandingAsset.upsert({
    where: { slot },
    create: {
      slot,
      r2Key: key,
      contentType: data.mime,
      fileName: data.fileName,
      width: data.width,
      height: data.height,
      size: data.bytes.byteLength,
    },
    update: {
      r2Key: key,
      contentType: data.mime,
      fileName: data.fileName,
      width: data.width,
      height: data.height,
      size: data.bytes.byteLength,
    },
  });
  if (existing) await deleteObject(existing.r2Key);
}

export async function setBrandingAsset(formData: FormData): Promise<void> {
  await requireSettingsEditor();

  const slotId = String(formData.get("slot") || "");
  const slot = getBrandingSlot(slotId);
  if (!slot) throw new Error("Unknown logo slot");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("No image provided");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const mime = file.type || "application/octet-stream";
  const dims = await measureBytes(bytes, mime);

  const error = validateBrandingFile(slot, file.type, file.name, dims);
  if (error) throw new Error(error);

  if (slot.id === "androidAny" || slot.id === "androidMaskable") {
    // Store both manifest sizes of the same artwork; the size that wasn't
    // uploaded is generated with sharp.
    for (const size of [192, 512]) {
      const resized =
        dims.width === size
          ? bytes
          : await sharp(bytes).resize(size, size).png().toBuffer();
      await upsertAsset(`${slot.id}${size}`, {
        bytes: resized,
        mime: "image/png",
        fileName: file.name,
        width: size,
        height: size,
      });
    }
    return;
  }

  await upsertAsset(slot.id, {
    bytes,
    mime,
    fileName: file.name,
    width: dims.width,
    height: dims.height,
  });
}

export async function removeBrandingAsset(slotId: BrandingSlotId): Promise<void> {
  await requireSettingsEditor();

  const slot = getBrandingSlot(slotId);
  if (!slot) throw new Error("Unknown logo slot");

  for (const storageSlot of storageSlotsFor(slot.id)) {
    const row = await db.brandingAsset.findUnique({
      where: { slot: storageSlot },
    });
    if (!row) continue;
    await deleteObject(row.r2Key);
    await db.brandingAsset.delete({ where: { slot: storageSlot } });
  }
}
