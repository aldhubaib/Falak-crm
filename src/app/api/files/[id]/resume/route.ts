import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { presignUploadPart } from "@/lib/storage";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const { partNumbers } = body as { partNumbers: number[] };

  if (!Array.isArray(partNumbers) || partNumbers.length === 0) {
    return NextResponse.json({ error: "partNumbers array required" }, { status: 400 });
  }

  const attachment = await db.attachment.findUnique({
    where: { id },
    select: { uploadId: true, r2Key: true, status: true },
  });

  if (!attachment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!attachment.uploadId || !attachment.r2Key) {
    return NextResponse.json({ error: "Not a multipart upload" }, { status: 400 });
  }

  const parts = await Promise.all(
    partNumbers.map(async (num) => ({
      number: num,
      url: await presignUploadPart(attachment.r2Key!, attachment.uploadId!, num),
    }))
  );

  return NextResponse.json({ parts });
}
