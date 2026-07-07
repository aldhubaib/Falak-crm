"use client";

// Split view used by the CRM tables: when a row is selected, the table is
// replaced by a narrow list panel (left) + a preview panel (right). On
// mobile/tablet the preview slides in as a full-screen overlay instead.
// Ported from the Lovable design.

import type { ReactNode } from "react";
import { X, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { DataTableSearch } from "@/components/data-table";

/* ------------------------------ List panel ------------------------------ */

export function EntityListPanel({
  query,
  onQuery,
  placeholder,
  children,
}: {
  query: string;
  onQuery: (v: string) => void;
  placeholder?: string;
  children: ReactNode;
}) {
  return (
    <aside className="flex h-full w-full shrink-0 flex-col border-r border-border/60 bg-surface lg:w-[340px]">
      <div className="border-b border-border/60 px-3 pt-6 pb-3">
        <DataTableSearch
          value={query}
          onChange={onQuery}
          placeholder={placeholder ?? "Search"}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </aside>
  );
}

export function EntityListRow({
  title,
  subtitle,
  right,
  leading,
  active,
  onClick,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  leading?: ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active}
      className={cn(
        "flex w-full items-center gap-3 border-b border-border/60 px-3 py-3 text-left transition-colors",
        active ? "bg-muted/40" : "hover:bg-muted/20",
      )}
    >
      {leading}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-foreground">
          {title}
        </div>
        {subtitle && (
          <div className="mt-0.5 truncate text-xs text-muted-foreground">
            {subtitle}
          </div>
        )}
      </div>
      {right && <div className="shrink-0 text-xs text-muted-foreground">{right}</div>}
    </button>
  );
}

/* ---------------------------- Preview panel ----------------------------- */

export function EntityPreviewShell({
  eyebrow,
  title,
  onOpen,
  onClose,
  toolbar,
  children,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  onOpen?: () => void;
  onClose: () => void;
  toolbar?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      {/* Backdrop for tablet/mobile overlay */}
      <button
        type="button"
        aria-label="Close preview"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/40 animate-in fade-in lg:hidden"
      />
      <section
        className={cn(
          // Mobile/tablet: overlay sliding from right
          "fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-background shadow-xl animate-in slide-in-from-right duration-200",
          // Desktop: inline panel
          "lg:static lg:z-auto lg:flex lg:w-auto lg:max-w-none lg:min-w-0 lg:flex-1 lg:shadow-none lg:animate-none",
        )}
      >
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            {eyebrow && (
              <div className="text-xs text-muted-foreground">{eyebrow}</div>
            )}
            <div className="mt-0.5 truncate text-lg font-semibold text-foreground">
              {title}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {onOpen && (
              <button
                type="button"
                aria-label="Open full page"
                onClick={onOpen}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border/60 bg-surface text-foreground transition-colors hover:bg-muted/40"
              >
                <ExternalLink className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              aria-label="Close preview"
              onClick={onClose}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border/60 bg-surface text-foreground transition-colors hover:bg-muted/40"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        {toolbar && (
          <div className="border-b border-border/60 bg-background px-4 py-2">
            {toolbar}
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto bg-muted/10 p-4 sm:p-6">
          {children}
        </div>
      </section>
    </>
  );
}
