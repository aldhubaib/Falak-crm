type UploadStatus = "queued" | "uploading" | "completing" | "done" | "error";

export type UploadTarget =
  | { kind: "project_asset"; projectId: string; folderId: string | null }
  | { kind: "checklist_item"; checklistItemId: string; projectId: string }
  | { kind: "message_attachment" };

export type UploadItem = {
  id: string;
  file: File;
  target: UploadTarget;
  label?: string;
  status: UploadStatus;
  progress: number; // 0-100
  error?: string;
  attachmentId?: string;
  r2Key?: string;
};

type Listener = () => void;

// Thrown internally when a user stops an in-flight upload so it can be
// distinguished from a genuine failure (no error state, no retry).
class UploadCancelledError extends Error {
  constructor() {
    super("Upload cancelled");
    this.name = "UploadCancelledError";
  }
}

const CONCURRENT_UPLOADS = 5;
const MAX_CONCURRENT_PARTS = 4;
const PART_SIZE = 10 * 1024 * 1024; // 10 MB — must match server PART_SIZE
const MULTIPART_THRESHOLD = 20 * 1024 * 1024; // 20 MB

class UploadManager {
  private queue: UploadItem[] = [];
  private listeners: Set<Listener> = new Set();
  private activeCount = 0;
  private snapshot: UploadItem[] = [];
  // In-flight XHRs per upload item, so a stop request can abort them.
  private controllers = new Map<string, Set<XMLHttpRequest>>();
  // Items the user has stopped — checked throughout the pipeline to bail out.
  private cancelledIds = new Set<string>();

  private isCancelled(itemId: string): boolean {
    return this.cancelledIds.has(itemId);
  }

  private track(itemId: string, xhr: XMLHttpRequest) {
    let set = this.controllers.get(itemId);
    if (!set) {
      set = new Set();
      this.controllers.set(itemId, set);
    }
    set.add(xhr);
  }

  private untrack(itemId: string, xhr: XMLHttpRequest) {
    this.controllers.get(itemId)?.delete(xhr);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.snapshot = this.queue.map((item) => ({ ...item }));
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
        target: { kind: "project_asset", projectId, folderId },
        status: "queued",
        progress: 0,
      };
      this.queue.push(item);
    }
    this.notify();
    this.processQueue();
  }

  // Enqueue a single file to be attached to a task checklist item. Returns the
  // upload item id (or null if the file was skipped), so the caller can track it.
  enqueueChecklist(
    file: File,
    opts: { checklistItemId: string; projectId: string; label?: string }
  ): string | null {
    if (file.size === 0) return null;
    // A checklist field holds one file — drop any prior finished/failed upload
    // for the same item so the indicator and inline UI don't show stale entries.
    this.queue = this.queue.filter(
      (i) =>
        !(
          i.target.kind === "checklist_item" &&
          i.target.checklistItemId === opts.checklistItemId &&
          (i.status === "done" || i.status === "error")
        )
    );
    const item: UploadItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      target: { kind: "checklist_item", checklistItemId: opts.checklistItemId, projectId: opts.projectId },
      label: opts.label,
      status: "queued",
      progress: 0,
    };
    this.queue.push(item);
    this.notify();
    this.processQueue();
    return item.id;
  }

  // Most recent upload item for a given checklist item (for inline field UI).
  getItemForChecklist(checklistItemId: string): UploadItem | undefined {
    let match: UploadItem | undefined;
    for (const i of this.snapshot) {
      if (i.target.kind === "checklist_item" && i.target.checklistItemId === checklistItemId) {
        match = i;
      }
    }
    return match;
  }

  enqueueMessage(files: File[]): string[] {
    const ids: string[] = [];
    for (const file of files) {
      if (file.size === 0) continue;
      const item: UploadItem = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        target: { kind: "message_attachment" },
        label: file.name,
        status: "queued",
        progress: 0,
      };
      this.queue.push(item);
      ids.push(item.id);
    }
    this.notify();
    this.processQueue();
    return ids;
  }

  getItemById(id: string): UploadItem | undefined {
    return this.snapshot.find((i) => i.id === id);
  }

  removeItems(ids: string[]) {
    const set = new Set(ids);
    this.queue = this.queue.filter((i) => !set.has(i.id));
    this.notify();
  }

  // Stop an upload (queued or in-flight): abort any active requests, best-effort
  // clean up the partial object server-side, and drop it from the list.
  cancel(itemId: string) {
    const item = this.queue.find((i) => i.id === itemId);
    if (!item) return;

    this.cancelledIds.add(itemId);

    const xhrs = this.controllers.get(itemId);
    if (xhrs) {
      for (const xhr of xhrs) {
        try {
          xhr.abort();
        } catch {
          // ignore
        }
      }
    }
    this.controllers.delete(itemId);

    // Free the partial multipart upload / stored object on the server.
    if (item.attachmentId) {
      fetch(`/api/files/${item.attachmentId}/abort`, { method: "POST" }).catch(
        () => {},
      );
    }

    this.queue = this.queue.filter((i) => i.id !== itemId);
    this.notify();
  }

  // Stop every queued / in-flight upload at once.
  cancelAll() {
    const activeIds = this.queue
      .filter(
        (i) =>
          i.status === "queued" ||
          i.status === "uploading" ||
          i.status === "completing",
      )
      .map((i) => i.id);
    for (const id of activeIds) this.cancel(id);
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

  // Durably register a finished part's ETag with the server, retrying on
  // failure. A dropped registration would cause the final assembly to omit the
  // part and produce a corrupt, truncated file — so this MUST succeed before we
  // consider the part done.
  private async registerPart(
    attachmentId: string,
    partNumber: number,
    etag: string,
    itemId: string
  ): Promise<void> {
    let lastErr: unknown;
    for (let attempt = 0; attempt < 4; attempt++) {
      if (this.isCancelled(itemId)) throw new UploadCancelledError();
      try {
        const res = await fetch(`/api/files/${attachmentId}/parts/${partNumber}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ etag }),
        });
        if (!res.ok) throw new Error(`Register part ${partNumber} failed: ${res.status}`);
        return;
      } catch (e) {
        lastErr = e;
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }
    }
    throw lastErr;
  }

  // --- Single-part direct upload via presigned URL ---

  private uploadSingleDirect(item: UploadItem, presignedUrl: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      this.track(item.id, xhr);
      const done = () => this.untrack(item.id, xhr);
      xhr.open("PUT", presignedUrl);
      xhr.setRequestHeader("Content-Type", item.file.type || "application/octet-stream");

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          item.progress = 5 + Math.round((e.loaded / e.total) * 85);
          this.notify();
        }
      };

      xhr.onload = () => {
        done();
        if (xhr.status >= 200 && xhr.status < 300) {
          const etag = xhr.getResponseHeader("ETag") || '"single"';
          this.registerPart(item.attachmentId!, 1, etag, item.id).then(resolve).catch(reject);
        } else {
          reject(new Error(`Upload failed: ${xhr.status}`));
        }
      };

      xhr.onabort = () => {
        done();
        reject(new UploadCancelledError());
      };
      xhr.onerror = () => {
        done();
        reject(new Error("Network error during upload"));
      };
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

    const attemptPart = (part: { number: number; url: string }): Promise<void> => {
      const start = (part.number - 1) * PART_SIZE;
      const end = Math.min(part.number * PART_SIZE, item.file.size);
      const blob = item.file.slice(start, end);

      return new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        this.track(item.id, xhr);
        const done = () => this.untrack(item.id, xhr);
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
          done();
          if (xhr.status >= 200 && xhr.status < 300) {
            const etag = xhr.getResponseHeader("ETag") || `"part-${part.number}"`;
            // Only count the part as done once its ETag is durably registered.
            this.registerPart(item.attachmentId!, part.number, etag, item.id)
              .then(() => {
                completedParts++;
                item.progress = 5 + Math.round((completedParts / totalParts) * 85);
                this.notify();
                resolve();
              })
              .catch(reject);
          } else {
            reject(new Error(`Part ${part.number} failed: ${xhr.status}`));
          }
        };

        xhr.onabort = () => {
          done();
          reject(new UploadCancelledError());
        };
        xhr.onerror = () => {
          done();
          reject(new Error(`Part ${part.number}: network error`));
        };
        xhr.send(blob);
      });
    };

    const uploadPart = async (part: { number: number; url: string }): Promise<void> => {
      let lastErr: unknown;
      for (let attempt = 0; attempt < 3; attempt++) {
        // Stop cleanly if the user cancelled — don't retry an aborted part.
        if (this.isCancelled(item.id)) return;
        try {
          await attemptPart(part);
          return;
        } catch (e) {
          if (this.isCancelled(item.id) || e instanceof UploadCancelledError) return;
          lastErr = e;
          await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        }
      }
      throw lastErr;
    };

    while (queue.length > 0 || active.size > 0) {
      if (this.isCancelled(item.id)) {
        queue.length = 0;
        if (active.size > 0) await Promise.allSettled(active);
        throw new UploadCancelledError();
      }
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
      const entityType = item.target.kind;
      const entityId =
        item.target.kind === "checklist_item"
          ? item.target.checklistItemId
          : item.target.kind === "project_asset"
            ? item.target.projectId
            : "pending";
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
            const completeRes = await fetch(`/api/files/${attachmentId}/complete`, { method: "POST" });
            if (!completeRes.ok) {
              const err = await completeRes.json().catch(() => ({}));
              throw new Error(err.error || `Failed to finalize upload: ${completeRes.status}`);
            }
            await this.finalizeTarget(item);
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
              entityType,
              entityId,
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
            entityType,
            entityId,
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

      if (this.isCancelled(item.id)) throw new UploadCancelledError();

      // Upload bytes directly to R2, with proxy fallback if CORS blocks
      if (uploadUrl) {
        try {
          await this.uploadSingleDirect(item, uploadUrl);
        } catch (e) {
          if (this.isCancelled(item.id) || e instanceof UploadCancelledError) throw e;
          await this.uploadViaProxy(item);
        }
      } else if (parts.length > 0) {
        try {
          await this.uploadMultipartDirect(item, parts, skipParts);
        } catch (e) {
          if (this.isCancelled(item.id) || e instanceof UploadCancelledError) throw e;
          await this.uploadViaProxy(item);
        }
      } else {
        throw new Error("No upload URL or parts received from server");
      }

      if (this.isCancelled(item.id)) throw new UploadCancelledError();

      item.progress = 90;
      item.status = "completing";
      this.notify();

      // Finalize — a non-OK response means the server refused to assemble the
      // file (e.g. a missing part). Surface it as an error so the upload can be
      // retried/resumed instead of silently binding a corrupt object.
      const completeRes = await fetch(`/api/files/${attachmentId}/complete`, { method: "POST" });
      if (!completeRes.ok) {
        const err = await completeRes.json().catch(() => ({}));
        throw new Error(err.error || `Failed to finalize upload: ${completeRes.status}`);
      }
      await this.finalizeTarget(item);

      item.progress = 100;
      item.status = "done";
      this.notify();
    } catch (err) {
      // A stopped upload was already removed from the queue in cancel() — don't
      // resurrect it as an error entry.
      if (err instanceof UploadCancelledError || this.isCancelled(item.id)) {
        return;
      }
      item.status = "error";
      item.error = err instanceof Error ? err.message : "Upload failed";
      this.notify();
    } finally {
      this.controllers.delete(item.id);
      this.cancelledIds.delete(item.id);
    }
  }

  private uploadViaProxy(item: UploadItem): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      this.track(item.id, xhr);
      const done = () => this.untrack(item.id, xhr);
      xhr.open("PUT", `/api/files/${item.attachmentId}/upload`);
      xhr.setRequestHeader("Content-Type", item.file.type || "application/octet-stream");

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          item.progress = 5 + Math.round((e.loaded / e.total) * 85);
          this.notify();
        }
      };

      xhr.onload = () => {
        done();
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`Proxy upload failed: ${xhr.status}`));
      };

      xhr.onabort = () => {
        done();
        reject(new UploadCancelledError());
      };
      xhr.onerror = () => {
        done();
        reject(new Error("Network error during proxy upload"));
      };
      xhr.send(item.file);
    });
  }

  // Bind the finished upload to its target entity in the database.
  private async finalizeTarget(item: UploadItem) {
    if (item.target.kind === "message_attachment") {
      return;
    }
    if (item.target.kind === "checklist_item") {
      if (!item.attachmentId) throw new Error("Missing attachment id");
      const { setChecklistItemAttachment } = await import("@/actions/projects");
      await setChecklistItemAttachment(
        item.target.checklistItemId,
        item.attachmentId,
        item.target.projectId
      );
      return;
    }
    const { createAsset } = await import("@/actions/assets");
    await createAsset({
      projectId: item.target.projectId,
      folderId: item.target.folderId,
      name: item.file.name,
      fileSize: item.file.size,
      contentType: item.file.type,
      r2Key: item.r2Key || `project_asset/${item.attachmentId}`,
    });
  }
}

export const uploadManager = new UploadManager();
