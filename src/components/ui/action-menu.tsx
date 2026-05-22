"use client";

import { useState, useRef, useEffect } from "react";
import { MoreVertical, Trash2, AlertTriangle, RotateCcw } from "lucide-react";
import { deleteRecord, checkCanDelete, type RelationBlock } from "@/actions/delete";
import { type EntityType } from "@/lib/soft-delete";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface ActionMenuProps {
  entityType: EntityType;
  entityId: string;
  entityName: string;
  redirectAfterDelete?: string;
}

export function ActionMenu({ entityType, entityId, entityName, redirectAfterDelete }: ActionMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [blocks, setBlocks] = useState<RelationBlock[]>([]);
  const [loading, setLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleDeleteClick = async () => {
    setOpen(false);
    setLoading(true);
    const result = await checkCanDelete(entityType, entityId);
    setLoading(false);
    setBlocks(result);
    setConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    setLoading(true);
    const result = await deleteRecord(entityType, entityId);
    setLoading(false);
    if (result.success) {
      setConfirmOpen(false);
      if (redirectAfterDelete) {
        router.push(redirectAfterDelete);
      } else {
        router.refresh();
      }
    }
  };

  return (
    <>
      <div ref={menuRef} className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
        >
          <MoreVertical className="w-4 h-4" />
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-1 w-44 rounded-lg border border-border bg-popover shadow-lg overflow-hidden z-50">
            <button
              onClick={handleDeleteClick}
              disabled={loading}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-[12px] text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Confirm / Block Dialog */}
      {confirmOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]" onClick={() => setConfirmOpen(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md z-[101]">
            <div className="mx-4 bg-background border border-border rounded-xl shadow-2xl p-6">
              {blocks.length > 0 ? (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-5 h-5 text-amber-500" />
                    </div>
                    <div>
                      <h3 className="text-[14px] font-semibold text-foreground">Cannot Delete</h3>
                      <p className="text-[12px] text-muted-foreground">
                        &quot;{entityName}&quot; has related records that must be removed first.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 mb-5">
                    {blocks.map((block) => (
                      <div key={block.label} className="rounded-lg border border-border p-3">
                        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                          {block.label} ({block.count})
                        </p>
                        <ul className="space-y-1">
                          {block.items.map((item) => (
                            <li key={item.id} className="text-[12px] text-foreground">
                              • {item.name}
                            </li>
                          ))}
                          {block.count > block.items.length && (
                            <li className="text-[11px] text-muted-foreground">
                              ...and {block.count - block.items.length} more
                            </li>
                          )}
                        </ul>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={() => setConfirmOpen(false)}
                      className="h-9 px-4 rounded-full border border-border text-[12px] font-medium text-foreground hover:bg-muted/30 transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                      <Trash2 className="w-5 h-5 text-destructive" />
                    </div>
                    <div>
                      <h3 className="text-[14px] font-semibold text-foreground">Delete {entityType}?</h3>
                      <p className="text-[12px] text-muted-foreground">
                        &quot;{entityName}&quot; will be moved to trash. You can restore it later from Settings.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => setConfirmOpen(false)}
                      className="h-9 px-4 rounded-full border border-border text-[12px] font-medium text-foreground hover:bg-muted/30 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirmDelete}
                      disabled={loading}
                      className="h-9 px-4 rounded-full border border-destructive bg-destructive text-[12px] font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
                    >
                      {loading ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
