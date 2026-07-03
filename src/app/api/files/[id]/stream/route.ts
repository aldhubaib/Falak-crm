import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import {
  S3Client,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME || "falak-crm";

export const runtime = "nodejs";

type SdkBody = {
  transformToWebStream: () => ReadableStream;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const attachment = await db.attachment.findUnique({
    where: { id },
    select: { r2Key: true, contentType: true, sizeBytes: true },
  });

  if (!attachment?.r2Key)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rangeHeader = request.headers.get("range");
  const contentType = attachment.contentType || "application/octet-stream";

  if (rangeHeader) {
    const head = await s3.send(
      new HeadObjectCommand({ Bucket: BUCKET, Key: attachment.r2Key }),
    );
    const totalSize = head.ContentLength ?? 0;
    const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
    const start = match ? parseInt(match[1], 10) : 0;
    const end = match && match[2] ? parseInt(match[2], 10) : totalSize - 1;

    const resp = await s3.send(
      new GetObjectCommand({
        Bucket: BUCKET,
        Key: attachment.r2Key,
        Range: `bytes=${start}-${end}`,
      }),
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
        "Cache-Control": "private, max-age=3600",
      },
    });
  }

  const resp = await s3.send(
    new GetObjectCommand({ Bucket: BUCKET, Key: attachment.r2Key }),
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
      "Cache-Control": "private, max-age=3600",
    },
  });
}
