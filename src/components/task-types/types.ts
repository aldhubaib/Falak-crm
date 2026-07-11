import type { Section } from "./constants";

export type TTField = {
  id: string;
  label: string;
  kind: string;
  mandatory: boolean;
  phase: Section;
  order: number;
  options: string[];
  allowedFormats: string[];
  allowedFileTypes: string | null;
  aspectRatio: string | null;
  visibleFromStageId: string | null;
  requiredBeforeStageId: string | null;
  lockedFromStageId: string | null;
  neverLock: boolean;
  /** Placement on the publish calendar card: "hidden" | "expanded" | "always". */
  publishCard: string;
  /** Disabled: kept with its task data but not shown or enforced anywhere. */
  hidden: boolean;
  /** Effort measurement: null = no effort, or "words" | "audio_min" | "video_min" | "fixed". */
  effortUnit: string | null;
  /** Expected quantity per planned video-minute — predicts effort before content exists. */
  qtyPerVideoMinute: number | null;
};

/** A named, editable group of fields on a task type. The phase drives the
 * behavior: "create" sections belong to the new-task form and lock after
 * Todo; "delivery" sections are filled during work. */
export type TTSection = {
  id: string;
  name: string;
  phase: Section;
  order: number;
  fields: TTField[];
};

export type TaskTypeVM = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  publishToCalendar: boolean;
  /** Lock rule for the built-in Title (null + false = Auto: locks after Todo). */
  titleLockedFromStageId: string | null;
  titleNeverLock: boolean;
  /** Custom display copy for the built-in Title (null = default). */
  titleLabel: string | null;
  titleHelp: string | null;
  sections: TTSection[];
};

export type TitleLockPatch = {
  lockedFromStageId: string | null;
  neverLock: boolean;
  /** Rendered label for the Title field; null/empty = "Task Title". */
  label: string | null;
  /** Helper text under the label; null/empty = the default hint. */
  help: string | null;
};

export type StatusOpt = { id: string; name: string; color: string };

export type FieldPatch = {
  label?: string;
  kind?: string;
  mandatory?: boolean;
  options?: string[];
  allowedFormats?: string[];
  allowedFileTypes?: string | null;
  aspectRatio?: string | null;
  visibleFromStageId?: string | null;
  requiredBeforeStageId?: string | null;
  lockedFromStageId?: string | null;
  neverLock?: boolean;
  publishCard?: string;
  effortUnit?: string | null;
  qtyPerVideoMinute?: number | null;
};
