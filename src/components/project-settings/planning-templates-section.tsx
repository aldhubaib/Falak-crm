"use client";

import { useState, useTransition } from "react";
import { Check, ChevronDown, Minus, Plus, Zap } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { cn } from "@/lib/utils";
import {
  forceAddWeeklySlot,
  type PlanningEligibleMember,
} from "@/actions/weekly-plan";
import {
  REPEAT_OPTIONS,
  repeatUnitLabel,
  type RepeatEvery,
  type WeeklyTarget,
} from "@/lib/weekly-plan";
import { weekStartOf } from "@/lib/week";
import {
  formatZonedDateInput,
  parseZonedDateTime,
  timezoneLabel,
} from "@/lib/timezone";

type Template = { id: string; name: string; itemCount: number };

type PlanState = Record<string, WeeklyTarget>;

function defaultPlan(templateId: string, timezone: string): WeeklyTarget {
  return {
    templateId,
    perWeek: 0,
    repeatEvery: "week",
    startOn: weekStartOf(new Date(), timezone),
    endsOn: null,
    neverExpires: true,
    responsibleMemberId: null,
  };
}

function plansFromTargets(targets: WeeklyTarget[]): PlanState {
  return Object.fromEntries(
    targets.map((t) => [
      t.templateId,
      {
        ...t,
        startOn: new Date(t.startOn),
        endsOn: t.endsOn ? new Date(t.endsOn) : null,
        responsibleMemberId: t.responsibleMemberId ?? null,
      },
    ]),
  );
}

export function serializePlans(plans: PlanState): string {
  return Object.values(plans)
    .filter((p) => p.perWeek > 0)
    .sort((a, b) => a.templateId.localeCompare(b.templateId))
    .map(
      (p) =>
        `${p.templateId}:${p.perWeek}:${p.repeatEvery}:${p.startOn.toISOString()}:${p.endsOn?.toISOString() ?? ""}:${p.neverExpires}:${p.responsibleMemberId ?? ""}`,
    )
    .join("|");
}

export function PlanningTemplatesSection({
  projectId,
  templates,
  templateIds,
  initialTargets,
  eligibleMembers,
  timezone,
  isOwner,
  onTemplateIdsChange,
  onPlansChange,
  plans,
}: {
  projectId: string;
  templates: Template[];
  templateIds: string[];
  initialTargets: WeeklyTarget[];
  eligibleMembers: PlanningEligibleMember[];
  timezone: string;
  isOwner: boolean;
  onTemplateIdsChange: (ids: string[]) => void;
  onPlansChange: (plans: PlanState) => void;
  plans: PlanState;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [forcePending, startForce] = useTransition();

  const toggleTemplate = (id: string) => {
    const next = templateIds.includes(id)
      ? templateIds.filter((t) => t !== id)
      : [...templateIds, id];
    onTemplateIdsChange(next);
    if (!templateIds.includes(id) && !plans[id]) {
      const plan = defaultPlan(id, timezone);
      if (eligibleMembers.length === 1) {
        plan.responsibleMemberId = eligibleMembers[0]!.id;
      }
      onPlansChange({ ...plans, [id]: plan });
    }
  };

  const patchPlan = (templateId: string, patch: Partial<WeeklyTarget>) => {
    onPlansChange({
      ...plans,
      [templateId]: {
        ...(plans[templateId] ?? defaultPlan(templateId, timezone)),
        ...patch,
      },
    });
  };

  if (templates.length === 0) {
    return (
      <div className="py-4 text-center text-xs text-muted-foreground">
        No templates yet.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {templates.map((t) => {
        const active = templateIds.includes(t.id);
        const plan = plans[t.id] ?? defaultPlan(t.id, timezone);
        const val = plan.perWeek;
        const isExpanded = active && (expanded[t.id] ?? true);

        return (
          <div
            key={t.id}
            className={cn(
              "rounded-xl border transition-all",
              active
                ? "border-primary/50 bg-surface"
                : "border-border/60 bg-surface",
            )}
          >
            <div className="flex items-center gap-3 px-4 py-3">
              <button
                type="button"
                aria-label={active ? "Disable template" : "Enable template"}
                onClick={() => toggleTemplate(t.id)}
                className={cn(
                  "grid size-5 shrink-0 place-items-center rounded-md border transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border hover:border-foreground/40",
                )}
              >
                {active && <Check className="size-3.5" />}
              </button>
              <button
                type="button"
                onClick={() =>
                  active
                    ? setExpanded((e) => ({ ...e, [t.id]: !isExpanded }))
                    : toggleTemplate(t.id)
                }
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <span className="truncate text-sm font-medium">{t.name}</span>
                <span className="rounded-md bg-muted/40 px-1.5 py-0.5 text-xxs text-muted-foreground">
                  {t.itemCount} items
                </span>
                {active && val > 0 && (
                  <span className="rounded-md border border-border/60 bg-muted/30 px-1.5 py-0.5 text-xxs tabular-nums text-foreground">
                    {val}/wk
                  </span>
                )}
              </button>
              {active && (
                <button
                  type="button"
                  aria-label={isExpanded ? "Collapse" : "Expand"}
                  onClick={() =>
                    setExpanded((e) => ({ ...e, [t.id]: !isExpanded }))
                  }
                  className="grid size-7 place-items-center rounded-md text-muted-foreground hover:text-foreground"
                >
                  <ChevronDown
                    className={cn(
                      "size-4 transition-transform",
                      isExpanded && "rotate-180",
                    )}
                  />
                </button>
              )}
            </div>

            {isExpanded && (
              <div className="space-y-3 border-t border-border/50 px-4 py-3">
                <RecurrenceForm
                  value={plan}
                  timezone={timezone}
                  onChange={(patch) => patchPlan(t.id, patch)}
                />

                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-foreground">
                      Target
                    </div>
                    <div className="text-xxs text-muted-foreground">
                      Tasks to deliver per {repeatUnitLabel(plan.repeatEvery)}.
                    </div>
                  </div>
                  <div className="inline-flex items-center gap-2">
                    <button
                      type="button"
                      aria-label="Decrease"
                      onClick={() =>
                        patchPlan(t.id, {
                          perWeek: Math.max(0, val - 1),
                        })
                      }
                      disabled={val === 0}
                      className="grid size-7 place-items-center rounded-md border border-border/60 bg-muted/30 text-sm text-muted-foreground hover:text-foreground disabled:opacity-40"
                    >
                      <Minus className="size-3.5" />
                    </button>
                    <div className="w-10 text-center text-sm font-semibold tabular-nums">
                      {val || "—"}
                    </div>
                    <button
                      type="button"
                      aria-label="Increase"
                      onClick={() => {
                        const next = val + 1;
                        const patch: Partial<WeeklyTarget> = { perWeek: next };
                        if (
                          next > 0 &&
                          !plan.responsibleMemberId &&
                          eligibleMembers.length === 1
                        ) {
                          patch.responsibleMemberId = eligibleMembers[0]!.id;
                        }
                        patchPlan(t.id, patch);
                      }}
                      className="grid size-7 place-items-center rounded-md border border-border/60 bg-muted/30 text-sm text-muted-foreground hover:text-foreground"
                    >
                      <Plus className="size-3.5" />
                    </button>
                    <span className="ml-1 text-xs text-muted-foreground">
                      / {repeatUnitLabel(plan.repeatEvery)}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 rounded-lg border border-border/60 bg-surface/40 px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-foreground">
                      Responsible
                    </div>
                    <div className="text-xxs text-muted-foreground">
                      Team member who owns this plan&apos;s weekly slots. Only
                      members with Todo Auto-Assign can be selected.
                    </div>
                  </div>
                  {eligibleMembers.length === 0 ? (
                    <p className="text-xxs text-amber-400">
                      No eligible members — add someone to the project team with
                      Todo Auto-Assign on their role.
                    </p>
                  ) : (
                    <SearchableSelect
                      value={plan.responsibleMemberId ?? ""}
                      onValueChange={(v) =>
                        patchPlan(t.id, {
                          responsibleMemberId: v || null,
                        })
                      }
                      options={eligibleMembers.map((m) => ({
                        value: m.id,
                        label: m.name,
                      }))}
                      placeholder="Select team member"
                      className="h-9 text-xs"
                    />
                  )}
                </div>

                <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
                  <div className="min-w-0 text-xxs text-muted-foreground">
                    Users can&apos;t exceed the target. Owner can force-add an
                    extra one this cycle.
                  </div>
                  {isOwner && (
                    <button
                      type="button"
                      disabled={forcePending}
                      onClick={() =>
                        startForce(async () => {
                          await forceAddWeeklySlot(projectId, t.id);
                        })
                      }
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xxs font-medium text-amber-400 hover:bg-amber-500/15 disabled:opacity-50"
                    >
                      <Zap className="size-3" />
                      Force add
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function RecurrenceForm({
  value,
  timezone,
  onChange,
}: {
  value: WeeklyTarget;
  timezone: string;
  onChange: (patch: Partial<WeeklyTarget>) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xxs text-muted-foreground">
        Schedule times use {timezoneLabel(timezone)}.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
      <div className="space-y-1.5">
        <Label className="text-xxs font-medium text-muted-foreground">
          Repeat Every<span className="text-rose-400"> *</span>
        </Label>
        <SearchableSelect
          value={value.repeatEvery}
          onValueChange={(v) =>
            onChange({ repeatEvery: v as RepeatEvery })
          }
          options={REPEAT_OPTIONS.map((o) => ({
            value: o.value,
            label: o.label,
          }))}
          placeholder="Week"
          className="h-9 text-xs"
        />
      </div>

      <DateTimeField
        label="Start On"
        timezone={timezone}
        value={value.startOn}
        onChange={(d) => onChange({ startOn: d })}
      />

      <div className="space-y-1.5">
        <Label className="text-xxs font-medium text-muted-foreground">
          Ends On
        </Label>
        <div className="flex items-center gap-2">
          <DateTimeField
            timezone={timezone}
            value={value.endsOn ?? undefined}
            onChange={(d) => onChange({ endsOn: d, neverExpires: false })}
            disabled={value.neverExpires}
            className="flex-1"
          />
          <label className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
            <Checkbox
              checked={value.neverExpires}
              onCheckedChange={(c) =>
                onChange({
                  neverExpires: Boolean(c),
                  endsOn: c ? null : value.endsOn,
                })
              }
            />
            Never Expires
          </label>
        </div>
      </div>
    </div>
    </div>
  );
}

function DateTimeField({
  label,
  value,
  timezone,
  onChange,
  disabled,
  className,
}: {
  label?: string;
  value?: Date;
  timezone: string;
  onChange: (d: Date) => void;
  disabled?: boolean;
  className?: string;
}) {
  const formatted = value
    ? formatZonedDateInput(value, timezone)
    : formatZonedDateInput(new Date(), timezone);

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <Label className="text-xxs font-medium text-muted-foreground">
          {label}
        </Label>
      )}
      <div
        className={cn(
          "flex h-9 items-center gap-2 rounded-lg border border-border/60 bg-background/60 px-2",
          disabled && "opacity-50",
        )}
      >
        <input
          type="date"
          disabled={disabled}
          value={value ? formatted.date : ""}
          onChange={(e) =>
            onChange(
              parseZonedDateTime(
                e.target.value,
                formatted.time,
                timezone,
                value ?? new Date(),
              ),
            )
          }
          className="min-w-0 flex-1 border-0 bg-transparent text-xs tabular-nums text-foreground outline-none [color-scheme:dark] disabled:cursor-not-allowed"
        />
        <input
          type="time"
          disabled={disabled}
          value={value ? formatted.time : "00:00"}
          onChange={(e) =>
            onChange(
              parseZonedDateTime(
                formatted.date,
                e.target.value,
                timezone,
                value ?? new Date(),
              ),
            )
          }
          className="w-[5.5rem] shrink-0 border-0 bg-transparent text-xs tabular-nums text-foreground outline-none [color-scheme:dark] disabled:cursor-not-allowed"
        />
      </div>
    </div>
  );
}

export { plansFromTargets, defaultPlan };
