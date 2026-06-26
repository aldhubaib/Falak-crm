import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/workspace";
import { getObject } from "@/lib/storage";
import JSZip from "jszip";

async function collectFiles(
  folderId: string,
  zip: JSZip,
  path: string,
) {
  const assets = await db.projectAsset.findMany({
    where: { folderId },
    select: { name: true, r2Key: true },
  });

  for (const asset of assets) {
    try {
      const data = await getObject(asset.r2Key);
      if (data) zip.file(`${path}${asset.name}`, data as ArrayBuffer);
    } catch {}
  }

  const children = await db.projectFolder.findMany({
    where: { parentId: folderId },
    select: { id: true, name: true },
  });

  for (const child of children) {
    await collectFiles(child.id, zip, `${path}${child.name}/`);
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await requireWorkspace();

  const folder = await db.projectFolder.findUnique({
    where: { id },
    select: { name: true, projectId: true },
  });

  if (!folder) {
    return NextResponse.json({ error: "Folder not found" }, { status: 404 });
  }

  const zip = new JSZip();
  await collectFiles(id, zip, "");

  const buffer = await zip.generateAsync({ type: "arraybuffer" });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${folder.name}.zip"`,
    },
  });
}
