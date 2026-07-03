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
  const pn = parseInt(partNumber, 10);

  if (!etag) return NextResponse.json({ error: "Missing etag" }, { status: 400 });

  type Part = { PartNumber: number; ETag: string };

  // Register this part's ETag atomically. Concurrent part uploads (up to
  // MAX_CONCURRENT_PARTS on the client) would otherwise race on this JSON
  // array and silently drop a part via a lost update — producing a corrupt,
  // truncated file. A row-level lock (SELECT ... FOR UPDATE) serializes the
  // read-modify-write so every part is recorded exactly once.
  let total = 1;
  const merged = await db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ uploadedParts: unknown; totalParts: number }[]>`
      SELECT "uploadedParts", "totalParts" FROM "Attachment" WHERE id = ${id} FOR UPDATE
    `;
    if (rows.length === 0) return null;

    total = rows[0].totalParts;
    const existing = Array.isArray(rows[0].uploadedParts)
      ? (rows[0].uploadedParts as Part[])
      : [];
    // Drop any prior entry for this part (retries) so the latest ETag wins and
    // we never store duplicate part numbers.
    const next = existing.filter((p) => p.PartNumber !== pn);
    next.push({ PartNumber: pn, ETag: etag });

    await tx.attachment.update({
      where: { id },
      data: {
        uploadedParts:
          next as unknown as import("@/generated/prisma").Prisma.InputJsonValue,
      },
    });
    return next;
  });

  if (!merged) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ uploaded: merged.length, total });
}
