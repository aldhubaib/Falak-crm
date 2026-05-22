"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, RotateCcw, Copy, Check, ChevronDown, ChevronUp } from "lucide-react";
import { createAppError, formatErrorForClipboard, type AppError } from "@/lib/errors";

export default function GlobalError({
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
      action: "Application rendering",
      context: { digest: error.digest },
    });
    setAppError(err);
    console.error("[Falak CRM Global Error]", err);
  }, [error]);

  const handleCopy = async () => {
    if (!appError) return;
    const text = formatErrorForClipboard(appError);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
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
    }
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <html lang="en" className="dark h-full antialiased">
      <body className="min-h-full bg-[#0e0e10] text-white flex items-center justify-center p-6">
        <div className="w-full max-w-lg">
          <div className="rounded-xl border border-red-500/30 bg-[#1a1a1e] p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <h2 className="text-[16px] font-semibold">Application Error</h2>
                <p className="text-[13px] text-gray-400 mt-0.5">
                  {appError?.message || error.message}
                </p>
              </div>
            </div>

            {appError && (
              <div className="mb-4">
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="flex items-center gap-1.5 text-[12px] text-gray-400 hover:text-white transition-colors"
                >
                  {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  {expanded ? "Hide" : "Show"} error details
                </button>
                {expanded && (
                  <div className="mt-3 rounded-lg bg-black/30 border border-gray-800 p-4 max-h-[300px] overflow-auto">
                    <div className="space-y-1.5 text-[11px] font-mono text-gray-400">
                      <p><span className="text-gray-300">Code:</span> {appError.code}</p>
                      <p><span className="text-gray-300">Time:</span> {appError.timestamp}</p>
                      <p><span className="text-gray-300">URL:</span> {appError.url}</p>
                      {appError.digest && (
                        <p><span className="text-gray-300">Digest:</span> {appError.digest}</p>
                      )}
                    </div>
                    {appError.stack && (
                      <pre className="mt-3 text-[10px] font-mono text-gray-500 whitespace-pre-wrap break-all leading-relaxed border-t border-gray-800 pt-3">
                        {appError.stack}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={reset}
                className="h-9 px-4 rounded-full border border-gray-700 text-[12px] font-medium text-white hover:bg-white/5 transition-colors flex items-center gap-2"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Try Again
              </button>
              <button
                onClick={handleCopy}
                className={`h-9 px-4 rounded-full border text-[12px] font-medium flex items-center gap-2 transition-all ${
                  copied
                    ? "border-green-500/50 text-green-500 bg-green-500/10"
                    : "border-gray-700 text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied!" : "Copy Error"}
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
