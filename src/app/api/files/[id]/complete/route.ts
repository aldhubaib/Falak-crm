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
    const raw = Array.isArray(attachment.uploadedParts)
      ? (attachment.uploadedParts as { PartNumber: number; ETag: string }[])
      : [];

    // Dedupe by part number (retries may have recorded a part more than once),
    // keeping the last ETag seen for each.
    const byNum = new Map<number, string>();
    for (const p of raw) byNum.set(p.PartNumber, p.ETag);

    // Guard against assembling a truncated file: every expected part must be
    // present. Completing a multipart upload with a missing part silently
    // concatenates the rest into a corrupt object (moov atom lost, dead player).
    const expected = attachment.totalParts;
    const missing: number[] = [];
    for (let n = 1; n <= expected; n++) {
      if (!byNum.has(n)) missing.push(n);
    }
    if (missing.length > 0) {
      return NextResponse.json(
        {
          error: `Upload incomplete: ${byNum.size}/${expected} parts registered`,
          missing,
        },
        { status: 409 }
      );
    }

    const parts = Array.from(byNum.entries())
      .map(([PartNumber, ETag]) => ({ PartNumber, ETag }))
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
