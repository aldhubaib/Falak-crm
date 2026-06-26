type UploadStatus = "queued" | "uploading" | "completing" | "done" | "error";

export type UploadItem = {
  id: string;
  file: File;
  projectId: string;
  folderId: string | null;
  status: UploadStatus;
  progress: number; // 0-100
  error?: string;
};

type Listener = () => void;

const CONCURRENT_UPLOADS = 3;

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

  private async uploadItem(item: UploadItem) {
    try {
      // 1. Create attachment record and get upload URL
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
      item.progress = 10;
      this.notify();

      // 2. Upload file via XHR for progress tracking
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", `/api/files/${data.id}/upload`);
        xhr.setRequestHeader("Content-Type", contentType);

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            item.progress = 10 + Math.round((e.loaded / e.total) * 80);
            this.notify();
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Upload failed: ${xhr.status}`));
        };

        xhr.onerror = () => reject(new Error("Network error"));
        xhr.send(item.file);
      });

      item.progress = 90;
      item.status = "completing";
      this.notify();

      // 3. Mark upload complete
      await fetch(`/api/files/${data.id}/complete`, { method: "POST" });

      // 4. Create asset record in DB
      const { createAsset } = await import("@/actions/assets");
      await createAsset({
        projectId: item.projectId,
        folderId: item.folderId,
        name: item.file.name,
        fileSize: item.file.size,
        contentType: item.file.type,
        r2Key: data.r2Key || `project_asset/${data.id}`,
      });

      item.progress = 100;
      item.status = "done";
      this.notify();
    } catch (err) {
      item.status = "error";
      item.error = err instanceof Error ? err.message : "Upload failed";
      this.notify();
    }
  }
}

export const uploadManager = new UploadManager();
