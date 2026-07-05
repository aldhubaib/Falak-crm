import { PassThrough, Readable } from "node:stream";
import { NextResponse } from "next/server";
import { ZipArchive } from "archiver";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/workspace";
import { getObjectStream } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ZipEntry = { r2Key: string; zipPath: string };

// Walk the folder tree and collect (r2Key, path-in-zip) pairs. Only metadata
// is loaded here — file bytes are streamed one at a time while zipping.
async function collectEntries(
  folderId: string,
  path: string,
  out: ZipEntry[],
): Promise<void> {
  const assets = await db.projectAsset.findMany({
    where: { folderId, deletedAt: null },
    select: { name: true, r2Key: true },
  });
  for (const asset of assets) {
    out.push({ r2Key: asset.r2Key, zipPath: `${path}${asset.name}` });
  }

  const children = await db.projectFolder.findMany({
    where: { parentId: folderId, deletedAt: null },
    select: { id: true, name: true },
  });
  for (const child of children) {
    await collectEntries(child.id, `${path}${child.name}/`, out);
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const workspace = await requireWorkspace();

  const folder = await db.projectFolder.findFirst({
    where: { id, project: { workspaceId: workspace.id }, deletedAt: null },
    select: { name: true, projectId: true },
  });

  if (!folder) {
    return NextResponse.json({ error: "Folder not found" }, { status: 404 });
  }

  const entries: ZipEntry[] = [];
  await collectEntries(id, "", entries);

  // Media files (video, images) are already compressed — store them as-is so
  // zipping is I/O-bound instead of burning CPU on zlib for no gain.
  const archive = new ZipArchive({ store: true });
  const pass = new PassThrough();
  archive.on("error", (err) => pass.destroy(err));
  archive.pipe(pass);

  // Feed entries sequentially: each file is streamed R2 → zip → response with
  // only one object open at a time, so memory stays flat regardless of folder
  // size. (The old implementation buffered every file AND the final zip in
  // RAM, which OOM'd the server on large media folders.)
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

  return new NextResponse(Readable.toWeb(pass) as unknown as ReadableStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${folder.name.replace(/["\\\r\n]/g, "_")}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
