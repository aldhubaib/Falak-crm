"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

export type RelatedColumn<T> = {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  render?: (row: T) => React.ReactNode;
};

interface RelatedTableProps<T> {
  icon: React.ReactNode;
  title: string;
  data: T[];
  columns: RelatedColumn<T>[];
  getRowId: (row: T) => string;
  rowHref?: (row: T) => string;
  action?: React.ReactNode;
  emptyMessage?: string;
}

export function RelatedTable<T>({
  icon,
  title,
  data,
  columns,
  getRowId,
  rowHref,
  action,
  emptyMessage = "No data yet.",
}: RelatedTableProps<T>) {
  return (
    <div className="rounded-lg bg-black border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <label className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          {icon}
          {title} ({data.length})
        </label>
        {action}
      </div>

      {data.length === 0 ? (
        <p className="text-[12px] text-muted-foreground">{emptyMessage}</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      "px-4 py-2.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider",
                      col.align === "right" && "text-right",
                      col.align === "center" && "text-center"
                    )}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row) => {
                const href = rowHref?.(row);
                const Row = href ? Link : "tr";
                const rowClass = "border-b border-border last:border-0 hover:bg-muted/20 transition-colors cursor-pointer";

                return (
                  // @ts-expect-error - dynamic element
                  <Row
                    key={getRowId(row)}
                    {...(href ? { href, className: `table-row ${rowClass} no-underline` } : { className: rowClass })}
                  >
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
                          <span className="text-muted-foreground">
                            {String((row as Record<string, unknown>)[col.key] ?? "—")}
                          </span>
                        )}
                      </td>
                    ))}
                  </Row>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
