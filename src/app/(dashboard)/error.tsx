"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, RotateCcw, Copy, Check, ChevronDown, ChevronUp } from "lucide-react";
import { createAppError, formatErrorForClipboard, type AppError } from "@/lib/errors";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [appError, setAppError] = useState<AppError | null>(null);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const err = createAppError(error, {
      action: "Rendering dashboard page",
      context: { digest: error.digest },
    });
    setAppError(err);
    console.error("[Falak CRM Error]", err);
  }, [error]);

  const handleCopy = async () => {
    if (!appError) return;
    const text = formatErrorForClipboard(appError);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <div className="rounded-xl border border-destructive/30 bg-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-6 h-6 text-destructive" />
            </div>
            <div>
              <h2 className="text-[16px] font-semibold text-foreground">Something went wrong</h2>
              <p className="text-[13px] text-muted-foreground mt-0.5">
                {appError?.message || error.message}
              </p>
            </div>
          </div>

          {/* Expandable error details */}
          {appError && (
            <div className="mb-4">
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
              >
                {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                {expanded ? "Hide" : "Show"} error details
              </button>
              {expanded && (
                <div className="mt-3 rounded-lg bg-muted/20 border border-border p-4 max-h-[300px] overflow-auto">
                  <div className="space-y-1.5 text-[11px] font-mono text-muted-foreground">
                    <p><span className="text-foreground/70">Code:</span> {appError.code}</p>
                    <p><span className="text-foreground/70">Time:</span> {appError.timestamp}</p>
                    <p><span className="text-foreground/70">URL:</span> {appError.url}</p>
                    {appError.digest && (
                      <p><span className="text-foreground/70">Digest:</span> {appError.digest}</p>
                    )}
                  </div>
                  {appError.stack && (
                    <pre className="mt-3 text-[10px] font-mono text-muted-foreground whitespace-pre-wrap break-all leading-relaxed border-t border-border pt-3">
                      {appError.stack}
                    </pre>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={reset}
              className="h-9 px-4 rounded-full border border-border text-[12px] font-medium text-foreground hover:bg-muted/30 transition-colors flex items-center gap-2"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Try Again
            </button>
            <button
              onClick={handleCopy}
              className={`h-9 px-4 rounded-full border text-[12px] font-medium flex items-center gap-2 transition-all ${
                copied
                  ? "border-green-500/50 text-green-500 bg-green-500/10"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/30"
              }`}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied!" : "Copy Error"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
