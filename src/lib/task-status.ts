// The two terminal columns of every workspace pipeline. Statuses are
// workspace-configurable rows (TaskStatus), but these two names are structural:
// completedAt is stamped from them, the board hides "Published", and the
// publish calendar only accepts work that has reached them.
export const COMPLETED_STATUS = "Completed";
export const PUBLISHED_STATUS = "Published";

export const TERMINAL_STATUS_NAMES = [COMPLETED_STATUS, PUBLISHED_STATUS] as const;

/**
 * Whether a status is a finished column.
 *
 * Deliberately an exact-name check, not a substring one: matching loosely used
 * to let mid-pipeline stages such as "Raw Footage Review" or "Final Video
 * Check" count as finished, which put unfinished work on the publish calendar.
 */
export function isTerminalStatusName(name: string | null | undefined): boolean {
  return name === COMPLETED_STATUS || name === PUBLISHED_STATUS;
}
