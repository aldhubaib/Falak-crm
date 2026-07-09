"use server";

// Workspace-wide custom notification sound. Stored like a branding asset
// (unique slot row + R2 object); every member's browser plays it when a
// notification arrives while the app is open. Without an upload the client
// falls back to a built-in chime.

import { requireWorkspaceWithMember, requireWorkspace } from "@/lib/workspace";
import { canEdit } from "@/lib/permissions";
import { db } from "@/lib/db";
import {
  generateR2Key,
  uploadBytes,
  deleteObject,
  createPresignedGet,
} from "@/lib/storage";
import { publish, userChannel } from "@/lib/centrifugo";
import { revalidatePath } from "next/cache";

const SLOT = "notificationSound";
const MAX_SOUND_BYTES = 2 * 1024 * 1024; // 2 MB — notification sounds are short

export type NotificationSoundDTO = {
  url: string;
  name: string;
  size: number;
  updatedAt: number;
};

async function requireSettingsEditor() {
  const { workspace, member } = await requireWorkspaceWithMember();
  if (!canEdit(member, "settings")) throw new Error("Permission denied");
  return { workspace, member };
}

// Force every open client to drop its cached sound URL so the next
// notification plays the freshly uploaded file, not a stale cache.
async function broadcastSoundUpdated(workspaceId: string): Promise<void> {
  const members = await db.workspaceMember.findMany({
    where: { workspaceId },
    select: { id: true },
  });
  await Promise.all(
    members.map((m) =>
      publish(userChannel(m.id), { type: "notification.sound-updated" }).catch(
        () => {},
      ),
    ),
  );
}

// Detect the real audio format from magic bytes — the browser-reported mime
// comes from the file extension and can be spoofed.
function sniffAudioMime(bytes: Buffer): string | null {
  if (bytes.length < 12) return null;
  const ascii = (start: number, len: number) =>
    bytes.subarray(start, start + len).toString("latin1");
  if (ascii(0, 3) === "ID3") return "audio/mpeg";
  if (bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0) return "audio/mpeg";
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WAVE") return "audio/wav";
  if (ascii(0, 4) === "OggS") return "audio/ogg";
  if (ascii(4, 4) === "ftyp") return "audio/mp4"; // m4a/aac
  return null;
}

// Settings screen read (editors only).
export async function getNotificationSound(): Promise<NotificationSoundDTO | null> {
  await requireSettingsEditor();
  const row = await db.brandingAsset.findUnique({ where: { slot: SLOT } });
  if (!row) return null;
  return {
    url: await createPresignedGet(row.r2Key),
    name: row.fileName,
    size: row.size,
    updatedAt: row.updatedAt.getTime(),
  };
}

// Playback read — any signed-in member fetches the sound for their device.
// `version` (the upload time) keys the client's local cache: same version =
// same bytes, no re-download needed.
export async function getNotificationSoundUrl(): Promise<{
  url: string;
  version: number;
} | null> {
  await requireWorkspace();
  const row = await db.brandingAsset.findUnique({ where: { slot: SLOT } });
  if (!row) return null;
  return {
    url: await createPresignedGet(row.r2Key),
    version: row.updatedAt.getTime(),
  };
}

export async function setNotificationSound(formData: FormData): Promise<void> {
  const { workspace } = await requireSettingsEditor();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("No audio file provided");
  }
  if (file.size > MAX_SOUND_BYTES) {
    throw new Error("File is too large. Maximum is 2 MB.");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const mime = sniffAudioMime(bytes);
  if (!mime) {
    throw new Error("Wrong format. Use an MP3, WAV, OGG, or M4A file.");
  }

  const key = generateR2Key("notification-sound", file.name || "sound.mp3");
  await uploadBytes(bytes, key, mime);

  const existing = await db.brandingAsset.findUnique({ where: { slot: SLOT } });
  await db.brandingAsset.upsert({
    where: { slot: SLOT },
    create: {
      slot: SLOT,
      r2Key: key,
      contentType: mime,
      fileName: file.name,
      size: bytes.byteLength,
    },
    update: {
      r2Key: key,
      contentType: mime,
      fileName: file.name,
      size: bytes.byteLength,
    },
  });
  if (existing) await deleteObject(existing.r2Key);

  await broadcastSoundUpdated(workspace.id);
  revalidatePath("/settings/notifications");
}

export async function removeNotificationSound(): Promise<void> {
  const { workspace } = await requireSettingsEditor();

  const row = await db.brandingAsset.findUnique({ where: { slot: SLOT } });
  if (!row) return;
  await deleteObject(row.r2Key);
  await db.brandingAsset.delete({ where: { slot: SLOT } });

  await broadcastSoundUpdated(workspace.id);
  revalidatePath("/settings/notifications");
}
