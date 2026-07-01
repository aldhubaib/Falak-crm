"use client";

import { useState, useEffect, useCallback, useSyncExternalStore } from "react";
import { uploadManager, type UploadItem } from "@/lib/upload-manager";
import { Upload, CheckCircle2, AlertCircle, X, ChevronDown, ChevronUp, RotateCcw } from "lucide-react";

const EMPTY: UploadItem[] = [];

function useUploadManager() {
  const subscribe = useCallback((cb: () => void) => uploadManager.subscribe(cb), []);
  const getSnapshot = useCallback(() => uploadManager.getItems(), []);
  const getServerSnapshot = useCallback(() => EMPTY, []);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function UploadIndicator() {
  const items = useUploadManager();
  const [expanded, setExpanded] = useState(false);
  const [visible, setVisible] = useState(false);

  const activeCount = items.filter((i) => i.status === "uploading" || i.status === "completing" || i.status === "queued").length;
  const doneCount = items.filter((i) => i.status === "done").length;
  const errorCount = items.filter((i) => i.status === "error").length;
  const total = items.length;

  useEffect(() => {
    if (total > 0) setVisible(true);
  }, [total]);

  if (!visible || total === 0) return null;

  const handleDismiss = () => {
    if (activeCount > 0) return;
    uploadManager.clearCompleted();
    setVisible(false);
    setExpanded(false);
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {activeCount > 0 ? (
          <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin shrink-0" />
        ) : errorCount > 0 ? (
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
        ) : (
          <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
        )}

        <div className="flex-1 min-w-0">
          <p className="text-sub font-medium text-foreground">
            {activeCount > 0
              ? `Uploading ${activeCount} file${activeCount > 1 ? "s" : ""}...`
              : errorCount > 0
              ? `${doneCount} uploaded, ${errorCount} failed`
              : `${doneCount} file${doneCount > 1 ? "s" : ""} uploaded`}
          </p>
          {activeCount > 0 && (
            <div className="w-full h-1 bg-muted rounded-full mt-1.5 overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${Math.round((doneCount / total) * 100)}%` }}
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {expanded ? <ChevronDown className="w-icon-sm h-icon-sm text-muted-foreground" /> : <ChevronUp className="w-icon-sm h-icon-sm text-muted-foreground" />}
          {activeCount === 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); handleDismiss(); }}
              className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground"
            >
              <X className="w-icon-sm h-icon-sm" />
            </button>
          )}
        </div>
      </div>

      {/* File list */}
      {expanded && (
        <div className="border-t border-border max-h-60 overflow-y-auto">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 px-4 py-2 text-sub">
              {item.status === "done" ? (
                <CheckCircle2 className="w-icon-sm h-icon-sm text-green-400 shrink-0" />
              ) : item.status === "error" ? (
                <AlertCircle className="w-icon-sm h-icon-sm text-red-400 shrink-0" />
              ) : (
                <Upload className="w-icon-sm h-icon-sm text-primary shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <span className="block truncate text-foreground">{item.file.name}</span>
                {item.status === "error" && item.error && (
                  <span className="block text-red-400 text-label truncate">{item.error}</span>
                )}
              </div>
              {(item.status === "uploading" || item.status === "completing") && (
                <span className="text-muted-foreground shrink-0">{item.progress}%</span>
              )}
              {item.status === "error" && (
                <button
                  onClick={(e) => { e.stopPropagation(); uploadManager.retry(item.id); }}
                  className="shrink-0 flex items-center gap-1 text-label text-primary hover:text-primary/80 transition-colors min-h-touch"
                  title="Retry upload"
                >
                  <RotateCcw className="w-icon-sm h-icon-sm" />
                  Retry
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Retry All bar */}
      {errorCount > 0 && activeCount === 0 && expanded && (
        <div className="border-t border-border px-4 py-2 flex items-center justify-end">
          <button
            onClick={() => uploadManager.retryAll()}
            className="flex items-center gap-1.5 text-sub font-medium text-primary hover:text-primary/80 transition-colors min-h-touch"
          >
            <RotateCcw className="w-icon-sm h-icon-sm" />
            Retry all failed ({errorCount})
          </button>
        </div>
      )}
    </div>
  );
}
