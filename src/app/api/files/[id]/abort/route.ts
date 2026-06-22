import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { abortMultipartUpload, deleteObject } from "@/lib/storage";

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
    await abortMultipartUpload(attachment.r2Key, attachment.uploadId);
  }
  if (attachment.r2Key) {
    await deleteObject(attachment.r2Key);
  }

  await db.attachment.delete({ where: { id } });

  return NextResponse.json({ status: "aborted", id });
}
