"use client";

// Labeled field card used across the CRM create/preview pages — a SurfaceCard
// with an uppercase label, optional icon/required mark/action, and an inline
// error line. Ported from the Lovable design.

import { ImagePlus, X } from "lucide-react";
import { SurfaceCard } from "@/components/surface-card";
import { cn } from "@/lib/utils";

export function FieldCard({
  label,
  icon,
  required,
  error,
  action,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  required?: boolean;
  error?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <SurfaceCard className="p-4" padding="none">
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-tiny font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {icon}
          {label}
          {required && <span className="text-destructive">*</span>}
        </div>
        {action}
      </div>
      {children}
      {error && <p className="mt-1 text-tiny text-destructive">{error}</p>}
    </SurfaceCard>
  );
}

export function LogoPicker({
  value,
  onPick,
  onClear,
  readOnly,
}: {
  value: string | undefined;
  onPick: () => void;
  onClear: () => void;
  readOnly?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={readOnly ? undefined : onPick}
        disabled={readOnly}
        className={cn(
          "relative grid h-14 w-14 place-items-center overflow-hidden rounded-full border border-dashed border-border/60 bg-surface text-muted-foreground transition-colors",
          !readOnly && "hover:border-primary/60 hover:text-foreground",
          value && "border-solid",
          readOnly && "cursor-default",
        )}
        aria-label={value ? "Company logo" : "Upload logo"}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="Company logo" className="h-full w-full object-cover" />
        ) : (
          <ImagePlus className="h-4 w-4" />
        )}
      </button>
      {value && !readOnly && (
        <button
          type="button"
          onClick={onClear}
          className="inline-flex items-center gap-1 text-tiny text-muted-foreground hover:text-destructive"
        >
          <X className="h-3 w-3" /> Remove
        </button>
      )}
    </div>
  );
}
