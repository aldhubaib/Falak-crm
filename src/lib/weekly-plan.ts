// Weekly plans on the unified calendar: "N tasks every `intervalWeeks` weeks,
// owned by a responsible member". Weeks run Sunday→Saturday with work due
// Thursday 23:59 (see src/lib/week.ts). The cadence counts from startsOn's
// week — off-weeks between cycles produce no slots.
export type WeeklyTarget = {
  templateId: string;
  perWeek: number;
  /** Cadence in weeks: 1 = every week, 2 = every 2 weeks… (max 4 in the UI). */
  intervalWeeks: number;
  /** First planned week (Sunday). "Starts next week" defers the first slots
   *  so the team can stock the backlog first. */
  startsOn: Date;
  responsibleMemberId: string | null;
};
