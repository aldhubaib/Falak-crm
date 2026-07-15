export const DEFAULT_PROJECT_TIMEZONE = "Asia/Kuwait";

export const PROJECT_TIMEZONE_OPTIONS = [
  { value: "Asia/Kuwait", label: "Kuwait (GMT+3)" },
  { value: "Asia/Riyadh", label: "Riyadh (GMT+3)" },
  { value: "Asia/Dubai", label: "Dubai (GMT+4)" },
  { value: "Asia/Qatar", label: "Qatar (GMT+3)" },
  { value: "Asia/Bahrain", label: "Bahrain (GMT+3)" },
  { value: "Asia/Muscat", label: "Muscat (GMT+4)" },
  { value: "UTC", label: "UTC" },
] as const;

export function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function normalizeTimezone(tz: string | null | undefined): string {
  if (tz && isValidTimezone(tz)) return tz;
  return DEFAULT_PROJECT_TIMEZONE;
}

type ZonedParts = {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  weekday: string;
};

export function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const map: Record<string, string> = {};
  for (const p of fmt.formatToParts(date)) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  return {
    year: map.year ?? "1970",
    month: map.month ?? "01",
    day: map.day ?? "01",
    hour: map.hour === "24" ? "00" : (map.hour ?? "00"),
    minute: map.minute ?? "00",
    weekday: map.weekday ?? "Mon",
  };
}

function zonedKey(parts: Pick<ZonedParts, "year" | "month" | "day" | "hour" | "minute">) {
  return `${parts.year}-${parts.month}-${parts.day}-${parts.hour}-${parts.minute}`;
}

/**
 * UTC instant for a wall-clock time on a calendar day in `timeZone` — exact
 * to the millisecond (…:00.000), so equality lookups on stored week starts
 * always match. Iterative offset correction: guess the instant as if the wall
 * clock were UTC, read back what that instant looks like in the zone, and
 * shift by the difference (converges immediately for fixed-offset zones like
 * Asia/Kuwait).
 */
export function zonedDateTimeUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const want = Date.UTC(year, month - 1, day, hour, minute);
  let ts = want;
  for (let i = 0; i < 3; i++) {
    const p = getZonedParts(new Date(ts), timeZone);
    const actual = Date.UTC(
      Number(p.year),
      Number(p.month) - 1,
      Number(p.day),
      Number(p.hour),
      Number(p.minute),
    );
    if (actual === want) break;
    ts += want - actual;
  }
  return new Date(ts);
}

export function parseZonedDateTime(
  dateStr: string,
  timeStr: string,
  timeZone: string,
  fallback: Date,
): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [h, min] = timeStr.split(":").map(Number);
  if (!y || !m || !d) return fallback;
  return zonedDateTimeUtc(y, m, d, h ?? 0, min ?? 0, timeZone);
}

export function formatZonedDateInput(
  date: Date,
  timeZone: string,
): { date: string; time: string } {
  const p = getZonedParts(date, timeZone);
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    time: `${p.hour}:${p.minute}`,
  };
}

export function timezoneLabel(tz: string): string {
  return PROJECT_TIMEZONE_OPTIONS.find((o) => o.value === tz)?.label ?? tz;
}
