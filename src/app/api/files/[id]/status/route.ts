import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const attachment = await db.attachment.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      totalParts: true,
      uploadedParts: true,
      uploadId: true,
      r2Key: true,
      contentType: true,
    },
  });

  if (!attachment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parts = Array.isArray(attachment.uploadedParts) ? attachment.uploadedParts : [];
  const uploadedPartNumbers = (parts as { PartNumber: number; ETag: string }[]).map(
    (p) => p.PartNumber
  );

  return NextResponse.json({
    id: attachment.id,
    status: attachment.status,
    totalParts: attachment.totalParts,
    uploadedPartNumbers,
    uploadId: attachment.uploadId,
    r2Key: attachment.r2Key,
    contentType: attachment.contentType,
  });
}
