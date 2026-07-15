import {
  DEFAULT_PROJECT_TIMEZONE,
  getZonedParts,
  normalizeTimezone,
  zonedDateTimeUtc,
} from "@/lib/timezone";

// ─── The unified calendar ────────────────────────────────────────────────────
// The whole system runs on ONE week grid: weeks start Sunday 00:00 and the
// working week ends Thursday 23:59 (Kuwait). Every project, plan and slot
// snaps to this grid — there are no per-project or per-plan cycles.

const WEEKDAY_OFFSET: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** Sunday 00:00 in `timeZone`, returned as a UTC instant for DB storage. */
export function weekStartOf(
  now = new Date(),
  timeZone = DEFAULT_PROJECT_TIMEZONE,
): Date {
  const tz = normalizeTimezone(timeZone);
  const parts = getZonedParts(now, tz);
  const dow = WEEKDAY_OFFSET[parts.weekday] ?? 0;
  const y = Number(parts.year);
  const m = Number(parts.month);
  const d = Number(parts.day);

  const sunday = new Date(Date.UTC(y, m - 1, d));
  sunday.setUTCDate(sunday.getUTCDate() - dow);

  return zonedDateTimeUtc(
    sunday.getUTCFullYear(),
    sunday.getUTCMonth() + 1,
    sunday.getUTCDate(),
    0,
    0,
    tz,
  );
}

/**
 * Deadline of a week's slots: Thursday 23:59 in `timeZone` — the end of the
 * last working day (the working week is Sunday–Thursday).
 */
export function weekDueDate(
  weekStart: Date,
  timeZone = DEFAULT_PROJECT_TIMEZONE,
): Date {
  const tz = normalizeTimezone(timeZone);
  const parts = getZonedParts(weekStart, tz);
  const thursday = new Date(
    Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)),
  );
  thursday.setUTCDate(thursday.getUTCDate() + 4);
  return zonedDateTimeUtc(
    thursday.getUTCFullYear(),
    thursday.getUTCMonth() + 1,
    thursday.getUTCDate(),
    23,
    59,
    tz,
  );
}

/**
 * The week new planned work books into. The planning week closes with the
 * working week (Thursday 23:59): anything added on Friday or Saturday belongs
 * to NEXT week's plan — its due date must never be in the past.
 */
export function planningWeekStartOf(
  now = new Date(),
  timeZone = DEFAULT_PROJECT_TIMEZONE,
): Date {
  const weekStart = weekStartOf(now, timeZone);
  if (now.getTime() > weekDueDate(weekStart, timeZone).getTime()) {
    const next = new Date(weekStart);
    next.setUTCDate(next.getUTCDate() + 7);
    return next;
  }
  return weekStart;
}
