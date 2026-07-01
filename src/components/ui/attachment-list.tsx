"use client";

import { useState } from "react";
import { FileIcon, Download, Trash2, ExternalLink } from "lucide-react";
import { deleteAttachment, type AttachmentInfo } from "@/actions/attachments";
import { useErrorStore } from "@/lib/error-store";

type AttachmentListProps = {
  attachments: AttachmentInfo[];
  canDelete?: boolean;
  revalidatePath?: string;
};

export function AttachmentList({
  attachments: initial,
  canDelete = true,
  revalidatePath: revalidate,
}: AttachmentListProps) {
  const [attachments, setAttachments] = useState(initial);
  const [downloading, setDownloading] = useState<string | null>(null);

  async function handleDownload(id: string, name: string) {
    setDownloading(id);
    try {
      const resp = await fetch(`/api/files/${id}/download-url`);
      if (!resp.ok) throw new Error("Failed to get download URL");
      const data = await resp.json();
      const link = document.createElement("a");
      link.href = data.url;
      link.download = name;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.click();
    } catch {
      useErrorStore.getState().push({
        id: crypto.randomUUID(),
        message: "Failed to download file",
        code: "DOWNLOAD_ERROR",
        severity: "error",
        timestamp: new Date().toISOString(),
        url: window.location.href,
        action: "Download",
      });
    } finally {
      setDownloading(null);
    }
  }

  async function handleDelete(id: string) {
    const result = await deleteAttachment(id, revalidate);
    if (result.ok) {
      setAttachments((prev) => prev.filter((a) => a.id !== id));
    } else {
      useErrorStore.getState().push(result.error);
    }
  }

  if (attachments.length === 0) return null;

  return (
    <div className="space-y-1.5">
      {attachments.map((att) => (
        <div
          key={att.id}
          className="flex items-center gap-3 rounded-lg bg-muted/50 p-2.5 group"
        >
          <div className="w-8 h-8 rounded-lg bg-card flex items-center justify-center shrink-0">
            <FileIcon className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-secondary text-foreground truncate">{att.name}</p>
            <p className="text-label text-muted-foreground">
              {att.sizeBytes ? formatBytes(att.sizeBytes) : "—"} •{" "}
              {new Date(att.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0 opacity-100 [@media(pointer:fine)]:opacity-0 [@media(pointer:fine)]:group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => handleDownload(att.id, att.name)}
              disabled={downloading === att.id}
              className="w-icon-btn h-icon-btn rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
              title="Download"
            >
              {downloading === att.id ? (
                <ExternalLink className="w-icon-sm h-icon-sm animate-pulse" />
              ) : (
                <Download className="w-icon-sm h-icon-sm" />
              )}
            </button>
            {canDelete && (
              <button
                onClick={() => handleDelete(att.id)}
                className="w-icon-btn h-icon-btn rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                title="Delete"
              >
                <Trash2 className="w-icon-sm h-icon-sm" />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
