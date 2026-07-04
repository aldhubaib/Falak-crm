import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// A project is "archived" for messaging when its status is anything but
// Active (per workspace defaults: On Hold, Completed, Cancelled). Projects
// without a status stay live.
export function isArchivedStatus(statusName: string | null | undefined): boolean {
  return Boolean(statusName) && statusName!.trim().toLowerCase() !== "active";
}
