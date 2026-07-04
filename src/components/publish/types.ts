// Publish (Delivery Queue) view models. Shapes mirror the Lovable design but are
// populated from real Prisma data (publishItem + task) in the server page.

export type Project = {
  id: string;
  name: string;
  /** Attachment id of the project photo, if any (resolved to a URL client-side). */
  thumbnailId?: string | null;
};

/** A downloadable delivery file attached to a task. */
export type DeliveryAttachment = {
  /** Attachment (file) id — used to build the download URL. */
  attachmentId: string;
  /** Human label (the delivery field name, e.g. "Final Short Video"). */
  label: string;
  /** True for image files, so the row can show an image icon. */
  isImage: boolean;
};

export type Item = {
  /** Stable identity = task id. */
  id: string;
  taskId: string;
  /** Present only when the task has a publishItem (scheduled or published). */
  publishItemId?: string;
  title: string;
  projectId: string;
  project: Project;
  handle: string;
  deliveredOn: string; // ISO date (YYYY-MM-DD)
  publishOn?: string; // ISO date — undefined when unscheduled
  status: "scheduled" | "published" | "queued";
  /** Delivery files available to download. */
  attachments: DeliveryAttachment[];
};

const IMAGE_EXTS = ["jpg", "jpeg", "png", "gif", "webp", "heic", "heif", "svg", "bmp", "tiff"];

// Best-effort image detection from a checklist item's allowedFormats JSON.
export function attachmentIsImage(allowedFormats: string | null): boolean {
  if (!allowedFormats) return false;
  try {
    const arr = JSON.parse(allowedFormats) as unknown;
    if (!Array.isArray(arr)) return false;
    return arr.some((f) =>
      IMAGE_EXTS.includes(String(f).replace(/^\./, "").toLowerCase()),
    );
  } catch {
    return false;
  }
}

export type View = "month" | "week" | "schedule" | "queue";

export const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

export const toISODate = (d: Date) =>
  iso(d.getFullYear(), d.getMonth() + 1, d.getDate());
