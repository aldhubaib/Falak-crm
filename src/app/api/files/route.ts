import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/workspace";
import {
  generateR2Key,
  createPresignedPut,
  createMultipartUpload,
  presignUploadPart,
  computeParts,
  MULTIPART_THRESHOLD,
  PART_SIZE,
} from "@/lib/storage";

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspace = await requireWorkspace();
  const body = await request.json();

  const { name, sizeBytes, contentType, entityType, entityId } = body as {
    name: string;
    sizeBytes: number;
    contentType: string;
    entityType: string;
    entityId: string;
  };

  if (!name || !sizeBytes || !contentType || !entityType || !entityId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const r2Key = generateR2Key(entityType, name);
  const useMultipart = sizeBytes > MULTIPART_THRESHOLD;

  let uploadId: string | null = null;
  let uploadUrl: string | null = null;
  let parts: { number: number; url: string }[] = [];
  let totalParts = 1;

  if (useMultipart) {
    uploadId = await createMultipartUpload(r2Key, contentType);
    const partInfo = computeParts(sizeBytes);
    totalParts = partInfo.length;
    parts = await Promise.all(
      partInfo.map(async (p) => ({
        number: p.number,
        url: await presignUploadPart(r2Key, uploadId!, p.number),
      }))
    );
  } else {
    uploadUrl = await createPresignedPut(r2Key, contentType);
  }

  const attachment = await db.attachment.create({
    data: {
      workspaceId: workspace.id,
      entityType,
      entityId,
      name,
      sizeBytes,
      contentType,
      r2Key,
      status: "uploading",
      uploadId,
      totalParts,
      uploadedParts: [],
    },
  });

  return NextResponse.json({
    id: attachment.id,
    r2Key,
    uploadId,
    uploadUrl,
    parts,
    partSize: PART_SIZE,
    totalParts,
  });
}
