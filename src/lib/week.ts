import {
  DEFAULT_PROJECT_TIMEZONE,
  getZonedParts,
  normalizeTimezone,
  zonedDateTimeUtc,
} from "@/lib/timezone";

const WEEKDAY_OFFSET: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

/** Monday 00:00 in `timeZone`, returned as a UTC instant for DB storage. */
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

  const monday = new Date(Date.UTC(y, m - 1, d));
  monday.setUTCDate(monday.getUTCDate() - dow);

  return zonedDateTimeUtc(
    monday.getUTCFullYear(),
    monday.getUTCMonth() + 1,
    monday.getUTCDate(),
    0,
    0,
    tz,
  );
}
