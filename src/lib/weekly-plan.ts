export const REPEAT_EVERY_VALUES = [
  "week",
  "2weeks",
  "month",
  "2months",
  "3months",
  "6months",
  "year",
] as const;

export type RepeatEvery = (typeof REPEAT_EVERY_VALUES)[number];

export type WeeklyTarget = {
  templateId: string;
  perWeek: number;
  repeatEvery: RepeatEvery;
  startOn: Date;
  endsOn: Date | null;
  neverExpires: boolean;
  responsibleMemberId: string | null;
};

export const REPEAT_OPTIONS: { value: RepeatEvery; label: string }[] = [
  { value: "week", label: "Week" },
  { value: "2weeks", label: "2 Weeks" },
  { value: "month", label: "Month" },
  { value: "2months", label: "2 Months" },
  { value: "3months", label: "3 Months" },
  { value: "6months", label: "6 Months" },
  { value: "year", label: "Year" },
];

export function repeatUnitLabel(v: RepeatEvery): string {
  return REPEAT_OPTIONS.find((o) => o.value === v)?.label.toLowerCase() ?? "week";
}

function addRepeatInterval(date: Date, repeat: RepeatEvery): Date {
  const next = new Date(date);
  switch (repeat) {
    case "week":
      next.setUTCDate(next.getUTCDate() + 7);
      break;
    case "2weeks":
      next.setUTCDate(next.getUTCDate() + 14);
      break;
    case "month":
      next.setUTCMonth(next.getUTCMonth() + 1);
      break;
    case "2months":
      next.setUTCMonth(next.getUTCMonth() + 2);
      break;
    case "3months":
      next.setUTCMonth(next.getUTCMonth() + 3);
      break;
    case "6months":
      next.setUTCMonth(next.getUTCMonth() + 6);
      break;
    case "year":
      next.setUTCFullYear(next.getUTCFullYear() + 1);
      break;
  }
  return next;
}

/**
 * End of the plan cycle containing `now`, anchored at the target's Start On.
 * This is the deadline for the cycle's slots — e.g. a weekly plan started
 * Friday runs Friday→Friday. If the plan hasn't started yet, returns the end
 * of its first cycle.
 */
export function cycleEndOf(
  startOn: Date,
  repeatEvery: RepeatEvery,
  now: Date = new Date(),
): Date {
  let end = addRepeatInterval(startOn, repeatEvery);
  // Bounded walk: even a weekly plan started 20 years ago stays near ~1000.
  for (let i = 0; end <= now && i < 5000; i++) {
    end = addRepeatInterval(end, repeatEvery);
  }
  return end;
}
