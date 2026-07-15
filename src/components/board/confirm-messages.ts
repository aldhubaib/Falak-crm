/** "Please complete the missing data…" with a numbered field list — the same
 *  copy whether the gate trips in the pre-drag dry-run or the real move. */
export function missingDataMessage(missing: string[]): string {
  return [
    "Please complete the missing data:",
    ...missing.map((n, i) => `${i + 1}- ${n}`),
    "in order to move it.",
  ].join("\n");
}

// Stage-specific confirmation copy shown before a forward move, shared by the
// board's drag-drop flow and the task detail page's Back/Next controls.
export const CONFIRM_MESSAGES: Record<
  string,
  {
    title: string;
    description: string;
    confirmLabel?: string;
    /** Show the "taking ownership" hand-off chips (assignee → me). */
    assignToMe?: boolean;
  }
> = {
  "Raw Footage": {
    title: "Move to Raw Footage",
    description:
      "By confirming, you acknowledge that you understand the requirements and are taking ownership of this task.",
    confirmLabel: "I Understand",
    assignToMe: true,
  },
  "Raw Footage Review": {
    title: "Submit for Raw Footage Review",
    description:
      "I confirm that the raw footage is complete and ready to be reviewed.",
  },
  "Final Video Check": {
    title: "Submit for Final Video Check",
    description:
      "I confirm that all requirements have been completed, checked, and are ready for the final video check.",
  },
  Review: {
    title: "Send to Review",
    description:
      "I confirm that all requirements have been completed and meet our quality standards.",
  },
  Completed: {
    title: "Mark as Completed",
    description:
      "I confirm that the client has approved this task and it is ready to be marked as completed.",
  },
};
