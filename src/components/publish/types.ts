// Publish (Delivery Queue) view models. Shapes mirror the Lovable design but are
// populated from real Prisma data (publishItem + task) in the server page.

export type Project = {
  id: string;
  name: string;
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
};

export type View = "month" | "week" | "schedule" | "queue";

export const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

export const toISODate = (d: Date) =>
  iso(d.getFullYear(), d.getMonth() + 1, d.getDate());
