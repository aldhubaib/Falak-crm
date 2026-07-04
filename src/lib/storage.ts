import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  HeadBucketCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const BUCKET = process.env.R2_BUCKET_NAME || "falak-crm";

const PRESIGNED_EXPIRY = 3600; // 1 hour
const PART_SIZE = 10 * 1024 * 1024; // 10 MB
const MULTIPART_THRESHOLD = 20 * 1024 * 1024; // 20 MB

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: ACCESS_KEY_ID,
    secretAccessKey: SECRET_ACCESS_KEY,
  },
});

export { BUCKET, PART_SIZE, MULTIPART_THRESHOLD, PRESIGNED_EXPIRY };

export function generateR2Key(prefix: string, filename: string): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const time = now.toISOString().slice(11, 19).replace(/:/g, "");
  const rand = crypto.randomUUID().slice(0, 8);
  const ext = filename.includes(".") ? filename.split(".").pop() : "bin";
  return `${prefix}/${date}/${time}_${rand}.${ext}`;
}

export async function createPresignedPut(
  key: string,
  contentType: string
): Promise<string> {
  return getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType }),
    { expiresIn: PRESIGNED_EXPIRY }
  );
}

export async function createPresignedGet(
  key: string,
  downloadName?: string
): Promise<string> {
  // When a filename is supplied, force the browser to save the file instead of
  // rendering it inline. This is what makes downloads reliable on iOS Safari,
  // where the anchor `download` attribute is ignored for cross-origin URLs.
  const responseContentDisposition = downloadName
    ? `attachment; filename="${asciiFallback(downloadName)}"; filename*=UTF-8''${encodeRFC5987(downloadName)}`
    : undefined;

  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ResponseContentDisposition: responseContentDisposition,
    }),
    { expiresIn: PRESIGNED_EXPIRY }
  );
}

// Strip characters that can't live in a quoted `filename=` value so the plain
// (non-UTF-8) fallback is always safe.
function asciiFallback(name: string): string {
  // eslint-disable-next-line no-control-regex
  return name.replace(/["\\\r\n]/g, "_").replace(/[^\x20-\x7E]/g, "_");
}

// RFC 5987 encoding for the `filename*` parameter (preserves unicode names).
function encodeRFC5987(name: string): string {
  return encodeURIComponent(name)
    .replace(/['()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase())
    .replace(/%(7C|60|5E)/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

export async function createMultipartUpload(
  key: string,
  contentType: string
): Promise<string> {
  const resp = await s3.send(
    new CreateMultipartUploadCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType,
    })
  );
  return resp.UploadId!;
}

export async function presignUploadPart(
  key: string,
  uploadId: string,
  partNumber: number
): Promise<string> {
  return getSignedUrl(
    s3,
    new UploadPartCommand({
      Bucket: BUCKET,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
    }),
    { expiresIn: PRESIGNED_EXPIRY }
  );
}

export async function completeMultipartUpload(
  key: string,
  uploadId: string,
  parts: { PartNumber: number; ETag: string }[]
): Promise<void> {
  await s3.send(
    new CompleteMultipartUploadCommand({
      Bucket: BUCKET,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts },
    })
  );
}

export async function abortMultipartUpload(
  key: string,
  uploadId: string
): Promise<void> {
  try {
    await s3.send(
      new AbortMultipartUploadCommand({
        Bucket: BUCKET,
        Key: key,
        UploadId: uploadId,
      })
    );
  } catch {
    // Ignore — upload may already be completed or aborted
  }
}

export async function getObject(key: string): Promise<ArrayBuffer | null> {
  const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  if (!res.Body) return null;
  const bytes = await res.Body.transformToByteArray();
  return bytes.buffer as ArrayBuffer;
}

// Streaming read — use this instead of getObject() whenever the bytes are
// piped somewhere (zip building, proxying), so large media files never have to
// fit in server memory.
export async function getObjectStream(
  key: string,
): Promise<NodeJS.ReadableStream | null> {
  const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  if (!res.Body) return null;
  return res.Body as unknown as NodeJS.ReadableStream;
}

export async function deleteObject(key: string): Promise<void> {
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  } catch {
    // Ignore — object may not exist
  }
}

export async function uploadBytes(
  data: Buffer | Uint8Array,
  key: string,
  contentType: string
): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: data,
      ContentType: contentType,
    })
  );
}

export async function headBucket(): Promise<boolean> {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: BUCKET }));
    return true;
  } catch {
    return false;
  }
}

export function computeParts(sizeBytes: number): { number: number; start: number; end: number }[] {
  const numParts = Math.ceil(sizeBytes / PART_SIZE);
  return Array.from({ length: numParts }, (_, i) => ({
    number: i + 1,
    start: i * PART_SIZE,
    end: Math.min((i + 1) * PART_SIZE, sizeBytes),
  }));
}
