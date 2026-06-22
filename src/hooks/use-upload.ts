"use client";

import { useState, useCallback, useRef } from "react";

export type UploadStatus = "queued" | "initiating" | "uploading" | "complete" | "error" | "cancelled";

export type UploadEntry = {
  id: string;
  file: File;
  name: string;
  size: number;
  contentType: string;
  status: UploadStatus;
  progress: number;
  attachmentId: string | null;
  error: string | null;
};

type UploadOptions = {
  entityType: string;
  entityId: string;
  onComplete?: (entry: UploadEntry) => void;
  onError?: (entry: UploadEntry) => void;
};

const MAX_CONCURRENT_FILES = 3;
const MAX_CONCURRENT_PARTS = 4;

export function useUpload(options: UploadOptions) {
  const [uploads, setUploads] = useState<Map<string, UploadEntry>>(new Map());
  const uploadsRef = useRef(uploads);
  uploadsRef.current = uploads;

  const activeStartsRef = useRef(0);
  const queueRef = useRef<UploadEntry[]>([]);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const updateEntry = useCallback((id: string, patch: Partial<UploadEntry>) => {
    setUploads((prev) => {
      const next = new Map(prev);
      const entry = next.get(id);
      if (entry) next.set(id, { ...entry, ...patch });
      return next;
    });
  }, []);

  const removeEntry = useCallback((id: string) => {
    setUploads((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const pump = useCallback(() => {
    while (activeStartsRef.current < MAX_CONCURRENT_FILES && queueRef.current.length > 0) {
      const entry = queueRef.current.shift()!;
      activeStartsRef.current++;
      startUpload(entry).finally(() => {
        activeStartsRef.current--;
        pump();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function uploadSingle(entry: UploadEntry, url: string) {
    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", url);
      xhr.setRequestHeader("Content-Type", entry.contentType);

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          updateEntry(entry.id, { progress: Math.round((e.loaded / e.total) * 100) });
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const etag = xhr.getResponseHeader("ETag") || '"single"';
          fetch(`/api/files/${entry.attachmentId}/parts/1`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ etag }),
          }).catch(() => {});
          resolve();
        } else {
          reject(new Error(`Upload failed: ${xhr.status}`));
        }
      });

      xhr.addEventListener("error", () => reject(new Error("Network error")));
      xhr.addEventListener("abort", () => reject(new Error("Aborted")));
      xhr.send(entry.file);
    });
  }

  async function uploadMultipart(
    entry: UploadEntry,
    parts: { number: number; url: string }[]
  ) {
    const queue = [...parts];
    const active = new Set<Promise<void>>();
    let completed = 0;
    const partSize = 10 * 1024 * 1024;

    const uploadPart = async (part: { number: number; url: string }) => {
      const start = (part.number - 1) * partSize;
      const end = Math.min(part.number * partSize, entry.size);
      const blob = entry.file.slice(start, end);

      return new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", part.url);
        xhr.setRequestHeader("Content-Type", entry.contentType);

        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            const partProgress = e.loaded / e.total;
            const totalDone = completed + partProgress;
            updateEntry(entry.id, {
              progress: Math.round((totalDone / parts.length) * 100),
            });
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const etag = xhr.getResponseHeader("ETag") || `"part-${part.number}"`;
            fetch(`/api/files/${entry.attachmentId}/parts/${part.number}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ etag }),
            }).catch(() => {});
            completed++;
            resolve();
          } else {
            reject(new Error(`Part ${part.number} failed: ${xhr.status}`));
          }
        });

        xhr.addEventListener("error", () => reject(new Error(`Part ${part.number} network error`)));
        xhr.send(blob);
      });
    };

    while (queue.length > 0 || active.size > 0) {
      while (queue.length > 0 && active.size < MAX_CONCURRENT_PARTS) {
        const part = queue.shift()!;
        const p = uploadPart(part).finally(() => active.delete(p));
        active.add(p);
      }
      if (active.size > 0) await Promise.race(active);
    }
  }

  async function completeUpload(entry: UploadEntry) {
    const resp = await fetch(`/api/files/${entry.attachmentId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!resp.ok) throw new Error(`Complete failed: ${resp.status}`);

    updateEntry(entry.id, { status: "complete", progress: 100 });
    optionsRef.current.onComplete?.({ ...entry, status: "complete", progress: 100 });

    setTimeout(() => removeEntry(entry.id), 2000);
  }

  async function startUpload(entry: UploadEntry) {
    updateEntry(entry.id, { status: "initiating" });

    try {
      const resp = await fetch("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: entry.name,
          sizeBytes: entry.size,
          contentType: entry.contentType,
          entityType: optionsRef.current.entityType,
          entityId: optionsRef.current.entityId,
        }),
      });
      if (!resp.ok) throw new Error(`Init failed: ${resp.status}`);
      const data = await resp.json();

      entry.attachmentId = data.id;
      updateEntry(entry.id, { attachmentId: data.id, status: "uploading" });

      if (data.uploadUrl) {
        await uploadSingle(entry, data.uploadUrl);
      } else {
        await uploadMultipart(entry, data.parts);
      }

      await completeUpload(entry);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      updateEntry(entry.id, { status: "error", error: msg });
      optionsRef.current.onError?.({ ...entry, status: "error", error: msg });
    }
  }

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const newEntries: UploadEntry[] = [];

      for (const file of Array.from(files)) {
        const entry: UploadEntry = {
          id: crypto.randomUUID(),
          file,
          name: file.name,
          size: file.size,
          contentType: file.type || "application/octet-stream",
          status: "queued",
          progress: 0,
          attachmentId: null,
          error: null,
        };
        newEntries.push(entry);
      }

      setUploads((prev) => {
        const next = new Map(prev);
        for (const e of newEntries) next.set(e.id, e);
        return next;
      });

      for (const e of newEntries) {
        queueRef.current.push(e);
      }
      pump();
    },
    [pump]
  );

  const cancelUpload = useCallback(
    (id: string) => {
      const entry = uploadsRef.current.get(id);
      if (entry?.attachmentId) {
        fetch(`/api/files/${entry.attachmentId}/abort`, { method: "POST" }).catch(() => {});
      }
      removeEntry(id);
    },
    [removeEntry]
  );

  const retryUpload = useCallback(
    (id: string) => {
      const entry = uploadsRef.current.get(id);
      if (!entry) return;
      if (entry.attachmentId) {
        fetch(`/api/files/${entry.attachmentId}/abort`, { method: "POST" }).catch(() => {});
      }
      const fresh: UploadEntry = {
        ...entry,
        attachmentId: null,
        progress: 0,
        error: null,
        status: "queued",
      };
      setUploads((prev) => {
        const next = new Map(prev);
        next.set(id, fresh);
        return next;
      });
      queueRef.current.push(fresh);
      pump();
    },
    [pump]
  );

  return {
    uploads: Array.from(uploads.values()),
    addFiles,
    cancelUpload,
    retryUpload,
    isUploading: Array.from(uploads.values()).some(
      (u) => u.status === "uploading" || u.status === "initiating" || u.status === "queued"
    ),
  };
}
