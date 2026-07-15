// Weekly plans on the unified calendar: a plan is just "N tasks per week,
// owned by a responsible member". Weeks run Sunday→Saturday with work due
// Thursday 23:59 (see src/lib/week.ts) — there are no per-plan cycles,
// anchors or repeat intervals.
export type WeeklyTarget = {
  templateId: string;
  perWeek: number;
  /** First planned week (Sunday). "Starts next week" defers the first slots
   *  so the team can stock the backlog first. */
  startsOn: Date;
  responsibleMemberId: string | null;
};
