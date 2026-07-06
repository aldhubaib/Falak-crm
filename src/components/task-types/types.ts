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
  requirementFields: TTField[];
  deliveryFields: TTField[];
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
