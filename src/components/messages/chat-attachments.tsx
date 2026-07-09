"use client";

// Eager chat-attachment pieces: the per-message AttachmentBubble and the
// lightbox state hook. The heavy, rarely-shown views (Lightbox viewer,
// FilesPanel) live in ./lightbox and ./files-panel and are lazy-loaded.

import { useState } from "react";
import { Download, FileAudio } from "lucide-react";
import type { MessageAttachment } from "@/actions/messages";
import { formatBytes, fileIconFor } from "./file-utils";

export function useLightbox() {
  const [state, setState] = useState<{
    images: MessageAttachment[];
    index: number;
  } | null>(null);
  return {
    open: (att: MessageAttachment, all: MessageAttachment[]) => {
      const idx = Math.max(
        0,
        all.findIndex((a) => a.id === att.id),
      );
      setState({ images: all, index: idx });
    },
    close: () => setState(null),
    state,
    setIndex: (i: number) => setState((s) => (s ? { ...s, index: i } : s)),
  };
}

// Recorded voice notes (named by the recorder in the composer) get a compact
// player pill; other uploaded audio files keep the full file card below.
export function isVoiceAttachment(attachment: MessageAttachment): boolean {
  return (
    (attachment.contentType ?? "").startsWith("audio/") &&
    attachment.name.startsWith("Voice message")
  );
}

export function AttachmentBubble({
  attachment,
  mine,
  onOpenImage,
  menu,
  timeLabel,
}: {
  attachment: MessageAttachment;
  mine: boolean;
  onOpenImage?: (att: MessageAttachment) => void;
  menu?: React.ReactNode;
  /** Message time shown inline inside the voice pill (voice notes only). */
  timeLabel?: string;
}) {
  const ct = attachment.contentType ?? "";

  if (attachment.isImage) {
    return (
      <div
        className="group relative overflow-hidden rounded-xl border border-border/50 bg-surface"
        style={{ aspectRatio: "4 / 3", width: 210 }}
      >
        <button
          type="button"
          onClick={() => onOpenImage?.(attachment)}
          className="block h-full w-full"
          aria-label={`Open ${attachment.name}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/files/${attachment.id}/stream`}
            alt={attachment.name}
            className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
          />
        </button>
        {menu && (
          <div className="absolute left-2 top-2 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
            {menu}
          </div>
        )}
        <a
          href={`/api/files/${attachment.id}/stream`}
          download={attachment.name}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-2 right-2 grid size-8 place-items-center rounded-full bg-black/60 text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/80 group-hover:opacity-100"
          aria-label="Download"
        >
          <Download className="h-4 w-4" />
        </a>
      </div>
    );
  }

  if (ct.startsWith("video/")) {
    return (
      <div className="group relative overflow-hidden rounded-xl bg-black">
        <video
          src={`/api/files/${attachment.id}/stream`}
          controls
          preload="metadata"
          className="max-h-96 w-full max-w-md"
        />
        <a
          href={`/api/files/${attachment.id}/stream`}
          download={attachment.name}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-black/60 text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/80 group-hover:opacity-100"
          aria-label="Download"
        >
          <Download className="h-4 w-4" />
        </a>
      </div>
    );
  }

  if (isVoiceAttachment(attachment)) {
    // Voice note: bare player + inline message time — no icon, no filename,
    // no download button (matches the Lovable design). The actions caret
    // still appears on hover so voice notes can be reacted/replied to.
    return (
      <div className="group flex w-full max-w-md items-center gap-2 rounded-xl border border-border/60 bg-surface/60 p-2">
        <audio
          src={`/api/files/${attachment.id}/stream`}
          controls
          preload="metadata"
          className="h-9 min-w-0 flex-1"
          // Native media controls follow the element's color-scheme; voice
          // notes use the light (white pill) look from the Lovable design.
          style={{ colorScheme: "light" }}
        />
        {timeLabel && (
          <span className="shrink-0 pr-1 text-[10px] leading-none text-muted-foreground">
            {timeLabel}
          </span>
        )}
        {menu && <div className="shrink-0">{menu}</div>}
      </div>
    );
  }

  if (ct.startsWith("audio/")) {
    return (
      <div className="flex w-full max-w-md items-center gap-3 rounded-xl border border-border/60 bg-surface/60 p-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
          <FileAudio className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-medium">{attachment.name}</div>
          <audio
            src={`/api/files/${attachment.id}/stream`}
            controls
            preload="metadata"
            className="mt-1 h-8 w-full"
            style={{ colorScheme: "dark" }}
          />
        </div>
        <a
          href={`/api/files/${attachment.id}/stream`}
          download={attachment.name}
          target="_blank"
          rel="noopener noreferrer"
          className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
          aria-label="Download"
        >
          <Download className="h-4 w-4" />
        </a>
      </div>
    );
  }

  const Icon = fileIconFor(attachment);
  return (
    <div className="group relative w-full max-w-sm">
      <a
        href={`/api/files/${attachment.id}/stream`}
        download={attachment.name}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 rounded-2xl border border-border/60 bg-surface/60 p-3 text-foreground transition-colors hover:bg-surface"
      >
        <div className="relative grid size-11 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
          <Icon className="h-5 w-5 transition-opacity group-hover:opacity-0" />
          <Download className="absolute h-5 w-5 opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
        <div className="min-w-0 flex-1 pr-6">
          <div className="truncate text-sm font-semibold">{attachment.name}</div>
          <div className="text-xs text-muted-foreground">
            {(attachment.contentType ?? "").split("/")[1]?.toUpperCase() ?? "FILE"}
            {attachment.sizeBytes ? ` · ${formatBytes(attachment.sizeBytes)}` : ""}
          </div>
        </div>
      </a>
      {menu && <div className="absolute right-1.5 top-1.5">{menu}</div>}
    </div>
  );
}
