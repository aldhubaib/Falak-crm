import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { uploadBytes } from "@/lib/storage";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const attachment = await db.attachment.findUnique({ where: { id } });
  if (!attachment || attachment.status !== "uploading") {
    return NextResponse.json({ error: "Attachment not found or already completed" }, { status: 404 });
  }

  const body = await request.arrayBuffer();
  const contentType = request.headers.get("content-type") || attachment.contentType || "application/octet-stream";

  await uploadBytes(Buffer.from(body), attachment.r2Key ?? id, contentType);

  return NextResponse.json({ ok: true });
}
