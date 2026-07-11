import { getChecklistTemplates, getTaskStatuses } from "@/actions/settings";
import { AppHeader } from "@/components/app-header";
import { TaskTypesClient } from "./task-types-client";
import type {
  StatusOpt,
  TaskTypeVM,
  TTField,
  TTSection,
} from "@/components/task-types/types";

function parseArray(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {
    return value
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

type RawItem = {
  id: string;
  name: string;
  type: string;
  mandatory: boolean;
  phase: string;
  sectionId: string | null;
  order: number;
  options: string | null;
  allowedFormats: string | null;
  allowedFileTypes: string | null;
  aspectRatio: string | null;
  visibleFromStageId: string | null;
  requiredBeforeStageId: string | null;
  lockedFromStageId: string | null;
  neverLock: boolean;
  publishCard: string;
  hidden: boolean;
  effortUnit: string | null;
  qtyPerVideoMinute: number | null;
};

function toField(i: RawItem): TTField {
  return {
    id: i.id,
    label: i.name,
    kind: i.type,
    mandatory: i.mandatory,
    phase: i.phase === "delivery" ? "delivery" : "create",
    order: i.order,
    options: parseArray(i.options),
    allowedFormats: parseArray(i.allowedFormats),
    allowedFileTypes: i.allowedFileTypes,
    aspectRatio: i.aspectRatio,
    visibleFromStageId: i.visibleFromStageId,
    requiredBeforeStageId: i.requiredBeforeStageId,
    lockedFromStageId: i.lockedFromStageId,
    neverLock: i.neverLock,
    publishCard: i.publishCard,
    hidden: i.hidden,
    effortUnit: i.effortUnit,
    qtyPerVideoMinute: i.qtyPerVideoMinute,
  };
}

export default async function TaskTypesPage() {
  const [templates, statuses] = await Promise.all([
    getChecklistTemplates(),
    getTaskStatuses(),
  ]);

  const vm: TaskTypeVM[] = templates.map((t) => {
    const rawItems = t.items as RawItem[];

    const sections: TTSection[] = t.sections.map((s) => ({
      id: s.id,
      name: s.name,
      phase: s.phase === "delivery" ? "delivery" : "create",
      order: s.order,
      fields: [] as TTField[],
    }));
    const sectionById = new Map(sections.map((s) => [s.id, s]));

    // Items land in their section; legacy items without one fall back to the
    // first section matching their phase.
    for (const raw of rawItems) {
      const field = toField(raw);
      const target =
        (raw.sectionId ? sectionById.get(raw.sectionId) : undefined) ??
        sections.find((s) => s.phase === field.phase) ??
        sections[0];
      target?.fields.push(field);
    }
    for (const s of sections) s.fields.sort((a, b) => a.order - b.order);

    return {
      id: t.id,
      name: t.name,
      icon: t.icon,
      color: t.color,
      publishToCalendar: t.publishToCalendar,
      titleLockedFromStageId: t.titleLockedFromStageId,
      titleNeverLock: t.titleNeverLock,
      titleLabel: t.titleLabel,
      titleHelp: t.titleHelp,
      sections,
    };
  });

  const statusOpts: StatusOpt[] = statuses.map((s) => ({
    id: s.id,
    name: s.name,
    color: s.color,
  }));

  return (
    <>
      <AppHeader title="Task Types" backHref="/settings" />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <TaskTypesClient templates={vm} statuses={statusOpts} />
      </main>
    </>
  );
}
