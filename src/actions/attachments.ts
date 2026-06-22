"use server";

import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/workspace";
import { deleteObject, abortMultipartUpload } from "@/lib/storage";
import { safeAction, type ActionResult } from "@/lib/action";
import { revalidatePath } from "next/cache";

export type AttachmentInfo = {
  id: string;
  name: string;
  sizeBytes: number | null;
  contentType: string | null;
  status: string;
  createdAt: Date;
};

export async function getAttachments(
  entityType: string,
  entityId: string
): Promise<AttachmentInfo[]> {
  const workspace = await requireWorkspace();
  const attachments = await db.attachment.findMany({
    where: {
      workspaceId: workspace.id,
      entityType,
      entityId,
      status: "uploaded",
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      sizeBytes: true,
      contentType: true,
      status: true,
      createdAt: true,
    },
  });
  return attachments;
}

export async function deleteAttachment(
  id: string,
  revalidate?: string
): Promise<ActionResult> {
  return safeAction("Delete Attachment", async () => {
    const workspace = await requireWorkspace();

    const attachment = await db.attachment.findFirst({
      where: { id, workspaceId: workspace.id },
    });
    if (!attachment) throw new Error("Attachment not found");

    if (attachment.uploadId && attachment.status === "uploading" && attachment.r2Key) {
      await abortMultipartUpload(attachment.r2Key, attachment.uploadId);
    }
    if (attachment.r2Key) {
      await deleteObject(attachment.r2Key);
    }

    await db.attachment.delete({ where: { id } });

    if (revalidate) revalidatePath(revalidate);
  });
}
