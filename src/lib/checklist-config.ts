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

export type YesNoParsed = { value: "yes" | "no" | null; text: string };

/** Parse a yes/no checklist answer from its stored textValue. */
export function parseYesNoValue(raw: string | null | undefined): YesNoParsed {
  if (!raw) return { value: null, text: "" };
  const trimmed = raw.trim();
  if (trimmed === "yes") return { value: "yes", text: "" };
  if (trimmed === "no") return { value: "no", text: "" };
  try {
    const o = JSON.parse(trimmed) as {
      v?: string;
      t?: string;
      enabled?: boolean;
      text?: string;
    };
    if (o?.v === "yes" || o?.v === "no") {
      return { value: o.v, text: o.t ?? "" };
    }
    if (typeof o?.enabled === "boolean") {
      return {
        value: o.enabled ? "yes" : "no",
        text: o.text ?? "",
      };
    }
  } catch {
    // Legacy plain text — treat as "yes" with follow-up text.
  }
  return { value: "yes", text: trimmed };
}

type GateFieldItem = {
  name?: string | null;
  type?: string | null;
  role?: string | null;
  textValue?: string | null;
  templateItem?: {
    name?: string | null;
    type?: string | null;
    role?: string | null;
  } | null;
};

/** Answer on the task's Copyright / Copyright Image field, if present. */
export function findCopyrightAnswer(
  items: GateFieldItem[],
): "yes" | "no" | null {
  for (const item of items) {
    const cfg = fieldConfig(item);
    if (cfg.type === "copyright") {
      return parseYesNoValue(item.textValue).value;
    }
  }
  return null;
}

const COPYRIGHT_FOLLOWUP_NAMES = new Set([
  "comment",
  "copyright text",
  "copyright comment",
]);

/** Whether a field should participate in stage-gate checks on this task. */
export function fieldAppliesForGate(
  item: GateFieldItem,
  allItems: GateFieldItem[],
  copyrightAnswer?: "yes" | "no" | null,
): boolean {
  const cfg = fieldConfig(item);
  const answer = copyrightAnswer ?? findCopyrightAnswer(allItems);
  if (answer !== "no") return true;
  if (cfg.type === "copyright") return true;

  const name = (cfg.name ?? "").trim().toLowerCase();
  if (COPYRIGHT_FOLLOWUP_NAMES.has(name)) return false;
  if ((cfg.role ?? "").toLowerCase().includes("copyright")) return false;
  return true;
}

/**
 * Whether a checklist field counts as complete for stage-gate purposes.
 * Yes/No kinds (mention, copyright) only block when answered "Yes" without
 * their follow-up: Mention needs its text, Copyright needs its file.
 */
export function isGateComplete(
  item: {
    completed: boolean;
    textValue?: string | null;
    attachmentId?: string | null;
  },
  cfg: { type?: string },
): boolean {
  if (item.completed) return true;
  if (cfg.type !== "mention" && cfg.type !== "copyright") return false;

  const { value, text } = parseYesNoValue(item.textValue);
  if (value === "yes") {
    return cfg.type === "copyright" ? !!item.attachmentId : !!text.trim();
  }
  return true;
}

export type LockConfig = {
  phase: string;
  lockedFromStageId: string | null;
  neverLock: boolean;
};

/**
 * Stage order the "Auto" lock rule anchors to: fields lock once the task
 * moves PAST this stage. That's the stage named "Todo" — stages before it
 * (e.g. Backlog) are pre-work, so fields stay editable there too. Falls back
 * to the first stage when no "Todo" exists.
 */
export function autoLockOrder(
  statuses: { name?: string | null; order: number }[],
): number {
  const todo = statuses.find((s) => s.name === "Todo");
  if (todo) return todo.order;
  return statuses.length ? Math.min(...statuses.map((s) => s.order)) : 0;
}

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
