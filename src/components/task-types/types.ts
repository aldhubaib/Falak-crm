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
  requirementFields: TTField[];
  deliveryFields: TTField[];
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
};
