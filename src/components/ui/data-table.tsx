"use client";

import { useState, useMemo } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

export type Column<T> = {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (row: T) => React.ReactNode;
  href?: (row: T) => string;
  align?: "left" | "right" | "center";
  getValue?: (row: T) => string | number | null;
};

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  searchable?: boolean;
  searchPlaceholder?: string;
  getRowId: (row: T) => string;
  onRowAction?: (row: T) => React.ReactNode;
}

type SortDir = "asc" | "desc" | null;

export function DataTable<T>({
  data,
  columns,
  searchable = true,
  searchPlaceholder = "Search...",
  getRowId,
  onRowAction,
}: DataTableProps<T>) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDir === "asc") setSortDir("desc");
      else if (sortDir === "desc") { setSortKey(null); setSortDir(null); }
      else setSortDir("asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter((row) =>
      columns.some((col) => {
        const val = col.getValue ? col.getValue(row) : (row as Record<string, unknown>)[col.key];
        return val != null && String(val).toLowerCase().includes(q);
      })
    );
  }, [data, search, columns]);

  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return filtered;
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return filtered;

    return [...filtered].sort((a, b) => {
      const aVal = col.getValue ? col.getValue(a) : (a as Record<string, unknown>)[col.key];
      const bVal = col.getValue ? col.getValue(b) : (b as Record<string, unknown>)[col.key];

      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      }

      const strA = String(aVal).toLowerCase();
      const strB = String(bVal).toLowerCase();
      return sortDir === "asc" ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });
  }, [filtered, sortKey, sortDir, columns]);

  return (
    <div>
      {searchable && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full h-9 pl-9 pr-8 rounded-full border border-border bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-ring transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {sorted.length === 0 ? (
        <p className="text-[12px] text-muted-foreground py-4 text-center">
          {search ? "No results found." : "No data yet."}
        </p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      "px-4 py-2.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider select-none",
                      col.sortable && "cursor-pointer hover:text-foreground transition-colors",
                      col.align === "right" && "text-right",
                      col.align === "center" && "text-center"
                    )}
                    onClick={() => col.sortable && handleSort(col.key)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {col.sortable && (
                        <span className="inline-flex">
                          {sortKey === col.key && sortDir === "asc" && <ArrowUp className="w-3 h-3" />}
                          {sortKey === col.key && sortDir === "desc" && <ArrowDown className="w-3 h-3" />}
                          {sortKey !== col.key && <ArrowUpDown className="w-3 h-3 opacity-30" />}
                        </span>
                      )}
                    </span>
                  </th>
                ))}
                {onRowAction && <th className="px-4 py-2.5 w-10"></th>}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr key={getRowId(row)} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors group">
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        "px-4 py-2.5 text-[13px]",
                        col.align === "right" && "text-right",
                        col.align === "center" && "text-center"
                      )}
                    >
                      {col.render ? col.render(row) : (
                        col.href ? (
                          <Link href={col.href(row)} className="text-foreground font-medium hover:text-primary transition-colors no-underline">
                            {String((row as Record<string, unknown>)[col.key] ?? "—")}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">
                            {String((row as Record<string, unknown>)[col.key] ?? "—")}
                          </span>
                        )
                      )}
                    </td>
                  ))}
                  {onRowAction && (
                    <td className="px-4 py-2.5">
                      {onRowAction(row)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {searchable && sorted.length > 0 && (
        <p className="text-[11px] text-muted-foreground mt-2">
          {sorted.length} {sorted.length === 1 ? "result" : "results"}
          {search && ` for "${search}"`}
        </p>
      )}
    </div>
  );
}
