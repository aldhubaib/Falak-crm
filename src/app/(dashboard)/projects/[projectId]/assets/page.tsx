import { notFound } from "next/navigation";
import { getProject } from "@/actions/projects";
import { getProjectAssets, getFolderBreadcrumbs } from "@/actions/assets";
import { createPresignedGet } from "@/lib/storage";
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

  const [project, data, crumbs] = await Promise.all([
    getProject(projectId),
    getProjectAssets(projectId, folderId),
    folderId ? getFolderBreadcrumbs(folderId) : Promise.resolve([]),
  ]);

  if (!project) notFound();

  const folders: FolderVM[] = data.folders.map((f) => ({
    id: f.id,
    name: f.name,
    itemCount: f._count.assets + f._count.children,
  }));

  const assets: AssetVM[] = await Promise.all(
    data.assets.map(async (a) => ({
      id: a.id,
      name: a.name,
      fileSize: a.fileSize,
      contentType: a.contentType,
      url: a.r2Key ? await createPresignedGet(a.r2Key) : null,
      downloadUrl: a.r2Key ? await createPresignedGet(a.r2Key, a.name) : null,
    })),
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
        actions={<ProjectViewMenu projectId={projectId} />}
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
