"use client";

import { useRef, useState } from "react";
import { AlertTriangle, AtSign, Paperclip, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function DeclineDialog({
  open,
  fromLabel,
  toLabel,
  mentionName,
  onClose,
  onConfirm,
}: {
  open: boolean;
  fromLabel: string;
  toLabel: string;
  /** Person who submitted the task — @mentioned by default and not editable. */
  mentionName?: string | null;
  onClose: () => void;
  onConfirm: (reason: string, file: File | null) => void;
}) {
  const [reason, setReason] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const canSubmit = reason.trim().length > 0;

  const close = () => {
    setReason("");
    setFile(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="border-destructive/40 sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-destructive/15 text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle>Decline Task</DialogTitle>
              <DialogDescription>
                Return this task from {fromLabel} back to {toLabel}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-2">
          <label className="text-sm font-medium">
            Reason for declining <span className="text-destructive">*</span>
          </label>
          {mentionName && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Notifying</span>
              <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 font-medium text-primary">
                <AtSign className="h-3 w-3" />
                {mentionName}
              </span>
            </div>
          )}
          <Textarea
            placeholder="Explain what needs to be fixed or changed..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            className={cn(
              !canSubmit &&
                "border-destructive/50 focus-visible:ring-destructive/40",
            )}
          />
          <p className="text-xs text-muted-foreground">
            A comment is required when declining a task
          </p>
        </div>

        <div>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setFile(f);
            }}
          />
          {file ? (
            <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-surface/60 px-3 py-2 text-sm">
              <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
                <Paperclip className="h-4 w-4 shrink-0" />
                <span className="truncate">{file.name}</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => setFile(null)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
              }}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) setFile(f);
              }}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border/70 bg-surface/40 py-6 text-center transition-colors hover:border-border hover:bg-surface"
            >
              <Paperclip className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Attach files
              </span>
              <span className="text-xs text-muted-foreground/70">
                Drop a file or click to browse
              </span>
            </button>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button
            disabled={!canSubmit}
            className="gap-2 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => {
              onConfirm(reason, file);
              close();
            }}
          >
            <Undo2 className="h-4 w-4" /> Decline & Return
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
