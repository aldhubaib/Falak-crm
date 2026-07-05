"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Building2,
  Check,
  Circle,
  ClipboardList,
  File,
  Folder,
  FolderKanban,
  Handshake,
  Loader2,
  RotateCcw,
  Trash2,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageContainer } from "@/components/page-container";
import { SurfaceCard } from "@/components/surface-card";
import { EmptyState } from "@/components/empty-state";
import { IconButton } from "@/components/icon-button";
import { useAction } from "@/hooks/use-action";
import {
  emptyTrash,
  getTrashPreview,
  permanentDeleteRecord,
  restoreRecord,
  type TrashPreview,
} from "@/actions/delete";
import type { EntityType } from "@/lib/soft-delete";

export type TrashItem = {
  id: string;
  type: EntityType;
  name: string;
  deletedAt: string;
  deletedByName: string | null;
};

const META: Record<string, { icon: LucideIcon; label: string }> = {
  company: { icon: Building2, label: "Company" },
  contact: { icon: Users, label: "Contact" },
  deal: { icon: Handshake, label: "Deal" },
  project: { icon: FolderKanban, label: "Project" },
  task: { icon: ClipboardList, label: "Task" },
  asset: { icon: File, label: "File" },
  folder: { icon: Folder, label: "Folder" },
};

export function TrashClient({ items }: { items: TrashItem[] }) {
  const router = useRouter();
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [previewItem, setPreviewItem] = useState<TrashItem | null>(null);
  const [preview, setPreview] = useState<TrashPreview | null>(null);
  const [loadingPreview, startPreview] = useTransition();

  const restore = useAction(
    (i: { type: EntityType; id: string }) => restoreRecord(i.type, i.id),
    { onSuccess: () => { setPreviewItem(null); router.refresh(); } },
  );
  const purge = useAction(
    (i: { type: EntityType; id: string }) => permanentDeleteRecord(i.type, i.id),
    { onSuccess: () => { setPreviewItem(null); router.refresh(); } },
  );
  const empty = useAction<void, void>(() => emptyTrash(), {
    onSuccess: () => {
      setConfirmEmpty(false);
      router.refresh();
    },
  });

  const openPreview = (item: TrashItem) => {
    setPreviewItem(item);
    setPreview(null);
    startPreview(async () => {
      const data = await getTrashPreview(item.type, item.id);
      setPreview(data);
    });
  };

  return (
    <>
      <AppHeader
        title="Trash"
        backHref="/settings"
        actions={
          items.length ? (
            <Button size="sm" variant="ghost" onClick={() => setConfirmEmpty(true)}>
              <Trash2 className="h-4 w-4" /> Empty
            </Button>
          ) : null
        }
      />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <PageContainer className="mx-auto w-full max-w-3xl space-y-field-gap">
          {items.length === 0 ? (
            <EmptyState
              icon={Trash2}
              title="Trash is empty"
              message="Deleted items will appear here"
              className="p-14"
            />
          ) : (
            items.map((item) => (
              <Row
                key={`${item.type}-${item.id}`}
                item={item}
                onOpen={() => openPreview(item)}
                onRestore={() => restore.execute({ type: item.type, id: item.id })}
                onDelete={() => purge.execute({ type: item.type, id: item.id })}
              />
            ))
          )}
        </PageContainer>
      </main>

      <Dialog
        open={previewItem !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewItem(null);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          {previewItem && (
            <PreviewBody
              item={previewItem}
              preview={preview}
              loading={loadingPreview}
              busy={restore.loading || purge.loading}
              onRestore={() => restore.execute({ type: previewItem.type, id: previewItem.id })}
              onDelete={() => purge.execute({ type: previewItem.type, id: previewItem.id })}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={confirmEmpty} onOpenChange={setConfirmEmpty}>
        <DialogContent>
          <DialogHeader>
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-destructive/15">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <DialogTitle>Empty trash?</DialogTitle>
            <DialogDescription>
              {items.length} item{items.length === 1 ? "" : "s"} will be permanently
              deleted. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmEmpty(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => empty.execute(undefined)}
              disabled={empty.loading}
            >
              Empty trash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Row({
  item,
  onOpen,
  onRestore,
  onDelete,
}: {
  item: TrashItem;
  onOpen: () => void;
  onRestore: () => void;
  onDelete: () => void;
}) {
  const meta = META[item.type] ?? { icon: Trash2, label: item.type };
  const Icon = meta.icon;
  return (
    <SurfaceCard className="flex items-center gap-3">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-muted/40 text-muted-foreground">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{item.name}</div>
          <div className="text-hint text-muted-foreground">
            {meta.label} · deleted {timeAgo(item.deletedAt)}
            {item.deletedByName ? ` by ${item.deletedByName}` : ""}
          </div>
        </div>
      </button>
      <IconButton aria-label="Restore" onClick={onRestore}>
        <RotateCcw className="h-4 w-4" />
      </IconButton>
      <IconButton
        className="text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
        aria-label="Delete forever"
        onClick={onDelete}
      >
        <Trash2 className="h-4 w-4" />
      </IconButton>
    </SurfaceCard>
  );
}

function PreviewBody({
  item,
  preview,
  loading,
  busy,
  onRestore,
  onDelete,
}: {
  item: TrashItem;
  preview: TrashPreview | null;
  loading: boolean;
  busy: boolean;
  onRestore: () => void;
  onDelete: () => void;
}) {
  const meta = META[item.type] ?? { icon: Trash2, label: item.type };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="pr-6">{preview?.title ?? item.name}</DialogTitle>
        <DialogDescription>
          {meta.label} · deleted {timeAgo(item.deletedAt)}
          {item.deletedByName ? ` by ${item.deletedByName}` : ""}
        </DialogDescription>
      </DialogHeader>

      {loading || !preview ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {preview.media.length > 0 && (
            <div className={preview.media.length === 1 ? "" : "grid grid-cols-2 gap-2"}>
              {preview.media.map((m, idx) =>
                m.kind === "image" ? (
                  <img
                    key={idx}
                    src={m.url}
                    alt={m.name}
                    className="max-h-64 w-full rounded-md border border-border object-contain bg-muted/20"
                  />
                ) : m.kind === "video" ? (
                  <video
                    key={idx}
                    src={m.url}
                    controls
                    className="max-h-64 w-full rounded-md border border-border bg-black"
                  />
                ) : (
                  <audio key={idx} src={m.url} controls className="w-full" />
                ),
              )}
            </div>
          )}

          {preview.fields.length > 0 && (
            <dl className="space-y-1.5">
              {preview.fields.map((f) => (
                <div key={f.label} className="flex gap-3 text-sm">
                  <dt className="w-28 shrink-0 text-muted-foreground">{f.label}</dt>
                  <dd className="min-w-0 flex-1 break-words">{f.value}</dd>
                </div>
              ))}
            </dl>
          )}

          {preview.list.length > 0 && (
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-border p-2">
              {preview.list.map((entry, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm">
                  <ListIcon kind={entry.kind} />
                  <span className="min-w-0 flex-1 truncate">{entry.label}</span>
                  {entry.hint && (
                    <span className="shrink-0 text-hint text-muted-foreground">{entry.hint}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <DialogFooter>
        <Button variant="ghost" onClick={onRestore} disabled={busy}>
          <RotateCcw className="h-4 w-4" /> Restore
        </Button>
        <Button variant="destructive" onClick={onDelete} disabled={busy}>
          <Trash2 className="h-4 w-4" /> Delete forever
        </Button>
      </DialogFooter>
    </>
  );
}

function ListIcon({ kind }: { kind: "file" | "folder" | "done" | "todo" }) {
  if (kind === "folder") return <Folder className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />;
  if (kind === "file") return <File className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />;
  if (kind === "done") return <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" />;
  return <Circle className="h-3 w-3 shrink-0 text-muted-foreground" />;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
