import { notFound } from "next/navigation";
import { getProjectMeta } from "@/actions/projects";
import { getProjectAssets, getFolderBreadcrumbs } from "@/actions/assets";
import { createPresignedGet } from "@/lib/storage";
import { getProjectAccess } from "@/lib/workspace";
import { hasCap } from "@/lib/permissions";
import { AppHeader } from "@/components/app-header";
import { ProjectViewMenu } from "@/components/projects/project-view-menu";
import { AssetsClient, type AssetVM, type FolderVM } from "./assets-client";

export default async function ProjectAssetsPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ folder?: string }>;
}) {
  const { projectId } = await params;
  const { folder } = await searchParams;
  const folderId = folder || null;

  const [project, data, crumbs, access] = await Promise.all([
    getProjectMeta(projectId),
    getProjectAssets(projectId, folderId),
    folderId ? getFolderBreadcrumbs(folderId) : Promise.resolve([]),
    getProjectAccess(projectId),
  ]);

  if (!project) notFound();

  const folders: FolderVM[] = data.folders.map((f) => ({
    id: f.id,
    name: f.name,
    itemCount: f._count.assets + f._count.children,
  }));

  // Sign all URLs in one parallel batch (two per asset) instead of awaiting
  // them one at a time per asset.
  const assets: AssetVM[] = await Promise.all(
    data.assets.map(async (a) => {
      const [url, downloadUrl] = a.r2Key
        ? await Promise.all([
            createPresignedGet(a.r2Key),
            createPresignedGet(a.r2Key, a.name),
          ])
        : [null, null];
      return {
        id: a.id,
        name: a.name,
        fileSize: a.fileSize,
        contentType: a.contentType,
        url,
        downloadUrl,
      };
    }),
  );

  const breadcrumbs = [
    { id: null as string | null, name: "All Files" },
    ...crumbs.map((c) => ({ id: c.id as string | null, name: c.name })),
  ];

  return (
    <>
      <AppHeader
        backHref="/projects"
        title={project.name}
        actions={
          <ProjectViewMenu
            projectId={projectId}
            showSettings={hasCap(access.permissions, "projects", "editSettings")}
          />
        }
      />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <AssetsClient
          projectId={projectId}
          folderId={folderId}
          breadcrumbs={breadcrumbs}
          folders={folders}
          assets={assets}
        />
      </main>
    </>
  );
}
