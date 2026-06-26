"use client";

import { useState, useMemo } from "react";
import { restoreRecord, permanentDeleteRecord, emptyTrash } from "@/actions/delete";
import { type EntityType } from "@/lib/soft-delete";
import { ArrowLeft, RotateCcw, Building2, User, Handshake, FolderKanban, Trash2, ListChecks, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useErrorStore } from "@/lib/error-store";
import { formatDistanceToNow } from "date-fns";

type TrashItem = {
  id: string;
  type: EntityType;
  name: string;
  deletedAt: Date;
};

const typeConfig: Record<EntityType, { icon: typeof Building2; label: string; plural: string }> = {
  company: { icon: Building2, label: "Company", plural: "Companies" },
  contact: { icon: User, label: "Contact", plural: "Contacts" },
  deal: { icon: Handshake, label: "Deal", plural: "Deals" },
  project: { icon: FolderKanban, label: "Project", plural: "Projects" },
  task: { icon: ListChecks, label: "Task", plural: "Tasks" },
};

const tabs: ("all" | EntityType)[] = ["all", "company", "contact", "deal", "project", "task"];

export function TrashClient({ items }: { items: TrashItem[] }) {
  const router = useRouter();
  const [restoring, setRestoring] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [emptying, setEmptying] = useState(false);
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | EntityType>("all");

  const { push: pushError } = useErrorStore();

  const filtered = useMemo(() => {
    if (activeTab === "all") return items;
    return items.filter((i) => i.type === activeTab);
  }, [items, activeTab]);

  const countByType = useMemo(() => {
    const counts: Record<string, number> = { all: items.length };
    for (const item of items) {
      counts[item.type] = (counts[item.type] || 0) + 1;
    }
    return counts;
  }, [items]);

  const grouped = useMemo(() => {
    const groups: { label: string; items: TrashItem[] }[] = [];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 86400000);
    const weekAgo = new Date(today.getTime() - 7 * 86400000);
    const monthAgo = new Date(today.getTime() - 30 * 86400000);

    const buckets = {
      Today: [] as TrashItem[],
      Yesterday: [] as TrashItem[],
      "This Week": [] as TrashItem[],
      "This Month": [] as TrashItem[],
      Older: [] as TrashItem[],
    };

    for (const item of filtered) {
      const d = new Date(item.deletedAt);
      if (d >= today) buckets.Today.push(item);
      else if (d >= yesterday) buckets.Yesterday.push(item);
      else if (d >= weekAgo) buckets["This Week"].push(item);
      else if (d >= monthAgo) buckets["This Month"].push(item);
      else buckets.Older.push(item);
    }

    for (const [label, items] of Object.entries(buckets)) {
      if (items.length > 0) groups.push({ label, items });
    }

    return groups;
  }, [filtered]);

  const handleRestore = async (type: EntityType, id: string) => {
    setRestoring(id);
    const result = await restoreRecord(type, id);
    setRestoring(null);
    if (!result.ok) {
      pushError(result.error);
      return;
    }
    router.refresh();
  };

  const handlePermanentDelete = async (type: EntityType, id: string) => {
    setDeleting(id);
    const result = await permanentDeleteRecord(type, id);
    setDeleting(null);
    if (!result.ok) {
      pushError(result.error);
      return;
    }
    router.refresh();
  };

  const handleEmptyTrash = async () => {
    setEmptying(true);
    const result = await emptyTrash();
    setEmptying(false);
    setConfirmEmpty(false);
    if (!result.ok) {
      pushError(result.error);
      return;
    }
    router.refresh();
  };

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 h-12 mb-6">
        <Link
          href="/settings"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-lg font-semibold text-foreground flex-1">Trash</h1>
        {items.length > 0 && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setConfirmEmpty(true)}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Empty Trash
          </Button>
        )}
      </div>

      {/* Confirm empty dialog */}
      {confirmEmpty && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 mb-6 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-[13px] font-medium text-foreground">
              Permanently delete all {items.length} items?
            </p>
            <p className="text-[12px] text-muted-foreground mt-1">
              This action cannot be undone. All files and data associated with these items will be permanently removed.
            </p>
            <div className="flex items-center gap-2 mt-3">
              <Button
                size="sm"
                variant="destructive"
                onClick={handleEmptyTrash}
                disabled={emptying}
              >
                {emptying ? "Deleting..." : "Yes, delete all"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setConfirmEmpty(false)}
                disabled={emptying}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <Trash2 className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-[14px] font-medium text-muted-foreground">Trash is empty</p>
          <p className="text-[12px] text-muted-foreground/60 mt-1">Deleted items will appear here</p>
        </div>
      ) : (
        <>
          {/* Module tabs */}
          <div className="flex items-center gap-1 mb-5 overflow-x-auto pb-1">
            {tabs.map((tab) => {
              const count = countByType[tab] || 0;
              if (tab !== "all" && count === 0) return null;
              const label = tab === "all" ? "All" : typeConfig[tab].plural;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors whitespace-nowrap ${
                    activeTab === tab
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                  }`}
                >
                  {label}
                  <span className={`ml-1.5 text-[11px] ${activeTab === tab ? "text-primary/60" : "text-muted-foreground/60"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Grouped by date */}
          <div className="space-y-6">
            {grouped.map((group) => (
              <div key={group.label}>
                <h3 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2 px-1">
                  {group.label}
                </h3>
                <div className="rounded-lg border border-border overflow-hidden">
                  {group.items.map((item, i) => {
                    const cfg = typeConfig[item.type];
                    const Icon = cfg.icon;
                    return (
                      <div
                        key={`${item.type}-${item.id}`}
                        className={`flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors ${
                          i < group.items.length - 1 ? "border-b border-border" : ""
                        }`}
                      >
                        <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] text-foreground truncate">{item.name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {cfg.label} &middot; {formatDistanceToNow(new Date(item.deletedAt), { addSuffix: true })}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button
                            size="sm"
                            onClick={() => handleRestore(item.type, item.id)}
                            disabled={restoring === item.id}
                            className="h-7 text-[11px] px-2.5"
                          >
                            <RotateCcw className="w-3 h-3" />
                            {restoring === item.id ? "..." : "Restore"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handlePermanentDelete(item.type, item.id)}
                            disabled={deleting === item.id}
                            className="h-7 text-[11px] px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
