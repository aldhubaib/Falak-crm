"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ProjectAvatar } from "@/components/project-avatar";
import { cn } from "@/lib/utils";

// Resolve a project photo (attachment) to a URL once and share it across every
// avatar instance so a calendar full of the same projects only fetches once.
const urlCache = new Map<string, string>();
const inflight = new Map<string, Promise<string | null>>();

function resolveThumb(id: string): Promise<string | null> {
  const cached = urlCache.get(id);
  if (cached) return Promise.resolve(cached);
  const pending = inflight.get(id);
  if (pending) return pending;
  const p = fetch(`/api/files/${id}/download-url`)
    .then((r) => (r.ok ? r.json() : null))
    .then((d: { url?: string } | null) => {
      const url = d?.url ?? null;
      if (url) urlCache.set(id, url);
      return url;
    })
    .catch(() => null)
    .finally(() => inflight.delete(id));
  inflight.set(id, p);
  return p;
}

// Project avatar that shows the uploaded project photo when available and falls
// back to the colored initial otherwise.
export function PublishAvatar({
  name,
  thumbnailId,
  size = 28,
  className,
  fallback,
}: {
  name: string;
  thumbnailId?: string | null;
  size?: number;
  className?: string;
  /** Rendered while the photo resolves or when the project has none.
   *  Defaults to the colored-initial ProjectAvatar. */
  fallback?: ReactNode;
}) {
  const [url, setUrl] = useState<string | null>(
    thumbnailId ? urlCache.get(thumbnailId) ?? null : null,
  );

  useEffect(() => {
    if (!thumbnailId) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    resolveThumb(thumbnailId).then((u) => {
      if (!cancelled) setUrl(u);
    });
    return () => {
      cancelled = true;
    };
  }, [thumbnailId]);

  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        aria-hidden
        className={cn("shrink-0 rounded-full object-cover", className)}
        style={{ width: size, height: size }}
      />
    );
  }

  if (fallback !== undefined) return <>{fallback}</>;
  return <ProjectAvatar name={name} size={size} className={className} />;
}
