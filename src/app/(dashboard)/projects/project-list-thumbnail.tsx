"use client";

import { useEffect, useState } from "react";
import { FolderKanban } from "lucide-react";

export function ProjectCardThumbnail({
  thumbnailId,
  name,
}: {
  thumbnailId: string | null;
  name: string;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!thumbnailId) return;
    let cancelled = false;
    fetch(`/api/files/${thumbnailId}/download-url`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.url) setUrl(data.url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [thumbnailId]);

  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className="w-full h-full object-cover"
      />
    );
  }

  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  if (thumbnailId) {
    return (
      <div className="w-full h-full bg-primary/10 flex items-center justify-center">
        <span className="text-2xl font-bold text-primary">{initials}</span>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-purple/10 flex items-center justify-center">
      <FolderKanban className="w-10 h-10 text-purple/40" />
    </div>
  );
}
