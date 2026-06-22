import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { completeMultipartUpload } from "@/lib/storage";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const attachment = await db.attachment.findUnique({ where: { id } });
  if (!attachment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (attachment.uploadId && attachment.r2Key) {
    const parts = (attachment.uploadedParts as { PartNumber: number; ETag: string }[])
      .sort((a, b) => a.PartNumber - b.PartNumber);
    await completeMultipartUpload(attachment.r2Key, attachment.uploadId, parts);
  }

  const updated = await db.attachment.update({
    where: { id },
    data: { status: "uploaded" },
  });

  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    status: updated.status,
    r2Key: updated.r2Key,
  });
}
