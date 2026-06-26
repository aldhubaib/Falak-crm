"use client";

import { useState, useRef, useEffect } from "react";
import { MoreVertical } from "lucide-react";
import { NotificationBell } from "@/components/notification-bell";
import { GlobalSearch } from "@/components/global-search";
import { ActivityPanel } from "@/components/activity-panel";

export function HeaderActions() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="flex items-center gap-1 shrink-0">
      <NotificationBell />
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setOpen(!open)}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
        {open && (
          <div className="absolute right-0 top-full mt-1 bg-black border border-border rounded-xl shadow-xl overflow-hidden z-[200] p-1.5 flex flex-col gap-1">
            <div onClick={() => setOpen(false)}>
              <GlobalSearch />
            </div>
            <div onClick={() => setOpen(false)}>
              <ActivityPanel />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
