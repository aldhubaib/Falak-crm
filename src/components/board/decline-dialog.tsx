"use client";

import { useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Paperclip,
  Undo2,
  User,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  mentionAvatar,
  meName,
  meAvatar,
  onClose,
  onConfirm,
}: {
  open: boolean;
  fromLabel: string;
  toLabel: string;
  /** Person who submitted the task — @mentioned by default and not editable. */
  mentionName?: string | null;
  mentionAvatar?: string | null;
  meName?: string | null;
  meAvatar?: string | null;
  onClose: () => void;
  onConfirm: (reason: string, file: File | null) => void;
}) {
  const [reason, setReason] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const canSubmit = reason.trim().length > 0;

  const me = meName || "You";

  const close = () => {
    setReason("");
    setFile(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-h-[90dvh] gap-3 overflow-y-auto border-destructive/40 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:max-h-[85vh] sm:max-w-lg sm:gap-4 sm:p-6 [&>button[type=button]]:hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>Decline Task</DialogTitle>
          <DialogDescription>
            Return this task from {fromLabel} back to {toLabel}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-surface/60 p-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-destructive/15 text-destructive sm:h-10 sm:w-10">
            <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Decline a task
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/50 py-0.5 pl-0.5 pr-2.5 text-muted-foreground">
                <Avatar className="h-5 w-5">
                  {meAvatar && <AvatarImage src={meAvatar} alt={me} />}
                  <AvatarFallback className="bg-muted text-[10px] font-semibold text-muted-foreground">
                    {me.slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                You
              </span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              {mentionName ? (
                <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full bg-primary/15 py-0.5 pl-0.5 pr-2.5 font-medium text-primary">
                  <Avatar className="h-5 w-5">
                    {mentionAvatar && (
                      <AvatarImage src={mentionAvatar} alt={mentionName} />
                    )}
                    <AvatarFallback className="bg-primary text-[10px] font-bold text-primary-foreground">
                      {mentionName.slice(0, 1).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate">{mentionName}</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/50 px-2.5 py-1 text-muted-foreground">
                  <User className="h-3.5 w-3.5" />
                  Unassigned
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {mentionName
                ? `${mentionName} will be notified and this`
                : "This"}{" "}
              task will move back to {toLabel}.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">
            Reason for declining <span className="text-destructive">*</span>
          </label>
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
              className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-border/70 bg-surface/40 py-2.5 text-center transition-colors hover:border-border hover:bg-surface"
            >
              <Paperclip className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Attach files
              </span>
              <span className="text-xs text-muted-foreground/70">
                — drop or browse
              </span>
            </button>
          )}
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-0">
          <Button variant="ghost" onClick={close} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button
            disabled={!canSubmit}
            className="w-full gap-2 bg-destructive text-destructive-foreground hover:bg-destructive/90 sm:w-auto"
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
