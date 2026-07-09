"use client";

// "Shared Files" side panel for a chat thread. Loaded lazily (next/dynamic)
// only when the user opens the Files view.

import { useMemo, useState } from "react";
import { Download, X, File as FileIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MessageAttachment } from "@/actions/messages";
import { useLightbox } from "./chat-attachments";
import Lightbox from "./lightbox";
import { formatBytes, fileIconFor } from "./file-utils";

type Filter = "all" | "image" | "video" | "audio" | "file";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "image", label: "Images" },
  { id: "video", label: "Videos" },
  { id: "audio", label: "Audio" },
  { id: "file", label: "Files" },
];

export default function FilesPanel({
  messages,
  onClose,
}: {
  messages: { authorName: string; createdAt: string; attachments: MessageAttachment[] }[];
  onClose: () => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const lb = useLightbox();

  const items = useMemo(() => {
    const out: {
      att: MessageAttachment;
      authorName: string;
      createdAt: string;
    }[] = [];
    for (const m of messages) {
      for (const a of m.attachments) {
        const ct = a.contentType ?? "";
        const kind: Filter = a.isImage
          ? "image"
          : ct.startsWith("video/")
            ? "video"
            : ct.startsWith("audio/")
              ? "audio"
              : "file";
        if (filter === "all" || filter === kind) {
          out.push({ att: a, authorName: m.authorName, createdAt: m.createdAt });
        }
      }
    }
    return out.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [messages, filter]);

  const images = items.filter((i) => i.att.isImage).map((i) => i.att);

  return (
    <div className="flex min-h-0 flex-1 flex-col border-l border-border/60">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border/60 px-4">
        <span className="text-sm font-semibold">Shared Files</span>
        <button
          type="button"
          onClick={onClose}
          className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-surface hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex shrink-0 items-center gap-1 border-b border-border/60 px-4 py-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs transition-colors",
              filter === f.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-surface hover:text-foreground",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {items.length === 0 ? (
          <div className="py-16 text-center text-xs text-muted-foreground">
            No {filter === "all" ? "files" : filter + "s"} shared yet.
          </div>
        ) : filter === "image" ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {items.map(({ att }) => (
              <button
                key={att.id}
                onClick={() => lb.open(att, images)}
                className="group relative overflow-hidden rounded-lg bg-surface"
                style={{ aspectRatio: "1 / 1" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/files/${att.id}/stream`}
                  alt={att.name}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
              </button>
            ))}
          </div>
        ) : (
          <ul className="flex flex-col gap-1">
            {items.map(({ att, authorName, createdAt }) => {
              const Icon = att.isImage ? FileIcon : fileIconFor(att);
              return (
                <li key={att.id}>
                  <div className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-surface/60">
                    {att.isImage ? (
                      <button
                        onClick={() => lb.open(att, images)}
                        className="size-10 shrink-0 overflow-hidden rounded-md bg-surface"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/files/${att.id}/stream`}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ) : (
                      <div className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/15 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {att.name}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {authorName} ·{" "}
                        {new Date(createdAt).toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                        })}
                        {att.sizeBytes ? ` · ${formatBytes(att.sizeBytes)}` : ""}
                      </div>
                    </div>
                    <a
                      href={`/api/files/${att.id}/stream`}
                      download={att.name}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
                      aria-label="Download"
                    >
                      <Download className="h-4 w-4" />
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {lb.state && (
        <Lightbox
          images={lb.state.images}
          index={lb.state.index}
          onClose={lb.close}
          onIndex={lb.setIndex}
        />
      )}
    </div>
  );
}
