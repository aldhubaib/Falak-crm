"use client";

import { User } from "lucide-react";

interface RecordOwnerProps {
  ownerName?: string | null;
}

export function RecordOwner({ ownerName }: RecordOwnerProps) {
  return (
    <div className="rounded-lg bg-black border border-border px-3 pt-2 pb-1.5">
      <label className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
        <User className="w-3 h-3" />
        Record Owner
      </label>
      <div className="flex items-center gap-2 h-8">
        <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center">
          <User className="w-3 h-3 text-muted-foreground" />
        </div>
        <span className="text-[13px] text-foreground">
          {ownerName || "Unassigned"}
        </span>
      </div>
    </div>
  );
}
