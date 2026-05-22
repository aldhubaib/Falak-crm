"use client";

import { useState, useEffect, useCallback } from "react";
import { History, X } from "lucide-react";
import { fetchRecentActivity } from "@/actions/activity";
import { ActivityFeed } from "@/components/activity-feed";
import { cn } from "@/lib/utils";

type Activity = {
  id: string;
  userName: string | null;
  entityType: string;
  entityId: string;
  entityName: string | null;
  action: string;
  changes: Record<string, { from: unknown; to: unknown }> | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
};

export function ActivityPanel() {
  const [open, setOpen] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchRecentActivity(50);
      setActivities(data as Activity[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
        title="Activity Log"
      >
        <History className="w-4 h-4" />
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[900]"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Panel */}
      <div
        className={cn(
          "fixed top-0 right-0 h-screen w-[380px] max-w-[90vw] bg-background border-l border-border z-[950] transition-transform duration-200 ease-out flex flex-col",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex items-center justify-between px-5 h-14 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-[14px] font-semibold text-foreground">Activity</h2>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading && activities.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">Loading...</p>
          ) : (
            <ActivityFeed activities={activities} />
          )}
        </div>
      </div>
    </>
  );
}
