type UploadStatus = "queued" | "uploading" | "completing" | "done" | "error";

export type UploadItem = {
  id: string;
  file: File;
  projectId: string;
  folderId: string | null;
  status: UploadStatus;
  progress: number; // 0-100
  error?: string;
  attachmentId?: string;
  r2Key?: string;
};

type Listener = () => void;

const CONCURRENT_UPLOADS = 5;
const MAX_CONCURRENT_PARTS = 4;
const PART_SIZE = 10 * 1024 * 1024; // 10 MB — must match server PART_SIZE
const MULTIPART_THRESHOLD = 20 * 1024 * 1024; // 20 MB

class UploadManager {
  private queue: UploadItem[] = [];
  private listeners: Set<Listener> = new Set();
  private activeCount = 0;
  private snapshot: UploadItem[] = [];

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.snapshot = [...this.queue];
    this.listeners.forEach((fn) => fn());
    this.updateBeforeUnload();
  }

  getItems(): UploadItem[] {
    return this.snapshot;
  }

  getActiveCount(): number {
    return this.queue.filter((i) => i.status === "uploading" || i.status === "completing").length;
  }

  getPendingCount(): number {
    return this.queue.filter((i) => i.status === "queued").length;
  }

  getDoneCount(): number {
    return this.queue.filter((i) => i.status === "done").length;
  }

  getTotalCount(): number {
    return this.queue.length;
  }

  hasActive(): boolean {
    return this.queue.some((i) => i.status === "queued" || i.status === "uploading" || i.status === "completing");
  }

  clearCompleted() {
    this.queue = this.queue.filter((i) => i.status !== "done" && i.status !== "error");
    this.notify();
  }

  enqueue(files: File[], projectId: string, folderId: string | null) {
    const SKIP_FILES = [".ds_store", "thumbs.db", ".gitkeep", "desktop.ini"];
    for (const file of files) {
      if (SKIP_FILES.includes(file.name.toLowerCase())) continue;
      if (file.size === 0) continue;
      const item: UploadItem = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        projectId,
        folderId,
        status: "queued",
        progress: 0,
      };
      this.queue.push(item);
    }
    this.notify();
    this.processQueue();
  }

  retry(itemId: string) {
    const item = this.queue.find((i) => i.id === itemId);
    if (!item || item.status !== "error") return;
    item.status = "queued";
    item.progress = 0;
    item.error = undefined;
    this.notify();
    this.processQueue();
  }

  retryAll() {
    for (const item of this.queue) {
      if (item.status === "error") {
        item.status = "queued";
        item.progress = 0;
        item.error = undefined;
      }
    }
    this.notify();
    this.processQueue();
  }

  // --- beforeunload guard ---
  private onBeforeUnload = (e: BeforeUnloadEvent) => {
    e.preventDefault();
  };

  private updateBeforeUnload() {
    if (typeof window === "undefined") return;
    if (this.hasActive()) {
      window.addEventListener("beforeunload", this.onBeforeUnload);
    } else {
      window.removeEventListener("beforeunload", this.onBeforeUnload);
    }
  }

  // --- Queue processing ---

  private async processQueue() {
    while (this.activeCount < CONCURRENT_UPLOADS) {
      const next = this.queue.find((i) => i.status === "queued");
      if (!next) break;
      this.activeCount++;
      next.status = "uploading";
      next.progress = 0;
      this.notify();
      this.uploadItem(next).finally(() => {
        this.activeCount--;
        this.processQueue();
      });
    }
  }

  // --- Single-part direct upload via presigned URL ---

  private uploadSingleDirect(item: UploadItem, presignedUrl: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", presignedUrl);
      xhr.setRequestHeader("Content-Type", item.file.type || "application/octet-stream");

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          item.progress = 5 + Math.round((e.loaded / e.total) * 85);
          this.notify();
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const etag = xhr.getResponseHeader("ETag") || '"single"';
          fetch(`/api/files/${item.attachmentId}/parts/1`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ etag }),
          }).catch(() => {});
          resolve();
        } else {
          reject(new Error(`Upload failed: ${xhr.status}`));
        }
      };

      xhr.onerror = () => reject(new Error("Network error during upload"));
      xhr.send(item.file);
    });
  }

  // --- Multipart direct upload with concurrency & resumability ---

  private async uploadMultipartDirect(
    item: UploadItem,
    parts: { number: number; url: string }[],
    skipParts: Set<number>
  ): Promise<void> {
    const partsToUpload = parts.filter((p) => !skipParts.has(p.number));
    const totalParts = parts.length;
    let completedParts = skipParts.size;

    const queue = [...partsToUpload];
    const active = new Set<Promise<void>>();

    const uploadPart = async (part: { number: number; url: string }): Promise<void> => {
      const start = (part.number - 1) * PART_SIZE;
      const end = Math.min(part.number * PART_SIZE, item.file.size);
      const blob = item.file.slice(start, end);

      return new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", part.url);
        xhr.setRequestHeader("Content-Type", item.file.type || "application/octet-stream");

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const partFraction = e.loaded / e.total;
            const overallProgress = (completedParts + partFraction) / totalParts;
            item.progress = 5 + Math.round(overallProgress * 85);
            this.notify();
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const etag = xhr.getResponseHeader("ETag") || `"part-${part.number}"`;
            fetch(`/api/files/${item.attachmentId}/parts/${part.number}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ etag }),
            }).catch(() => {});
            completedParts++;
            item.progress = 5 + Math.round((completedParts / totalParts) * 85);
            this.notify();
            resolve();
          } else {
            reject(new Error(`Part ${part.number} failed: ${xhr.status}`));
          }
        };

        xhr.onerror = () => reject(new Error(`Part ${part.number}: network error`));
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

  // --- Main upload orchestrator ---

  private async uploadItem(item: UploadItem) {
    try {
      const isResume = !!item.attachmentId;
      let attachmentId = item.attachmentId;
      let r2Key = item.r2Key;
      let uploadUrl: string | null = null;
      let parts: { number: number; url: string }[] = [];
      let skipParts = new Set<number>();

      if (isResume && attachmentId) {
        // Resuming a failed upload — check which parts are done
        const statusRes = await fetch(`/api/files/${attachmentId}/status`);
        if (!statusRes.ok) throw new Error("Failed to fetch upload status");
        const statusData = await statusRes.json();
        const uploadedPartNumbers: number[] = statusData.uploadedPartNumbers || [];
        skipParts = new Set(uploadedPartNumbers);

        if (statusData.status === "uploaded") {
          item.progress = 100;
          item.status = "done";
          this.notify();
          return;
        }

        const totalParts = statusData.totalParts || 1;

        if (totalParts > 1 && statusData.uploadId) {
          // Multipart resume: get fresh presigned URLs for remaining parts
          const allPartNumbers = Array.from({ length: totalParts }, (_, i) => i + 1);
          const remainingParts = allPartNumbers.filter((n) => !skipParts.has(n));

          if (remainingParts.length === 0) {
            // All parts uploaded, just complete
            item.progress = 90;
            item.status = "completing";
            this.notify();
            await fetch(`/api/files/${attachmentId}/complete`, { method: "POST" });
            await this.createAssetRecord(item);
            item.progress = 100;
            item.status = "done";
            this.notify();
            return;
          }

          const resumeRes = await fetch(`/api/files/${attachmentId}/resume`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ partNumbers: remainingParts }),
          });
          if (!resumeRes.ok) throw new Error("Failed to get resume URLs");
          const resumeData = await resumeRes.json();
          parts = resumeData.parts;
        } else {
          // Single-part resume — re-upload the whole file with fresh presigned URL
          // (can't partially resume a single PUT)
          skipParts.clear();
          const createRes = await fetch("/api/files", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: item.file.name,
              sizeBytes: item.file.size,
              contentType: item.file.type || "application/octet-stream",
              entityType: "project_asset",
              entityId: item.projectId,
            }),
          });
          if (!createRes.ok) throw new Error("Failed to re-create upload");
          const data = await createRes.json();
          attachmentId = data.id;
          r2Key = data.r2Key;
          item.attachmentId = attachmentId;
          item.r2Key = r2Key;
          uploadUrl = data.uploadUrl;
          parts = data.parts || [];
        }
      } else {
        // Fresh upload
        const contentType = item.file.type || "application/octet-stream";
        const createRes = await fetch("/api/files", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: item.file.name,
            sizeBytes: item.file.size,
            contentType,
            entityType: "project_asset",
            entityId: item.projectId,
          }),
        });

        if (!createRes.ok) {
          const err = await createRes.json().catch(() => ({}));
          throw new Error(err.error || "Failed to create upload");
        }

        const data = await createRes.json();
        attachmentId = data.id;
        r2Key = data.r2Key;
        item.attachmentId = attachmentId;
        item.r2Key = r2Key;
        uploadUrl = data.uploadUrl;
        parts = data.parts || [];
      }

      item.progress = 5;
      this.notify();

      // Upload bytes directly to R2, with proxy fallback if CORS blocks
      if (uploadUrl) {
        try {
          await this.uploadSingleDirect(item, uploadUrl);
        } catch {
          await this.uploadViaProxy(item);
        }
      } else if (parts.length > 0) {
        await this.uploadMultipartDirect(item, parts, skipParts);
      } else {
        throw new Error("No upload URL or parts received from server");
      }

      item.progress = 90;
      item.status = "completing";
      this.notify();

      // Finalize
      await fetch(`/api/files/${attachmentId}/complete`, { method: "POST" });
      await this.createAssetRecord(item);

      item.progress = 100;
      item.status = "done";
      this.notify();
    } catch (err) {
      item.status = "error";
      item.error = err instanceof Error ? err.message : "Upload failed";
      this.notify();
    }
  }

  private uploadViaProxy(item: UploadItem): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", `/api/files/${item.attachmentId}/upload`);
      xhr.setRequestHeader("Content-Type", item.file.type || "application/octet-stream");

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          item.progress = 5 + Math.round((e.loaded / e.total) * 85);
          this.notify();
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`Proxy upload failed: ${xhr.status}`));
      };

      xhr.onerror = () => reject(new Error("Network error during proxy upload"));
      xhr.send(item.file);
    });
  }

  private async createAssetRecord(item: UploadItem) {
    const { createAsset } = await import("@/actions/assets");
    await createAsset({
      projectId: item.projectId,
      folderId: item.folderId,
      name: item.file.name,
      fileSize: item.file.size,
      contentType: item.file.type,
      r2Key: item.r2Key || `project_asset/${item.attachmentId}`,
    });
  }
}

export const uploadManager = new UploadManager();
