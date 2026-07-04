import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { createPresignedGet } from "@/lib/storage";

// Same-origin media endpoint used as <video>/<audio>/<img> src. After the auth
// check it redirects to a presigned R2 URL so the bytes stream directly from
// object storage to the browser — proxying them through the app server made
// playback crawl (double transfer, one Range round-trip per seek) and tied up
// server bandwidth that other users need.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const attachment = await db.attachment.findUnique({
    where: { id },
    select: { r2Key: true },
  });

  if (!attachment?.r2Key)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const url = await createPresignedGet(attachment.r2Key);

  // Let the browser reuse the redirect for follow-up Range requests (seeking)
  // without re-hitting this route. Kept well below the presign expiry (1h).
  return NextResponse.redirect(url, {
    status: 302,
    headers: { "Cache-Control": "private, max-age=1800" },
  });
}
