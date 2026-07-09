"use client";

// Task History side panel. Loaded lazily (next/dynamic) from the task detail
// page — it only appears when the user opens the History view.

import { useEffect, useState } from "react";
import {
  History,
  Clock,
  X,
  List,
  MessageSquare,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { HistoryEntry } from "./task-detail-client";

function formatDurationMs(ms: number): string {
  if (ms < 0) return "0s";
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

function formatRelativeDate(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function TaskHistoryPanel({
  statusName,
  statusColor,
  stageEnteredAt,
  history,
  totalTimeMs,
  tab,
  onTabChange,
  onClose,
}: {
  statusName: string | null;
  statusColor: string;
  stageEnteredAt: string | null;
  history: HistoryEntry[];
  totalTimeMs: number;
  tab: "all" | "comments" | "status";
  onTabChange: (tab: "all" | "comments" | "status") => void;
  onClose: () => void;
}) {
  const statusEntries = history.filter((h) => h.action === "status_change" || h.action === "created");
  const displayEntries = tab === "status" ? statusEntries : history;
  const statusCount = statusEntries.filter((h) => h.action === "status_change").length;

  const [, tick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => tick((n) => n + 1), 60_000);
    return () => clearInterval(iv);
  }, []);

  const currentDuration = stageEnteredAt
    ? Date.now() - new Date(stageEnteredAt).getTime()
    : 0;

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-background shadow-2xl animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
        <History className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold">Task History</span>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-[10px] font-mono tabular-nums text-muted-foreground">
            <Clock className="h-3 w-3" />
            Total {formatDurationMs(totalTimeMs)}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-muted/40 hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4 border-b border-border/60 px-4 py-2">
        {([
          { key: "all" as const, icon: List, label: "All", count: history.length },
          { key: "comments" as const, icon: MessageSquare, label: "Comments", count: 0 },
          { key: "status" as const, icon: ArrowRight, label: "Status", count: statusCount },
        ]).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => onTabChange(t.key)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              tab === t.key
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <t.icon className="h-3 w-3" />
            {t.label}
            <span className="tabular-nums">{t.count}</span>
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-6">
          {/* Current status */}
          {statusName && (
            <div className="flex items-start gap-3">
              <div
                className="mt-1 h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: statusColor }}
              />
              <div>
                <p className="text-sm font-medium">
                  Currently in {statusName}
                </p>
                {stageEnteredAt && (
                  <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-primary">
                    <Clock className="h-2.5 w-2.5" />
                    {formatDurationMs(currentDuration)} · ongoing
                  </span>
                )}
              </div>
            </div>
          )}

          {/* History entries */}
          {displayEntries.map((entry) => (
            <div key={entry.id} className="flex items-start gap-3">
              <div className="mt-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[9px] font-semibold text-muted-foreground">
                {(entry.memberName ?? "?").charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                {entry.action === "created" ? (
                  <p className="text-sm">
                    <span className="font-medium">{entry.memberName ?? "Someone"}</span>
                    {" "}created this task
                  </p>
                ) : (
                  <p className="text-sm">
                    <span className="font-medium">{entry.memberName ?? "Someone"}</span>
                    {" "}moved from {entry.fromStatusName ?? "—"}{" "}
                    <ArrowRight className="inline h-3 w-3 text-muted-foreground" />{" "}
                    {entry.toStatusName ?? "—"}
                  </p>
                )}
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">
                    {formatRelativeDate(entry.createdAt)}
                  </span>
                  {entry.durationMs != null && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-violet-400">
                      <Clock className="h-2.5 w-2.5" />
                      {formatDurationMs(entry.durationMs)}
                    </span>
                  )}
                  {entry.fromStatusName && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] text-muted-foreground">
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                      {entry.fromStatusName}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
