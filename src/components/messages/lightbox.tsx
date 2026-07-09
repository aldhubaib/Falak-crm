"use client";

// Fullscreen image viewer for chat attachments. Loaded lazily (next/dynamic)
// from the chat views — it must not sit in the initial thread bundle.

import { useEffect } from "react";
import { Download, X, ChevronLeft, ChevronRight } from "lucide-react";
import type { MessageAttachment } from "@/actions/messages";
import { formatBytes } from "./file-utils";

export default function Lightbox({
  images,
  index,
  onClose,
  onIndex,
  renderMenu,
}: {
  images: MessageAttachment[];
  index: number;
  onClose: () => void;
  onIndex: (i: number) => void;
  renderMenu?: (att: MessageAttachment) => React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onIndex((index + 1) % images.length);
      if (e.key === "ArrowLeft")
        onIndex((index - 1 + images.length) % images.length);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [index, images.length, onClose, onIndex]);

  const current = images[index];
  if (!current) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={current.name}
    >
      <div
        className="flex items-center justify-between gap-2 px-4 py-3 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{current.name}</div>
          <div className="text-xs text-white/60">
            {index + 1} of {images.length}
            {current.sizeBytes ? ` · ${formatBytes(current.sizeBytes)}` : ""}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {renderMenu?.(current)}
          <a
            href={`/api/files/${current.id}/stream`}
            download={current.name}
            target="_blank"
            rel="noopener noreferrer"
            className="grid size-9 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            aria-label="Download"
            title="Download"
          >
            <Download className="h-4 w-4" />
          </a>
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div
        className="relative flex flex-1 items-center justify-center px-4 pb-6"
        onClick={(e) => e.stopPropagation()}
      >
        {images.length > 1 && (
          <button
            type="button"
            onClick={() =>
              onIndex((index - 1 + images.length) % images.length)
            }
            className="absolute left-4 grid size-10 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            aria-label="Previous"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/files/${current.id}/stream`}
          alt={current.name}
          className="max-h-full max-w-full rounded-lg object-contain"
        />
        {images.length > 1 && (
          <button
            type="button"
            onClick={() => onIndex((index + 1) % images.length)}
            className="absolute right-4 grid size-10 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            aria-label="Next"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
}
