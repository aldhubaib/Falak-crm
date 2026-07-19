import { PassThrough, Readable } from "node:stream";
import { ZipArchive } from "archiver";
import { getObjectStream } from "@/lib/storage";

export type ZipEntry = { r2Key: string; zipPath: string };

// Stream R2 objects into a zip suitable for an HTTP response body. Media files
// are already compressed — entries are stored as-is so zipping is I/O-bound
// instead of burning CPU on zlib for no gain. Files are fed sequentially with
// only one object open at a time, so memory stays flat regardless of size.
export function zipStream(entries: ZipEntry[]): ReadableStream {
  const archive = new ZipArchive({ store: true });
  const pass = new PassThrough();
  archive.on("error", (err) => pass.destroy(err));
  archive.pipe(pass);

  void (async () => {
    try {
      for (const entry of entries) {
        let source: NodeJS.ReadableStream | null = null;
        try {
          source = await getObjectStream(entry.r2Key);
        } catch {
          continue; // skip objects that no longer exist
        }
        if (!source) continue;

        await new Promise<void>((resolve, reject) => {
          const onEntry = (data: { name?: string }) => {
            if (data.name === entry.zipPath) {
              archive.off("entry", onEntry);
              resolve();
            }
          };
          archive.on("entry", onEntry);
          (source as Readable).once("error", (err: Error) => {
            archive.off("entry", onEntry);
            reject(err);
          });
          archive.append(source as Readable, { name: entry.zipPath });
        }).catch(() => {
          // Skip unreadable objects; keep the rest of the archive going.
        });
      }
      await archive.finalize();
    } catch (err) {
      pass.destroy(err instanceof Error ? err : new Error("Zip failed"));
    }
  })();

  return Readable.toWeb(pass) as unknown as ReadableStream;
}

export function zipResponseHeaders(filename: string): HeadersInit {
  return {
    "Content-Type": "application/zip",
    "Content-Disposition": `attachment; filename="${filename.replace(/["\\\r\n]/g, "_")}.zip"`,
    "Cache-Control": "no-store",
  };
}
