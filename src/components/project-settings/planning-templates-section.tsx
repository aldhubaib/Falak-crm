"use client";

import { useState, useTransition } from "react";
import { Check, ChevronDown, Minus, Plus, Zap } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { cn } from "@/lib/utils";
import {
  forceAddWeeklySlot,
  type PlanningEligibleMember,
  type WeeklyEffortMatrix,
} from "@/actions/weekly-plan";
import {
  cycleEndOf,
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

// Deadline of the current plan cycle, e.g. "due Jul 13" (project timezone).
function cycleDueLabel(plan: WeeklyTarget, timezone: string): string {
  const cycleEnd = cycleEndOf(plan.startOn, plan.repeatEvery);
  // Show the last day of the cycle, not the first day of the next one.
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    month: "short",
    day: "numeric",
  }).format(new Date(cycleEnd.getTime() - 60_000));
}

// "5/wk ≈ 21h 30m" — hours the target costs the responsible member.
function formatEffortHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function PlanningTemplatesSection({
  projectId,
  templates,
  templateIds,
  initialTargets,
  eligibleMembers,
  effortMatrix,
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
  effortMatrix?: WeeklyEffortMatrix;
  timezone: string;
  isOwner: boolean;
  onTemplateIdsChange: (ids: string[]) => void;
  onPlansChange: (plans: PlanState) => void;
  plans: PlanState;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [forcePending, startForce] = useTransition();
  // Force-add flow: pick the extra slot's due date first (never in the past).
  const [forceAddFor, setForceAddFor] = useState<Template | null>(null);
  const todayStr = formatZonedDateInput(new Date(), timezone).date;
  const [forceDate, setForceDate] = useState(todayStr);

  const confirmForceAdd = () => {
    const target = forceAddFor;
    if (!target || !forceDate || forceDate < todayStr) return;
    setForceAddFor(null);
    startForce(async () => {
      // Deadlines are end-of-day in the project's timezone.
      await forceAddWeeklySlot(
        projectId,
        target.id,
        parseZonedDateTime(forceDate, "23:59", timezone, new Date()),
      );
    });
  };

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

        // Predicted hours this target costs the responsible member per cycle.
        const perTaskMin =
          plan.responsibleMemberId != null
            ? (effortMatrix?.perTaskMinutes[t.id]?.[plan.responsibleMemberId] ??
              null)
            : null;
        const cycleMinutes =
          perTaskMin != null && val > 0 ? perTaskMin * val : null;
        const memberHours =
          plan.responsibleMemberId != null
            ? (effortMatrix?.memberWeeklyHours[plan.responsibleMemberId] ?? null)
            : null;

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
                {active && val > 0 && (
                  <span
                    className="rounded-md bg-muted/40 px-1.5 py-0.5 text-xxs text-muted-foreground"
                    title="Deadline of the current plan cycle"
                  >
                    due {cycleDueLabel(plan, timezone)}
                  </span>
                )}
                {active && cycleMinutes != null && (
                  <span
                    className="rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-xxs tabular-nums text-primary"
                    title="Predicted effort for the responsible member (2-min video baseline × their title rates)"
                  >
                    ≈ {formatEffortHours(cycleMinutes)}
                    {memberHours != null && ` of ${memberHours}h`}
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
                      onClick={() => {
                        setForceDate(todayStr);
                        setForceAddFor(t);
                      }}
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

      {/* Force-add: the extra slot needs its own deadline (today or later). */}
      <Dialog
        open={forceAddFor != null}
        onOpenChange={(open) => !open && setForceAddFor(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Force-add a slot</DialogTitle>
            <DialogDescription>
              Adds one extra {forceAddFor?.name} slot to this week&apos;s plan.
              Pick its due date — past dates aren&apos;t allowed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-xxs font-medium text-muted-foreground">
              Due date<span className="text-rose-400"> *</span>
            </Label>
            <input
              type="date"
              value={forceDate}
              min={todayStr}
              onChange={(e) => setForceDate(e.target.value)}
              className="h-9 w-full rounded-lg border border-border/60 bg-background/60 px-2 text-xs tabular-nums text-foreground outline-none [color-scheme:dark]"
            />
            {forceDate && forceDate < todayStr && (
              <p className="text-xxs text-rose-400">
                The due date can&apos;t be in the past.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setForceAddFor(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!forceDate || forceDate < todayStr || forcePending}
              onClick={confirmForceAdd}
              className="gap-1.5"
            >
              <Zap className="size-3.5" />
              Force add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
