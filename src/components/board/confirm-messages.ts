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
  "AI Generation": {
    title: "Move to AI Generation",
    description:
      "By confirming, you acknowledge that you understand the requirements and are taking ownership of this task.",
    confirmLabel: "I Understand",
    assignToMe: true,
  },
  "Internal Review": {
    title: "Submit for Internal Review",
    description:
      "I confirm that all requirements have been completed, checked, and are ready for internal review.",
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
