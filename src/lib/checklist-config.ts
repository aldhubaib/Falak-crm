// Task checklist fields carry a snapshot of their config (lock rules,
// mandatory, phase, options, ...) copied from the template at creation time.
// That snapshot goes stale the moment the template changes in Settings → Task
// Types, so it is treated ONLY as a fallback for detached/custom fields:
// whenever a task field is still linked to its template item, all config is
// resolved from the LIVE template at read time. Settings changes therefore
// take effect on every existing task immediately, with no backfill.

/**
 * Effective config for a task checklist field: the live template item when the
 * field is linked, the per-task snapshot otherwise.
 *
 * Generic over the selected shapes so each query can select only what it
 * needs; the result is the union, so only config fields present on BOTH the
 * task row and the template item are accessible — exactly the ones that are
 * safe to resolve dynamically.
 */
export function fieldConfig<T extends object, U extends object>(
  item: T & { templateItem?: U | null },
): T | U {
  return item.templateItem ?? item;
}

export type LockConfig = {
  phase: string;
  lockedFromStageId: string | null;
  neverLock: boolean;
};

/**
 * A field is read-only once the task reaches its "Locked From" stage.
 * "Never" keeps it editable at every stage. With no stage set ("Auto") the
 * built-in rule applies: requirement fields lock once the task moves past
 * Todo; delivery fields stay open.
 *
 * Shared by the task page UI and the server-side write guard so both always
 * agree.
 */
/**
 * Lock rule for the built-in task Title, configured per task type in
 * Settings → Task Types. Same semantics as requirement fields: Auto locks the
 * title once the task leaves Todo. Tasks without a template follow Auto.
 */
export function titleLockConfig(
  tpl:
    | { titleLockedFromStageId: string | null; titleNeverLock: boolean }
    | null
    | undefined,
): LockConfig {
  return {
    phase: "create",
    lockedFromStageId: tpl?.titleLockedFromStageId ?? null,
    neverLock: tpl?.titleNeverLock ?? false,
  };
}

export function isFieldLocked(
  cfg: LockConfig,
  currentOrder: number | null,
  orderById: Map<string, number>,
  todoOrder: number,
): boolean {
  if (cfg.neverLock) return false;
  if (currentOrder == null) return false;
  if (cfg.lockedFromStageId) {
    const lockOrder = orderById.get(cfg.lockedFromStageId);
    return lockOrder != null && currentOrder >= lockOrder;
  }
  if (cfg.phase === "delivery") return false;
  return currentOrder > todoOrder;
}
