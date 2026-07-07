"use client";

import { useEffect, useState } from "react";
import { Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ESTIMATE_OPTIONS } from "@/lib/estimate";
import { cn } from "@/lib/utils";

export function ConfirmStatusDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  withEstimate = false,
}: {
  open: boolean;
  onClose: () => void;
  /** `estimateMin` is set only when the dialog shows the estimate picker and the user picked a chip. */
  onConfirm: (estimateMin?: number | null) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  /** Show the ESTIMATED TIME chips + timer note (the Todo → In Progress move). */
  withEstimate?: boolean;
}) {
  const [estimate, setEstimate] = useState<number | null>(null);

  // A fresh dialog shouldn't remember the estimate picked for another task.
  useEffect(() => {
    if (open) setEstimate(null);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {withEstimate && (
          <div className="space-y-3">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Estimated time
              </p>
              <div className="flex flex-wrap gap-2">
                {ESTIMATE_OPTIONS.map((opt) => (
                  <button
                    key={opt.min}
                    type="button"
                    onClick={() =>
                      setEstimate((cur) => (cur === opt.min ? null : opt.min))
                    }
                    className={cn(
                      "rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
                      estimate === opt.min
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border/60 bg-background text-foreground hover:border-muted-foreground/40",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-500">
              <Timer className="h-4 w-4 shrink-0" />
              The task timer will start once you confirm.
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => onConfirm(withEstimate ? estimate : undefined)}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
