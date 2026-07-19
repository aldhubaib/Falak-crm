import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/workspace";
import { zipStream, zipResponseHeaders, type ZipEntry } from "@/lib/zip-stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  return new NextResponse(zipStream(entries), {
    headers: zipResponseHeaders(folder.name),
  });
}
