"use client";

// "Related Data" building blocks shared by the company / contact / deal detail
// pages, matching the Lovable design: a FieldCard with an icon + uppercase
// label, a small table of linked records, a "+" button that opens a search
// picker to link/unlink records, and a per-row "…" menu with a confirmed
// Remove (unlink) action. One component — change it here, it changes on every
// page that shows related records.

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Loader2, MoreHorizontal, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FieldCard } from "@/components/crm/field-card";
import { useActionHandler } from "@/hooks/use-action";
import type { ActionResult } from "@/lib/action";
import { cn } from "@/lib/utils";

/* ------------------------------ Section card ----------------------------- */

export type RelatedColumn<Row> = {
  key: string;
  header: string;
  align?: "left" | "right";
  render: (row: Row) => ReactNode;
};

export function RelatedSection<Row>({
  label,
  icon,
  columns,
  rows,
  getRowId,
  getRowHref,
  emptyMessage,
  onAdd,
  remove,
}: {
  label: string;
  icon?: ReactNode;
  columns: RelatedColumn<Row>[];
  rows: Row[];
  getRowId: (row: Row) => string;
  /** When set, the first column's content links to the record's page. */
  getRowHref?: (row: Row) => string;
  emptyMessage: string;
  /** "+" button in the card header (open a picker, navigate to a create page, ...). */
  onAdd?: () => void;
  /** Per-row "…" → Remove with a confirm dialog. Unlinks only — never deletes. */
  remove?: {
    title: string;
    description: (row: Row) => string;
    action: (row: Row) => Promise<ActionResult>;
  };
}) {
  const router = useRouter();
  const [pendingRemove, setPendingRemove] = useState<Row | null>(null);
  const { run, loading } = useActionHandler();

  const confirmRemove = async () => {
    if (!pendingRemove || !remove) return;
    await run(remove.title, async () => {
      const res = await remove.action(pendingRemove);
      if (!res.ok) throw new Error(res.error.message);
      router.refresh();
    });
    setPendingRemove(null);
  };

  return (
    <>
      <FieldCard
        label={label}
        icon={icon}
        action={
          onAdd && (
            <button
              type="button"
              aria-label={`Add ${label.toLowerCase()}`}
              onClick={onAdd}
              className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
            >
              <Plus className="h-4 w-4" />
            </button>
          )
        }
      >
        {rows.length === 0 ? (
          <div className="rounded-md border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
            {emptyMessage}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-tiny uppercase tracking-[0.14em] text-muted-foreground">
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className={cn(
                        "py-2 pr-3 font-medium",
                        col.align === "right" ? "text-right" : "text-left",
                      )}
                    >
                      {col.header}
                    </th>
                  ))}
                  {remove && <th className="w-8 py-2" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {rows.map((row) => (
                  <tr key={getRowId(row)}>
                    {columns.map((col, i) => (
                      <td
                        key={col.key}
                        className={cn(
                          "py-2 pr-3",
                          col.align === "right" && "text-right",
                        )}
                      >
                        {i === 0 && getRowHref ? (
                          <Link
                            href={getRowHref(row)}
                            className="font-medium hover:underline"
                          >
                            {col.render(row)}
                          </Link>
                        ) : (
                          col.render(row)
                        )}
                      </td>
                    ))}
                    {remove && (
                      <td className="py-2 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              aria-label="Row actions"
                              className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onSelect={() => setPendingRemove(row)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Remove
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </FieldCard>

      {remove && (
        <Dialog
          open={pendingRemove !== null}
          onOpenChange={(o) => !o && !loading && setPendingRemove(null)}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{remove.title}</DialogTitle>
              <DialogDescription>
                {pendingRemove ? remove.description(pendingRemove) : ""}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                disabled={loading}
                onClick={() => setPendingRemove(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={loading}
                onClick={confirmRemove}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Remove
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

/* ------------------------------ Link picker ------------------------------ */

export type LinkPickerOption = {
  id: string;
  title: string;
  subtitle?: string;
};

// Searchable list of records; clicking one links it (or unlinks when already
// linked). "New" jumps to the module's create page, prefilled when possible.
export function LinkPickerDialog({
  open,
  onOpenChange,
  title,
  placeholder,
  icon,
  options,
  linkedIds,
  onLink,
  onUnlink,
  newHref,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  placeholder: string;
  icon: ReactNode;
  options: LinkPickerOption[];
  linkedIds: string[];
  onLink: (id: string) => Promise<ActionResult>;
  onUnlink?: (id: string) => Promise<ActionResult>;
  newHref?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const { run } = useActionHandler();
  const linked = useMemo(() => new Set(linkedIds), [linkedIds]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) =>
      [o.title, o.subtitle]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [options, query]);

  const toggle = async (opt: LinkPickerOption) => {
    if (busyId) return;
    const isLinked = linked.has(opt.id);
    if (isLinked && !onUnlink) return;
    setBusyId(opt.id);
    await run(isLinked ? "Unlink" : "Link", async () => {
      const res = isLinked ? await onUnlink!(opt.id) : await onLink(opt.id);
      if (!res.ok) throw new Error(res.error.message);
      router.refresh();
    });
    setBusyId(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              className="h-9 pl-8"
              autoFocus
            />
          </div>
          {newHref && (
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() => {
                onOpenChange(false);
                router.push(newHref);
              }}
            >
              <Plus className="h-4 w-4" />
              New
            </Button>
          )}
        </div>
        <div className="max-h-80 overflow-auto rounded-md border border-border/60">
          {rows.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              {options.length === 0
                ? "Nothing in the system yet."
                : `No matches for “${query}”.`}
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {rows.map((opt) => {
                const isLinked = linked.has(opt.id);
                return (
                  <li key={opt.id}>
                    <button
                      type="button"
                      onClick={() => toggle(opt)}
                      disabled={busyId !== null}
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-surface disabled:opacity-60",
                        isLinked && "bg-surface",
                      )}
                    >
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border/60 bg-surface text-muted-foreground">
                        {icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">
                          {opt.title}
                        </div>
                        <div className="truncate text-tiny text-muted-foreground">
                          {opt.subtitle || "—"}
                        </div>
                      </div>
                      {busyId === opt.id ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : (
                        isLinked && <Check className="h-4 w-4 text-primary" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------ Cell helpers ----------------------------- */

export function RelatedEmail({ value }: { value?: string | null }) {
  return value ? (
    <a href={`mailto:${value}`} className="text-primary hover:underline">
      {value}
    </a>
  ) : (
    <span className="text-muted-foreground">—</span>
  );
}

export function RelatedPhone({ value }: { value?: string | null }) {
  return value ? (
    <a
      href={`tel:${value.replace(/[^+\d]/g, "")}`}
      className="text-primary hover:underline"
    >
      {value}
    </a>
  ) : (
    <span className="text-muted-foreground">—</span>
  );
}

export function RelatedMuted({ value }: { value?: string | number | null }) {
  return value || value === 0 ? (
    <span className="text-muted-foreground">{value}</span>
  ) : (
    <span className="text-muted-foreground">—</span>
  );
}
