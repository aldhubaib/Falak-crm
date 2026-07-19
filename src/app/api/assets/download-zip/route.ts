import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/workspace";
import { zipStream, zipResponseHeaders, type ZipEntry } from "@/lib/zip-stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Zip an arbitrary selection of asset files (multi-select download on the
// project assets page): GET /api/assets/download-zip?ids=a,b,c
export async function GET(req: Request) {
  const workspace = await requireWorkspace();
  const ids = (new URL(req.url).searchParams.get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 500);

  if (ids.length === 0) {
    return NextResponse.json({ error: "No files selected" }, { status: 400 });
  }

  const assets = await db.projectAsset.findMany({
    where: {
      id: { in: ids },
      deletedAt: null,
      project: { workspaceId: workspace.id },
    },
    select: { name: true, r2Key: true, project: { select: { name: true } } },
  });
  if (assets.length === 0) {
    return NextResponse.json({ error: "Files not found" }, { status: 404 });
  }

  // The selection is flat — files sharing a name get a " (n)" suffix so no
  // zip entry silently overwrites another.
  const used = new Map<string, number>();
  const entries: ZipEntry[] = assets.map((a) => {
    const n = used.get(a.name) ?? 0;
    used.set(a.name, n + 1);
    const zipPath =
      n === 0
        ? a.name
        : a.name.replace(/(\.[^.]*)?$/, (ext) => ` (${n})${ext}`);
    return { r2Key: a.r2Key, zipPath };
  });

  return new NextResponse(zipStream(entries), {
    headers: zipResponseHeaders(`${assets[0]!.project.name} files`),
  });
}
