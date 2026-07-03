import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { createPresignedGet } from "@/lib/storage";

// Same-origin download endpoint. Redirects to a presigned URL that carries
// `Content-Disposition: attachment`, which forces the browser to SAVE the file
// instead of opening it inline. This is required for reliable downloads on iOS
// Safari, where the anchor `download` attribute is ignored for cross-origin URLs.
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

  const url = await createPresignedGet(attachment.r2Key, attachment.name);
  return NextResponse.redirect(url, 302);
}
