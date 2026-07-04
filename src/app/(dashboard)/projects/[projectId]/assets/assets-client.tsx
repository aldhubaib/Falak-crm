"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  Folder,
  FolderPlus,
  Upload,
  File as FileIcon,
  FileText,
  Image as ImageIcon,
  Video as VideoIcon,
  Music,
  MoreHorizontal,
  Download,
  FolderInput,
  Pencil,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useActionHandler } from "@/hooks/use-action";
import {
  createFolder,
  renameFolder,
  renameAsset,
  deleteFolder,
  deleteAsset,
  moveAsset,
  moveFolder,
  getAllProjectFolders,
} from "@/actions/assets";
import { uploadManager } from "@/lib/upload-manager";

export type FolderVM = { id: string; name: string; itemCount: number };
export type AssetVM = {
  id: string;
  name: string;
  fileSize: number | null;
  contentType: string | null;
  /** Presigned URL for inline preview (image/video/audio). */
  url: string | null;
  /** Presigned URL that forces a file save (Content-Disposition: attachment). */
  downloadUrl: string | null;
};
type Crumb = { id: string | null; name: string };
type Target =
  | { kind: "folder"; id: string; name: string }
  | { kind: "asset"; id: string; name: string };

function isPreviewable(contentType: string | null): boolean {
  const ct = contentType ?? "";
  return ct.startsWith("image/") || ct.startsWith("video/") || ct.startsWith("audio/");
}

function formatBytes(bytes: number | null): string {
  if (!bytes || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function iconFor(contentType: string | null) {
  const ct = contentType ?? "";
  if (ct.startsWith("image/")) return ImageIcon;
  if (ct.startsWith("video/")) return VideoIcon;
  if (ct.startsWith("audio/")) return Music;
  if (ct.includes("pdf") || ct.includes("word") || ct.includes("text"))
    return FileText;
  return FileIcon;
}

// A file pulled from a drag-drop, with its folder path relative to the drop root.
type DroppedFile = { file: File; path: string[] };

function entryToFile(entry: FileSystemFileEntry): Promise<File | null> {
  return new Promise((resolve) =>
    entry.file(
      (f) => resolve(f),
      () => resolve(null),
    ),
  );
}

// readEntries returns children in batches; keep calling until it returns empty.
function readAllDirEntries(
  reader: FileSystemDirectoryReader,
): Promise<FileSystemEntry[]> {
  return new Promise((resolve) => {
    const all: FileSystemEntry[] = [];
    const read = () =>
      reader.readEntries(
        (batch) => {
          if (batch.length === 0) resolve(all);
          else {
            all.push(...batch);
            read();
          }
        },
        () => resolve(all),
      );
    read();
  });
}

// Recursively flatten a dropped file/directory entry into files + their paths.
async function walkEntry(
  entry: FileSystemEntry,
  path: string[],
  out: DroppedFile[],
) {
  if (entry.isFile) {
    const file = await entryToFile(entry as FileSystemFileEntry);
    if (file) out.push({ file, path });
  } else if (entry.isDirectory) {
    const children = await readAllDirEntries(
      (entry as FileSystemDirectoryEntry).createReader(),
    );
    const dirPath = [...path, entry.name];
    for (const child of children) await walkEntry(child, dirPath, out);
  }
}

// Refresh the page when this project's asset uploads finish so new files show.
function useUploadRefresh(projectId: string) {
  const router = useRouter();
  const subscribe = useCallback(
    (cb: () => void) => uploadManager.subscribe(cb),
    [],
  );
  const getSnapshot = useCallback(
    () =>
      uploadManager
        .getItems()
        .filter(
          (i) =>
            i.target.kind === "project_asset" &&
            i.target.projectId === projectId &&
            (i.status === "uploading" ||
              i.status === "completing" ||
              i.status === "queued"),
        ).length,
    [projectId],
  );
  const active = useSyncExternalStore(subscribe, getSnapshot, () => 0);
  const prev = useRef(active);
  useEffect(() => {
    if (prev.current > 0 && active === 0) router.refresh();
    prev.current = active;
  }, [active, router]);
}

export function AssetsClient({
  projectId,
  folderId,
  breadcrumbs,
  folders,
  assets,
}: {
  projectId: string;
  folderId: string | null;
  breadcrumbs: Crumb[];
  folders: FolderVM[];
  assets: AssetVM[];
}) {
  const router = useRouter();
  const { run } = useActionHandler({ onSuccess: () => router.refresh() });
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const dragDepth = useRef(0);

  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [renameTarget, setRenameTarget] = useState<Target | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [moveTarget, setMoveTarget] = useState<Target | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Target | null>(null);
  const [previewAsset, setPreviewAsset] = useState<AssetVM | null>(null);

  useUploadRefresh(projectId);

  const handleFiles = (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    uploadManager.enqueue(list, projectId, folderId);
  };

  // Handle a drop that may contain folders. Reads any directory entries,
  // recreates their structure under the current folder, then uploads the files.
  const handleDrop = async (dt: DataTransfer) => {
    // Entries must be captured synchronously — the DataTransfer is only valid
    // for the duration of the drop event.
    const entries: FileSystemEntry[] = [];
    const items = dt.items;
    if (items && items.length && typeof items[0].webkitGetAsEntry === "function") {
      for (let i = 0; i < items.length; i++) {
        if (items[i].kind !== "file") continue;
        const entry = items[i].webkitGetAsEntry();
        if (entry) entries.push(entry);
      }
    }

    // Browser without the entry API: fall back to a flat file upload.
    if (entries.length === 0) {
      if (dt.files?.length) handleFiles(dt.files);
      return;
    }

    const dropped: DroppedFile[] = [];
    for (const entry of entries) await walkEntry(entry, [], dropped);
    if (dropped.length === 0) return;

    // No folders involved — behave exactly like a normal multi-file drop.
    if (!dropped.some((d) => d.path.length > 0)) {
      handleFiles(dropped.map((d) => d.file));
      return;
    }

    // Recreate each folder once (memoized by path), then enqueue files into them.
    const folderCache = new Map<string, string | null>([["", folderId]]);
    const ensureFolder = async (path: string[]): Promise<string | null> => {
      const key = path.join("/");
      const cached = folderCache.get(key);
      if (cached !== undefined) return cached;
      const parentId = await ensureFolder(path.slice(0, -1));
      const newId = await createFolder(
        projectId,
        path[path.length - 1],
        parentId,
      );
      folderCache.set(key, newId);
      return newId;
    };

    for (const d of dropped) {
      const target = await ensureFolder(d.path);
      uploadManager.enqueue([d.file], projectId, target);
    }
    router.refresh();
  };

  const submitNewFolder = () => {
    const name = newFolderName.trim();
    if (!name) return;
    setNewFolderOpen(false);
    setNewFolderName("");
    run("createFolder", () => createFolder(projectId, name, folderId));
  };

  const submitRename = () => {
    if (!renameTarget) return;
    const name = renameValue.trim();
    if (!name) return;
    const t = renameTarget;
    setRenameTarget(null);
    run("rename", () =>
      t.kind === "folder" ? renameFolder(t.id, name) : renameAsset(t.id, name),
    );
  };

  const submitDelete = () => {
    if (!deleteTarget) return;
    const t = deleteTarget;
    setDeleteTarget(null);
    run("delete", () =>
      t.kind === "folder" ? deleteFolder(t.id) : deleteAsset(t.id),
    );
  };

  const submitMove = (dest: string | null) => {
    if (!moveTarget) return;
    const t = moveTarget;
    setMoveTarget(null);
    run("move", () =>
      t.kind === "folder" ? moveFolder(t.id, dest) : moveAsset(t.id, dest),
    );
  };

  const empty = folders.length === 0 && assets.length === 0;

  return (
    <div
      className="relative min-h-full"
      onDragEnter={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        dragDepth.current += 1;
        setDragActive(true);
      }}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setDragActive(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        dragDepth.current = 0;
        setDragActive(false);
        void handleDrop(e.dataTransfer);
      }}
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-4 p-5">
        {/* Header: breadcrumbs + actions */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav className="flex min-w-0 items-center gap-1 text-sm">
            {breadcrumbs.map((b, i) => {
              const last = i === breadcrumbs.length - 1;
              const href =
                b.id === null
                  ? `/projects/${projectId}/assets`
                  : `/projects/${projectId}/assets?folder=${b.id}`;
              return (
                <div key={b.id ?? "root"} className="flex items-center gap-1">
                  {i > 0 && (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <Link
                    href={href}
                    className={cn(
                      "truncate rounded px-1.5 py-0.5 transition-colors hover:bg-surface",
                      last
                        ? "font-semibold text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {b.name}
                  </Link>
                </div>
              );
            })}
          </nav>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="rounded-full"
              onClick={() => setNewFolderOpen(true)}
              aria-label="New folder"
            >
              <FolderPlus className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              className="rounded-full"
              onClick={() => inputRef.current?.click()}
              aria-label="Upload"
            >
              <Upload className="h-4 w-4" />
            </Button>
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) handleFiles(e.target.files);
                e.currentTarget.value = "";
              }}
            />
          </div>
        </div>

        {/* File list */}
        {empty ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="grid min-h-64 place-items-center rounded-lg border border-dashed border-border/60 py-16 text-center text-sm text-muted-foreground transition-colors hover:border-border hover:bg-surface/40"
          >
            <div className="flex flex-col items-center gap-2">
              <Upload className="h-6 w-6" />
              <div>Drop files here or click to upload</div>
            </div>
          </button>
        ) : (
          <div className="divide-y divide-border/50 rounded-lg border border-border/60">
            {folders.map((f) => (
              <div
                key={f.id}
                className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface/60"
              >
                <Link
                  href={`/projects/${projectId}/assets?folder=${f.id}`}
                  className="flex flex-1 items-center gap-3 text-left"
                >
                  <Folder className="h-5 w-5 fill-warning/20 text-warning" />
                  <span className="truncate text-sm">{f.name}</span>
                </Link>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {f.itemCount} item{f.itemCount === 1 ? "" : "s"}
                </span>
                <RowMenu
                  onMove={() =>
                    setMoveTarget({ kind: "folder", id: f.id, name: f.name })
                  }
                  onRename={() => {
                    setRenameTarget({ kind: "folder", id: f.id, name: f.name });
                    setRenameValue(f.name);
                  }}
                  onDelete={() =>
                    setDeleteTarget({ kind: "folder", id: f.id, name: f.name })
                  }
                />
              </div>
            ))}
            {assets.map((a) => {
              const Icon = iconFor(a.contentType);
              const canPreview = isPreviewable(a.contentType) && a.url;
              return (
                <div
                  key={a.id}
                  className={cn(
                    "group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface/60",
                    canPreview && "cursor-pointer",
                  )}
                  onClick={() => canPreview && setPreviewAsset(a)}
                >
                  <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate text-sm">{a.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatBytes(a.fileSize)}
                  </span>
                  <RowMenu
                    downloadUrl={a.downloadUrl}
                    onMove={() =>
                      setMoveTarget({ kind: "asset", id: a.id, name: a.name })
                    }
                    onRename={() => {
                      setRenameTarget({ kind: "asset", id: a.id, name: a.name });
                      setRenameValue(a.name);
                    }}
                    onDelete={() =>
                      setDeleteTarget({ kind: "asset", id: a.id, name: a.name })
                    }
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Drag overlay */}
      {dragActive && (
        <div className="pointer-events-none absolute inset-0 z-40 grid place-items-center bg-primary/10 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-primary/60 bg-background/80 px-10 py-8 text-primary">
            <Upload className="h-10 w-10" />
            <div className="text-lg font-semibold">Drop to upload</div>
            <div className="text-sm text-muted-foreground">
              Files will be added to {breadcrumbs[breadcrumbs.length - 1].name}
            </div>
          </div>
        </div>
      )}

      {/* New folder dialog */}
      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New folder</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitNewFolder()}
            placeholder="Folder name"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewFolderOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitNewFolder} disabled={!newFolderName.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog
        open={!!renameTarget}
        onOpenChange={(o) => !o && setRenameTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitRename()}
            placeholder="Name"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameTarget(null)}>
              Cancel
            </Button>
            <Button onClick={submitRename} disabled={!renameValue.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move dialog */}
      {moveTarget && (
        <MoveDialog
          projectId={projectId}
          target={moveTarget}
          onClose={() => setMoveTarget(null)}
          onMove={submitMove}
        />
      )}

      {/* Delete confirm */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Delete {deleteTarget?.kind === "folder" ? "folder" : "file"}?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {deleteTarget?.kind === "folder"
              ? `"${deleteTarget?.name}" and everything inside it will be permanently deleted.`
              : `"${deleteTarget?.name}" will be permanently deleted.`}{" "}
            This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={submitDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Asset preview dialog */}
      <Dialog
        open={!!previewAsset}
        onOpenChange={(o) => !o && setPreviewAsset(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="truncate">
              {previewAsset?.name}
            </DialogTitle>
          </DialogHeader>
          {previewAsset?.url && (
            <div className="flex items-center justify-center">
              {previewAsset.contentType?.startsWith("image/") && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewAsset.url}
                  alt={previewAsset.name}
                  className="max-h-[70vh] rounded object-contain"
                />
              )}
              {previewAsset.contentType?.startsWith("video/") && (
                <video
                  controls
                  autoPlay
                  preload="metadata"
                  src={`/api/files/${previewAsset.id}/stream`}
                  className="max-h-[70vh] w-full rounded"
                />
              )}
              {previewAsset.contentType?.startsWith("audio/") && (
                <audio
                  controls
                  autoPlay
                  preload="metadata"
                  src={`/api/files/${previewAsset.id}/stream`}
                  className="w-full"
                />
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPreviewAsset(null)}>
              Close
            </Button>
            {previewAsset?.downloadUrl && (
              <Button asChild>
                <a
                  href={previewAsset.downloadUrl}
                  rel="noreferrer"
                  download
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </a>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RowMenu({
  downloadUrl,
  onMove,
  onRename,
  onDelete,
}: {
  downloadUrl?: string | null;
  onMove: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Actions"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-muted/40 hover:text-foreground group-hover:opacity-100 focus:opacity-100"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {downloadUrl && (
          <DropdownMenuItem asChild>
            <a href={downloadUrl} rel="noreferrer" download className="gap-2">
              <Download className="h-4 w-4" />
              Download
            </a>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={onMove} className="gap-2">
          <FolderInput className="h-4 w-4" />
          Move
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onRename} className="gap-2">
          <Pencil className="h-4 w-4" />
          Rename
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={onDelete}
          className="gap-2 text-destructive focus:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MoveDialog({
  projectId,
  target,
  onClose,
  onMove,
}: {
  projectId: string;
  target: Target;
  onClose: () => void;
  onMove: (dest: string | null) => void;
}) {
  const [folders, setFolders] = useState<
    { id: string; name: string; parentId: string | null }[]
  >([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getAllProjectFolders(projectId)
      .then((f) => {
        if (active) setFolders(f);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [projectId]);

  // Folders that can't be a destination: the folder being moved + its descendants.
  const forbidden = new Set<string>();
  if (target.kind === "folder") {
    forbidden.add(target.id);
    let changed = true;
    while (changed) {
      changed = false;
      for (const f of folders) {
        if (f.parentId && forbidden.has(f.parentId) && !forbidden.has(f.id)) {
          forbidden.add(f.id);
          changed = true;
        }
      }
    }
  }

  const children = folders.filter(
    (f) => f.parentId === cursor && !forbidden.has(f.id),
  );
  const currentName =
    cursor === null ? "All Files" : (folders.find((f) => f.id === cursor)?.name ?? "");
  const parentOfCursor =
    cursor === null ? null : (folders.find((f) => f.id === cursor)?.parentId ?? null);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move &ldquo;{target.name}&rdquo;</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 text-sm">
          {cursor !== null && (
            <button
              type="button"
              onClick={() => setCursor(parentOfCursor)}
              className="rounded p-1 text-muted-foreground hover:bg-surface hover:text-foreground"
              aria-label="Up one level"
            >
              <ChevronRight className="h-4 w-4 rotate-180" />
            </button>
          )}
          <span className="font-medium">{currentName}</span>
        </div>

        <div className="max-h-64 min-h-32 overflow-y-auto rounded-lg border border-border/60">
          {loading ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              Loading…
            </div>
          ) : children.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              No subfolders here.
            </div>
          ) : (
            children.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setCursor(f.id)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-surface/60"
              >
                <Folder className="h-5 w-5 fill-warning/20 text-warning" />
                <span className="flex-1 truncate">{f.name}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onMove(cursor)}>
            Move here{cursor === null ? " (All Files)" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
