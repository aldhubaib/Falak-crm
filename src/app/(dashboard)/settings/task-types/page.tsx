import { getChecklistTemplates, getTaskStatuses } from "@/actions/settings";
import { AppHeader } from "@/components/app-header";
import { TaskTypesClient } from "./task-types-client";
import type {
  StatusOpt,
  TaskTypeVM,
  TTField,
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
  order: number;
  options: string | null;
  allowedFormats: string | null;
  allowedFileTypes: string | null;
  aspectRatio: string | null;
  visibleFromStageId: string | null;
  requiredBeforeStageId: string | null;
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
  };
}

export default async function TaskTypesPage() {
  const [templates, statuses] = await Promise.all([
    getChecklistTemplates(),
    getTaskStatuses(),
  ]);

  const vm: TaskTypeVM[] = templates.map((t) => {
    const fields = (t.items as RawItem[]).map(toField);
    return {
      id: t.id,
      name: t.name,
      icon: t.icon,
      color: t.color,
      requirementFields: fields
        .filter((f) => f.phase === "create")
        .sort((a, b) => a.order - b.order),
      deliveryFields: fields
        .filter((f) => f.phase === "delivery")
        .sort((a, b) => a.order - b.order),
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
