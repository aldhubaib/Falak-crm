import { Readable } from "node:stream";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { uploadBytes, uploadStream, abortMultipartUpload } from "@/lib/storage";

// Only small files may be buffered in memory; anything larger must arrive
// with a Content-Length so it can be streamed straight through to R2.
const MAX_BUFFERED_BYTES = 10 * 1024 * 1024;

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

  const contentType = request.headers.get("content-type") || attachment.contentType || "application/octet-stream";
  const key = attachment.r2Key ?? id;

  // This endpoint is the server-side fallback used when direct browser → R2
  // uploads are blocked (e.g. CORS). If the file was started as a multipart
  // upload, abort the dangling multipart session before writing the whole
  // object in a single PUT so the two don't conflict on finalize.
  if (attachment.uploadId && attachment.r2Key) {
    await abortMultipartUpload(attachment.r2Key, attachment.uploadId);
  }

  const declaredLength = Number(request.headers.get("content-length") ?? NaN);

  if (Number.isFinite(declaredLength) && declaredLength > 0 && request.body) {
    // Stream the body straight to R2 — no whole-file buffering in RAM.
    await uploadStream(
      Readable.fromWeb(request.body as import("node:stream/web").ReadableStream),
      declaredLength,
      key,
      contentType,
    );
  } else {
    // No usable Content-Length (e.g. chunked encoding): buffering is the only
    // option, so cap it to keep a single request from exhausting memory.
    const body = await request.arrayBuffer();
    if (body.byteLength > MAX_BUFFERED_BYTES) {
      return NextResponse.json(
        { error: "File too large for proxy upload without Content-Length" },
        { status: 413 },
      );
    }
    await uploadBytes(Buffer.from(body), key, contentType);
  }

  // Mark uploaded and clear the multipart id so a subsequent /complete call
  // is a harmless no-op regardless of the path the client took.
  await db.attachment.update({
    where: { id },
    data: { status: "uploaded", uploadId: null },
  });

  return NextResponse.json({ ok: true });
}
