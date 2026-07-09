"use client";

// Link-preview cards for chat: a dismissible card above the composer while a
// URL sits in the draft, and a site card rendered inside message bubbles.
// Metadata comes from the getLinkPreview server action (Redis-cached); the
// client additionally memoizes per-URL so a thread full of the same link
// resolves it once.

import { useEffect, useState } from "react";
import { X, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { getLinkPreview, type LinkPreview } from "@/actions/link-preview";

// First http(s) URL in a piece of text — used by both the composer watcher
// and the bubble renderer.
export const URL_RE = /https?:\/\/[^\s<>"')\]]+/g;

export function extractFirstUrl(text: string): string | null {
  URL_RE.lastIndex = 0;
  const m = URL_RE.exec(text);
  return m ? m[0] : null;
}

// One in-flight/settled promise per URL for the lifetime of the tab.
const previewCache = new Map<string, Promise<LinkPreview | null>>();

function usePreview(url: string | null, debounceMs = 0) {
  const [preview, setPreview] = useState<LinkPreview | null>(null);

  useEffect(() => {
    setPreview(null);
    if (!url) return;
    let cancelled = false;

    const run = () => {
      let p = previewCache.get(url);
      if (!p) {
        p = getLinkPreview(url).catch(() => null);
        previewCache.set(url, p);
      }
      void p.then((res) => {
        if (!cancelled) setPreview(res);
      });
    };

    // Debounce while the user is still typing the URL in the composer.
    const timer = debounceMs > 0 ? setTimeout(run, debounceMs) : (run(), null);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [url, debounceMs]);

  return preview;
}

function PreviewIcon({
  preview,
  className,
}: {
  preview: LinkPreview;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  if (!preview.icon || broken) {
    return (
      <div
        className={cn(
          "grid shrink-0 place-items-center rounded-xl bg-surface-2 text-muted-foreground",
          className,
        )}
      >
        <Globe className="h-5 w-5" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={preview.icon}
      alt=""
      aria-hidden
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
      className={cn("shrink-0 rounded-xl bg-black/40 object-cover", className)}
    />
  );
}

/** Card shown above the composer while the draft contains a URL. */
export function ComposerLinkPreview({
  url,
  onDismiss,
}: {
  url: string;
  onDismiss: () => void;
}) {
  const preview = usePreview(url, 500);
  if (!preview) return null;

  return (
    <div className="mb-2 flex items-center gap-3 rounded-2xl border border-border/60 bg-surface/60 p-2.5">
      <PreviewIcon preview={preview} className="h-10 w-10" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-foreground">
          {preview.siteName}
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {preview.url}
        </div>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Remove link preview"
        className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Site card rendered inside a message bubble under the linked text. */
export function BubbleLinkPreview({ url }: { url: string }) {
  const preview = usePreview(url);
  if (!preview) return null;

  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="flex w-full min-w-56 items-center gap-3 rounded-xl bg-black/85 p-2.5 transition-opacity hover:opacity-90"
    >
      <PreviewIcon preview={preview} className="h-10 w-10" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-white">
          {preview.siteName}
        </div>
        <div className="truncate text-xs text-white/60">{preview.url}</div>
      </div>
    </a>
  );
}
