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
  /** True = visible even when the card is collapsed (field set to "always"). */
  always: boolean;
};

/** A filled-in delivery text field (e.g. "Mention", "Caption"). */
export type DeliveryText = {
  /** The delivery field name. */
  label: string;
  /** The text the creator entered. */
  value: string;
  /** True = visible even when the card is collapsed (field set to "always"). */
  always: boolean;
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
  /** Delivery text fields (mention, caption, …) available to copy. */
  texts: DeliveryText[];
};

// Yes/No field kinds store "yes" | "no" | JSON {v,t} in textValue (see
// dynamic-field.tsx). On the publish card only a "yes" WITH follow-up text is
// worth showing — a bare yes/no toggle has nothing to copy.
const YESNO_KINDS = new Set(["yes_no", "mention", "copyright", "checkbox"]);

/** The publishable text of a checklist field, or null when there's nothing to show. */
export function publishTextValue(type: string, raw: string | null): string | null {
  const value = raw?.trim();
  if (!value) return null;
  if (YESNO_KINDS.has(type)) {
    if (value === "yes" || value === "no") return null;
    try {
      const o = JSON.parse(value) as { v?: string; t?: string };
      return o?.v === "yes" && o.t?.trim() ? o.t.trim() : null;
    } catch {
      // Legacy plain text — treat as a "yes" with text.
      return value;
    }
  }
  return value;
}

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
