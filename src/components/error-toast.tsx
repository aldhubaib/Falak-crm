"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, X, Copy, Check, ChevronDown, ChevronUp } from "lucide-react";
import { useErrorStore } from "@/lib/error-store";
import { copyErrorToClipboard, type AppError } from "@/lib/errors";
import { cn } from "@/lib/utils";

function ErrorItem({ error, onDismiss }: { error: AppError; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleCopy = async () => {
    const ok = await copyErrorToClipboard(error);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  useEffect(() => {
    const timer = setTimeout(onDismiss, 15000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="animate-in slide-in-from-bottom-2 fade-in-0 duration-200 w-full max-w-[420px] rounded-xl border border-destructive/30 bg-background shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-3 p-4 pb-2">
        <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center shrink-0 mt-0.5">
          <AlertTriangle className="w-4 h-4 text-destructive" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-foreground leading-snug break-words">
            {error.message}
          </p>
          {error.action && (
            <p className="text-[11px] text-muted-foreground mt-0.5">
              While: {error.action}
            </p>
          )}
        </div>
        <button
          onClick={onDismiss}
          className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Expandable details */}
      {(error.stack || error.context) && (
        <div className="px-4">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? "Hide" : "Show"} details
          </button>
          {expanded && (
            <div className="mt-2 rounded-lg bg-muted/30 border border-border p-3 max-h-[200px] overflow-auto">
              {error.code && (
                <p className="text-[11px] font-mono text-muted-foreground mb-1">
                  Code: {error.code}{error.prismaCode ? ` (${error.prismaCode})` : ""}
                </p>
              )}
              {error.context && Object.keys(error.context).length > 0 && (
                <div className="mb-2">
                  {Object.entries(error.context).map(([key, val]) => (
                    <p key={key} className="text-[11px] font-mono text-muted-foreground">
                      {key}: {JSON.stringify(val)}
                    </p>
                  ))}
                </div>
              )}
              {error.stack && (
                <pre className="text-[10px] font-mono text-muted-foreground whitespace-pre-wrap break-all leading-relaxed">
                  {error.stack.split("\n").slice(0, 8).join("\n")}
                </pre>
              )}
            </div>
          )}
        </div>
      )}

      {/* Footer with copy */}
      <div className="flex items-center justify-between px-4 py-3 mt-1">
        <p className="text-[10px] font-mono text-muted-foreground">
          {new Date(error.timestamp).toLocaleTimeString()}
        </p>
        <button
          onClick={handleCopy}
          className={cn(
            "h-7 px-3 rounded-full border text-[11px] font-medium flex items-center gap-1.5 transition-all",
            copied
              ? "border-green-500/50 text-green-500 bg-green-500/10"
              : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/30"
          )}
        >
          {copied ? (
            <>
              <Check className="w-3 h-3" />
              Copied
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              Copy Error
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export function ErrorToast() {
  const { errors, dismiss } = useErrorStore();

  if (errors.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col-reverse gap-2 items-end">
      {errors.slice(0, 3).map((error) => (
        <ErrorItem
          key={error.id}
          error={error}
          onDismiss={() => dismiss(error.id)}
        />
      ))}
      {errors.length > 3 && (
        <p className="text-[11px] text-muted-foreground px-3 py-1 rounded-full bg-background border border-border">
          +{errors.length - 3} more errors
        </p>
      )}
    </div>
  );
}
