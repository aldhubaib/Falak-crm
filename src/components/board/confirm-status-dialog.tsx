"use client";

import { ArrowRight, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ConfirmStatusDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  assignToMe = false,
  currentAssigneeName,
  currentAssigneeAvatar,
  meName,
  meAvatar,
  nextOwnerName,
  nextOwnerAvatar,
  nextOwnerIsMe,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  /** Render the "taking ownership" hand-off chips (current assignee → me). */
  assignToMe?: boolean;
  currentAssigneeName?: string | null;
  currentAssigneeAvatar?: string | null;
  meName?: string | null;
  meAvatar?: string | null;
  /** Predicted owner after the move when it ISN'T the current assignee —
   * e.g. approving out of a review stage hands the task back to the worker.
   * Overrides the "me" side of the hand-off chips. */
  nextOwnerName?: string | null;
  nextOwnerAvatar?: string | null;
  nextOwnerIsMe?: boolean;
}) {
  const me = meName || "You";
  // Right-hand chip: the predicted next owner when known, otherwise me.
  const targetName = nextOwnerName ?? me;
  const targetAvatar = nextOwnerName != null ? (nextOwnerAvatar ?? null) : meAvatar;
  const targetIsMe = nextOwnerName == null || nextOwnerIsMe === true;
  const showHandoff = assignToMe || nextOwnerName != null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-3 sm:max-w-lg sm:gap-4 [&>button[type=button]]:hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-surface/60 p-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/15 text-primary sm:h-10 sm:w-10">
            <UserCheck className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          {showHandoff ? (
            <div className="min-w-0 flex-1 space-y-2">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {targetIsMe ? "Taking ownership" : "Hands back to the worker"}
              </div>
              <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm sm:flex-nowrap">
                {currentAssigneeName ? (
                  <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full bg-muted/50 py-0.5 pl-0.5 pr-2.5 text-muted-foreground">
                    <Avatar className="h-5 w-5">
                      {currentAssigneeAvatar && (
                        <AvatarImage
                          src={currentAssigneeAvatar}
                          alt={currentAssigneeName}
                        />
                      )}
                      <AvatarFallback className="bg-muted text-[10px] font-semibold text-muted-foreground">
                        {currentAssigneeName.slice(0, 1).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate">{currentAssigneeName}</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/50 px-2.5 py-1 text-muted-foreground">
                    Unassigned
                  </span>
                )}
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full bg-primary/15 py-0.5 pl-0.5 pr-2.5 font-medium text-primary">
                  <Avatar className="h-5 w-5">
                    {targetAvatar && <AvatarImage src={targetAvatar} alt={targetName} />}
                    <AvatarFallback className="bg-primary text-[10px] font-bold text-primary-foreground">
                      {targetName.slice(0, 1).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate">{targetName}</span>
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
          ) : (
            <div className="min-w-0 flex-1 space-y-1">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {title}
              </div>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-0">
          <Button variant="ghost" onClick={onClose} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto"
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
