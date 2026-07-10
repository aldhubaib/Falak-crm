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
