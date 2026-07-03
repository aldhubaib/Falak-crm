"use client";

import { cn } from "@/lib/utils";

export function PriorityPicker({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (n: number | null) => void;
}) {
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 4, 7, 8, 9, 10].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(value === n ? null : n)}
            className={cn(
              "h-9 w-9 rounded-md border text-sm font-medium transition-colors",
              value === n
                ? "border-primary bg-primary/15 text-primary"
                : "border-border/60 bg-surface text-muted-foreground hover:text-foreground",
            )}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="mt-2 text-xs text-muted-foreground">
        {value === null ? "No priority selected" : `Priority ${value}`}
      </div>
    </div>
  );
}
