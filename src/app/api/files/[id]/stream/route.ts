import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
// Shared client (big keep-alive socket pool). A private client here had its
// own default 50-socket pool: long-lived video streams filled it and every
// chat image request queued behind them forever — bubbles rendered empty.
import { s3, BUCKET } from "@/lib/storage";

export const runtime = "nodejs";

type SdkBody = {
  transformToWebStream: () => ReadableStream;
};

// Same-origin media endpoint for <video>/<audio> src. Proxies bytes from R2
// with proper Range / 206 support so desktop browsers can seek and play.
// A 302 redirect to a presigned URL works on some mobile PWAs but breaks
// playback in regular browser tabs — Range follow-ups leave the app origin
// and the player stalls even when metadata (duration) loads.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // The id is either an Attachment (task/chat files) or a ProjectAsset (the
  // project assets page) — both preview through this same proxy.
  const attachment = await db.attachment.findUnique({
    where: { id },
    select: { r2Key: true, contentType: true, sizeBytes: true },
  });
  let file: { r2Key: string; contentType: string | null; sizeBytes: number | null } | null =
    attachment?.r2Key
      ? {
          r2Key: attachment.r2Key,
          contentType: attachment.contentType,
          sizeBytes: attachment.sizeBytes,
        }
      : null;
  if (!file) {
    const asset = await db.projectAsset.findUnique({
      where: { id },
      select: { r2Key: true, contentType: true, fileSize: true, deletedAt: true },
    });
    if (asset?.r2Key && !asset.deletedAt) {
      file = {
        r2Key: asset.r2Key,
        contentType: asset.contentType,
        sizeBytes: asset.fileSize,
      };
    }
  }

  if (!file)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rangeHeader = request.headers.get("range");
  const contentType = file.contentType || "application/octet-stream";
  // Tie the R2 request to the browser's: a seek/closed tab aborts the transfer
  // and frees its socket instead of streaming the rest of the file to no one.
  const abortSignal = request.signal;

  if (rangeHeader) {
    const head = await s3.send(
      new HeadObjectCommand({ Bucket: BUCKET, Key: file.r2Key }),
      { abortSignal },
    );
    const totalSize = head.ContentLength ?? file.sizeBytes ?? 0;
    const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
    const start = match ? parseInt(match[1], 10) : 0;
    const end = match && match[2] ? parseInt(match[2], 10) : totalSize - 1;

    const resp = await s3.send(
      new GetObjectCommand({
        Bucket: BUCKET,
        Key: file.r2Key,
        Range: `bytes=${start}-${end}`,
      }),
      { abortSignal },
    );

    const body = resp.Body as SdkBody | undefined;
    if (!body)
      return NextResponse.json({ error: "Empty body" }, { status: 500 });

    return new NextResponse(body.transformToWebStream(), {
      status: 206,
      headers: {
        "Content-Type": contentType,
        "Content-Range": `bytes ${start}-${end}/${totalSize}`,
        "Content-Length": String(end - start + 1),
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, no-store",
      },
    });
  }

  const resp = await s3.send(
    new GetObjectCommand({ Bucket: BUCKET, Key: file.r2Key }),
    { abortSignal },
  );

  const body = resp.Body as SdkBody | undefined;
  if (!body)
    return NextResponse.json({ error: "Empty body" }, { status: 500 });

  return new NextResponse(body.transformToWebStream(), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(resp.ContentLength ?? 0),
      "Accept-Ranges": "bytes",
      // An attachment id's bytes never change — let the browser keep chat
      // images/media instead of re-proxying them from R2 on every render.
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
