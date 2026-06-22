import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { createPresignedGet, PRESIGNED_EXPIRY } from "@/lib/storage";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const attachment = await db.attachment.findUnique({ where: { id } });
  if (!attachment || !attachment.r2Key) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = await createPresignedGet(attachment.r2Key);
  return NextResponse.json({ url, expiresIn: PRESIGNED_EXPIRY });
}
