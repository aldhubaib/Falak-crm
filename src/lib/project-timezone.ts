import { DEFAULT_PROJECT_TIMEZONE } from "@/lib/timezone";

// The unified calendar runs on ONE timezone for the whole workspace — weeks,
// due dates and schedules mean the same thing in every project. The old
// per-project timezone setting is gone.
export function getWorkspaceTimezone(): string {
  return DEFAULT_PROJECT_TIMEZONE;
}

export { DEFAULT_PROJECT_TIMEZONE };
