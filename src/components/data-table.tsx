"use client";

// Shared CRM data table, ported from the Lovable design. Renders a full table
// on lg+ screens and a stacked card list below that. Includes the toolbar
// building blocks (search, icon buttons, columns menu) and pagination footer.

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  ArrowUp,
  ArrowDown,
  Columns3,
  Search,
  Settings2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/* ------------------------------ Types ---------------------------------- */

export type DataTableColumn<T> = {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: "left" | "right";
  className?: string;
  headerClassName?: string;
  sortable?: boolean;
  sortValue?: (row: T) => string | number | Date | null | undefined;
  /** How this column behaves on mobile (below lg). Defaults to "meta"
   *  for every column except the first visible one, which becomes "title". */
  mobile?: "title" | "meta" | "hide";
};

/* ---------------------------- Field cells ------------------------------ */
/* Shared field renderers so the same value type looks and behaves the
 * same across every DataTable (email → mailto, phone → tel, etc.). */

function stop(e: React.MouseEvent) {
  e.stopPropagation();
}

export function EmailCell({ value }: { value?: string | null }) {
  if (!value) return <MutedDash />;
  return (
    <a
      href={`mailto:${value}`}
      onClick={stop}
      className="text-sm text-primary hover:underline"
    >
      {value}
    </a>
  );
}

export function PhoneCell({ value }: { value?: string | null }) {
  if (!value) return <MutedDash />;
  const tel = value.replace(/[^+\d]/g, "");
  return (
    <a
      href={`tel:${tel}`}
      onClick={stop}
      className="text-sm text-primary hover:underline"
    >
      {value}
    </a>
  );
}

export function LinkCell({
  href,
  label,
}: {
  href?: string | null;
  label?: string | null;
}) {
  if (!href) return <MutedDash />;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={stop}
      className="truncate text-sm text-primary hover:underline"
    >
      {label ?? href.replace(/^https?:\/\//, "")}
    </a>
  );
}

export function MutedCell({ value }: { value?: string | number | null }) {
  if (value === undefined || value === null || value === "") return <MutedDash />;
  return <span className="text-sm text-muted-foreground">{value}</span>;
}

export function MutedDash() {
  return <span className="text-sm text-muted-foreground">—</span>;
}

/* ------------------------------ Shell ---------------------------------- */

export function DataTableShell({ children }: { children: ReactNode }) {
  return <section className="flex min-w-0 flex-1 flex-col">{children}</section>;
}

export function DataTableToolbar({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-3 pt-4 pb-3 sm:px-4 sm:pt-6">
      {children}
    </div>
  );
}

/* ------------------------------ Search --------------------------------- */

export function DataTableSearch({
  value,
  onChange,
  placeholder = "Search",
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative w-full min-w-0 flex-1 sm:w-72 sm:flex-none", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-xl border border-border/60 bg-surface pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
    </div>
  );
}

/* ------------------------------ Icon button ---------------------------- */

export function DataTableIconButton({
  children,
  onClick,
  ...rest
}: {
  children: ReactNode;
  onClick?: () => void;
  "aria-label": string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      {...rest}
      className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border/60 bg-surface text-foreground transition-colors hover:bg-muted/40"
    >
      {children}
    </button>
  );
}

/* ---------------------------- Columns menu ----------------------------- */

export type ColumnToggle = { key: string; label: string };

export function DataTableColumnsMenu({
  columns,
  visible,
  onChange,
}: {
  columns: ColumnToggle[];
  visible: Record<string, boolean>;
  onChange: (key: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Columns"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border/60 bg-surface text-foreground transition-colors hover:bg-muted/40"
        >
          <Columns3 className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 p-1">
        {columns.map((col) => {
          const checked = !!visible[col.key];
          return (
            <DropdownMenuItem
              key={col.key}
              onSelect={(e) => {
                e.preventDefault();
                onChange(col.key);
              }}
              className="flex items-center justify-between rounded-md px-3 py-2 text-sm"
            >
              <span>{col.label}</span>
              {checked && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ------------------------------ Table ---------------------------------- */

export function DataTable<T>({
  columns,
  data,
  getRowId,
  onRowClick,
  minWidth = 900,
  emptyMessage = "No results.",
}: {
  columns: DataTableColumn<T>[];
  data: T[];
  getRowId: (row: T) => string;
  onRowClick?: (row: T) => void;
  minWidth?: number;
  emptyMessage?: string;
}) {
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(
    null,
  );
  const [widths, setWidths] = useState<Record<string, number>>({});
  const theadRef = useRef<HTMLTableSectionElement>(null);
  const resizingRef = useRef<{ key: string; startX: number; startW: number } | null>(null);

  const onResizeDown = (e: React.MouseEvent, key: string) => {
    e.preventDefault();
    e.stopPropagation();
    // Measure current header width if not yet stored.
    const thead = theadRef.current;
    let startW = widths[key];
    if (startW == null && thead) {
      const th = thead.querySelector<HTMLElement>(`th[data-col-key="${key}"]`);
      if (th) startW = th.getBoundingClientRect().width;
    }
    if (startW == null) startW = 120;
    resizingRef.current = { key, startX: e.clientX, startW };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const r = resizingRef.current;
      if (!r) return;
      const next = Math.max(60, r.startW + (e.clientX - r.startX));
      setWidths((w) => (w[r.key] === next ? w : { ...w, [r.key]: next }));
    };
    const onUp = () => {
      if (!resizingRef.current) return;
      resizingRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const hasResized = Object.keys(widths).length > 0;

  const toggleSort = (key: string) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  };

  const sortedData = useMemo(() => {
    if (!sort) return data;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return data;
    const getVal = col.sortValue;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...data].sort((a, b) => {
      const av = getVal(a);
      const bv = getVal(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av instanceof Date && bv instanceof Date)
        return (av.getTime() - bv.getTime()) * dir;
      if (typeof av === "number" && typeof bv === "number")
        return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [data, sort, columns]);

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      {/* Mobile & tablet: card list */}
      <div className="lg:hidden">
        <MobileCardList
          columns={columns}
          rows={sortedData}
          getRowId={getRowId}
          onRowClick={onRowClick}
          emptyMessage={emptyMessage}
        />
      </div>

      {/* lg+: full table */}
      <table
        className="hidden w-full text-sm lg:table"
        style={{ minWidth, tableLayout: hasResized ? "fixed" : "auto" }}
      >
        <colgroup>
          {columns.map((c) => (
            <col
              key={c.key}
              style={widths[c.key] ? { width: widths[c.key] } : undefined}
            />
          ))}
        </colgroup>
        <thead ref={theadRef} className="sticky top-0 z-10 bg-surface">
          <tr className="border-b border-border/60 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {columns.map((c) => {
              const isSorted = sort?.key === c.key;
              const Icon = !isSorted
                ? ChevronsUpDown
                : sort.dir === "asc"
                  ? ArrowUp
                  : ArrowDown;
              return (
                <th
                  key={c.key}
                  data-col-key={c.key}
                  className={cn(
                    "relative px-4 py-3",
                    c.align === "right" && "text-right",
                    c.headerClassName,
                  )}
                >
                  {c.sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(c.key)}
                      className={cn(
                        "inline-flex max-w-full items-center gap-1.5 truncate rounded hover:text-foreground transition-colors",
                        c.align === "right" && "flex-row-reverse",
                        isSorted && "text-foreground",
                      )}
                    >
                      <span className="truncate">{c.header}</span>
                      <Icon
                        className={cn(
                          "h-3 w-3",
                          isSorted ? "opacity-100" : "opacity-40",
                        )}
                      />
                    </button>
                  ) : (
                    c.header
                  )}
                  <span
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Resize column"
                    onMouseDown={(e) => onResizeDown(e, c.key)}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setWidths((w) => {
                        if (!(c.key in w)) return w;
                        const next = { ...w };
                        delete next[c.key];
                        return next;
                      });
                    }}
                    className="absolute right-0 top-0 z-10 flex h-full w-2 -translate-x-1/2 cursor-col-resize touch-none select-none items-center justify-center opacity-0 transition-opacity hover:opacity-100"
                  >
                    <span className="h-4 w-px bg-border" />
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedData.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length || 1}
                className="h-40 text-center text-sm text-muted-foreground"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            sortedData.map((row) => (
              <tr
                key={getRowId(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  "border-b border-border/60",
                  onRowClick && "cursor-pointer hover:bg-muted/30",
                )}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      "truncate px-4 py-3 align-middle",
                      c.align === "right" && "text-right",
                      c.className,
                    )}
                  >
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------------------- Mobile cards ----------------------------- */

function MobileCardList<T>({
  columns,
  rows,
  getRowId,
  onRowClick,
  emptyMessage,
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyMessage: string;
}) {
  const visible = columns.filter((c) => c.mobile !== "hide");
  // Pick title column: first explicit "title", else first visible column.
  const titleCol = visible.find((c) => c.mobile === "title") ?? visible[0];
  const metaCols = visible.filter((c) => c !== titleCol);

  if (rows.length === 0) {
    return (
      <div className="grid h-40 place-items-center px-4 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border/60">
      {rows.map((row) => (
        <li key={getRowId(row)}>
          <button
            type="button"
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            disabled={!onRowClick}
            className={cn(
              "block w-full px-4 py-3 text-left",
              onRowClick && "transition-colors hover:bg-muted/30 active:bg-muted/40",
            )}
          >
            {titleCol && (
              <div className="min-w-0 text-sm font-medium text-foreground">
                {titleCol.cell(row)}
              </div>
            )}
            {metaCols.length > 0 && (
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                {metaCols.map((c) => (
                  <div key={c.key} className="contents">
                    <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {c.header}
                    </dt>
                    <dd
                      className={cn(
                        "min-w-0 text-sm text-foreground",
                        c.align === "right" && "text-right",
                      )}
                    >
                      {c.cell(row)}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}

/* ---------------------------- Pagination ------------------------------- */

const PAGE_SIZES = [10, 25, 50, 100, 200];

export function DataTablePagination({
  total,
  pageSize,
  onPageSize,
  onPrev,
  onNext,
}: {
  total: number;
  pageSize: number;
  onPageSize: (n: number) => void;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const upper = Math.min(pageSize, total);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 bg-surface px-3 py-2.5 text-sm sm:px-4">
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="text-muted-foreground">Total Count:</span>
        <span className="font-medium text-foreground">{total}</span>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-9 items-center gap-2 rounded-xl border border-border/60 bg-surface px-3 text-sm text-foreground transition-colors hover:bg-muted/40"
            >
              <Settings2 className="h-4 w-4 text-muted-foreground" />
              <span className="hidden sm:inline">{pageSize} per page</span>
              <span className="sm:hidden">{pageSize}/pg</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44 p-1">
            {PAGE_SIZES.map((size) => {
              const active = size === pageSize;
              return (
                <DropdownMenuItem
                  key={size}
                  onSelect={() => onPageSize(size)}
                  className={cn(
                    "flex items-center justify-between rounded-md px-3 py-2 text-sm",
                    active &&
                      "bg-primary text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                  )}
                >
                  <span>{size} per page</span>
                  {active && <Check className="h-4 w-4" />}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="flex h-9 items-center overflow-hidden rounded-xl border border-border/60 bg-surface">
          <button
            type="button"
            aria-label="Previous page"
            onClick={onPrev}
            className="grid h-full w-9 place-items-center text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="px-3 text-sm text-foreground">1 - {upper}</div>
          <button
            type="button"
            aria-label="Next page"
            onClick={onNext}
            className="grid h-full w-9 place-items-center text-primary transition-colors hover:bg-muted/40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
