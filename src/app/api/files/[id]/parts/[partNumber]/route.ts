import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; partNumber: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, partNumber } = await params;
  const body = await request.json();
  const { etag } = body as { etag: string };

  const attachment = await db.attachment.findUnique({ where: { id } });
  if (!attachment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const existing = Array.isArray(attachment.uploadedParts) ? attachment.uploadedParts : [];
  const parts = [...(existing as { PartNumber: number; ETag: string }[]), { PartNumber: parseInt(partNumber), ETag: etag }];

  await db.attachment.update({
    where: { id },
    data: { uploadedParts: parts as unknown as import("@/generated/prisma").Prisma.InputJsonValue },
  });

  return NextResponse.json({
    uploaded: parts.length,
    total: attachment.totalParts,
  });
}
