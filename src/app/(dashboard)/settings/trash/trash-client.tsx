"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Building2,
  ClipboardList,
  FolderKanban,
  Handshake,
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
  permanentDeleteRecord,
  restoreRecord,
} from "@/actions/delete";
import type { EntityType } from "@/lib/soft-delete";

export type TrashItem = {
  id: string;
  type: EntityType;
  name: string;
  deletedAt: string;
};

const META: Record<string, { icon: LucideIcon; label: string }> = {
  company: { icon: Building2, label: "Company" },
  contact: { icon: Users, label: "Contact" },
  deal: { icon: Handshake, label: "Deal" },
  project: { icon: FolderKanban, label: "Project" },
  task: { icon: ClipboardList, label: "Task" },
};

export function TrashClient({ items }: { items: TrashItem[] }) {
  const router = useRouter();
  const [confirmEmpty, setConfirmEmpty] = useState(false);

  const restore = useAction(
    (i: { type: EntityType; id: string }) => restoreRecord(i.type, i.id),
    { onSuccess: () => router.refresh() },
  );
  const purge = useAction(
    (i: { type: EntityType; id: string }) => permanentDeleteRecord(i.type, i.id),
    { onSuccess: () => router.refresh() },
  );
  const empty = useAction<void, void>(() => emptyTrash(), {
    onSuccess: () => {
      setConfirmEmpty(false);
      router.refresh();
    },
  });

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
                onRestore={() => restore.execute({ type: item.type, id: item.id })}
                onDelete={() => purge.execute({ type: item.type, id: item.id })}
              />
            ))
          )}
        </PageContainer>
      </main>

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
  onRestore,
  onDelete,
}: {
  item: TrashItem;
  onRestore: () => void;
  onDelete: () => void;
}) {
  const meta = META[item.type] ?? { icon: Trash2, label: item.type };
  const Icon = meta.icon;
  return (
    <SurfaceCard className="flex items-center gap-3">
      <div className="grid h-9 w-9 place-items-center rounded-md bg-muted/40 text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{item.name}</div>
        <div className="text-hint text-muted-foreground">
          {meta.label} · deleted {timeAgo(item.deletedAt)}
        </div>
      </div>
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
