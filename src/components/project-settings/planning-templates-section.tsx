"use client";

import { useState, useTransition } from "react";
import { Check, ChevronDown, Minus, Plus, Zap } from "lucide-react";
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
import { type WeeklyTarget } from "@/lib/weekly-plan";
import { planningWeekStartOf, weekDueDate, weekStartOf } from "@/lib/week";
import { DEFAULT_PROJECT_TIMEZONE } from "@/lib/timezone";
import { useActionHandler } from "@/hooks/use-action";

type Template = { id: string; name: string; itemCount: number };

type PlanState = Record<string, WeeklyTarget>;

// All plans live on the unified calendar (weeks start Sunday, work is due
// Thursday 23:59 Kuwait) — a plan is just a per-week count plus an owner.
const TIMEZONE = DEFAULT_PROJECT_TIMEZONE;

function defaultPlan(templateId: string): WeeklyTarget {
  return {
    templateId,
    perWeek: 0,
    intervalWeeks: 1,
    startsOn: planningWeekStartOf(),
    responsibleMemberId: null,
  };
}

const INTERVAL_OPTIONS = [
  { value: "1", label: "Every week" },
  { value: "2", label: "Every 2 weeks" },
  { value: "3", label: "Every 3 weeks" },
  { value: "4", label: "Every 4 weeks" },
];

function plansFromTargets(targets: WeeklyTarget[]): PlanState {
  return Object.fromEntries(
    targets.map((t) => [
      t.templateId,
      {
        ...t,
        intervalWeeks: t.intervalWeeks || 1,
        startsOn: new Date(t.startsOn),
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
        `${p.templateId}:${p.perWeek}:${p.intervalWeeks || 1}:${p.startsOn.toISOString()}:${p.responsibleMemberId ?? ""}`,
    )
    .join("|");
}

const shortDateFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TIMEZONE,
  month: "short",
  day: "numeric",
});

function addWeeks(weekStart: Date, weeks: number): Date {
  const d = new Date(weekStart);
  d.setUTCDate(d.getUTCDate() + weeks * 7);
  return d;
}

/** The week the plan actually starts producing slots — never in the past. */
function effectiveStartWeek(plan: WeeklyTarget): Date {
  const current = planningWeekStartOf();
  const start = weekStartOf(plan.startsOn);
  return start.getTime() > current.getTime() ? start : current;
}

// Dropdown of start weeks: the current planning week plus the next 11. A
// selection already anchored further out keeps its own week as an extra option.
function startWeekOptions(selected: Date): { value: string; label: string }[] {
  const current = planningWeekStartOf();
  const options = Array.from({ length: 12 }, (_, i) => {
    const week = addWeeks(current, i);
    const label =
      i === 0
        ? `This week (due ${shortDateFmt.format(weekDueDate(week))})`
        : i === 1
          ? `Next week — ${shortDateFmt.format(week)} (due ${shortDateFmt.format(weekDueDate(week))})`
          : `Week of ${shortDateFmt.format(week)} (due ${shortDateFmt.format(weekDueDate(week))})`;
    return { value: week.toISOString(), label };
  });
  const own = selected.toISOString();
  if (!options.some((o) => o.value === own)) {
    options.push({
      value: own,
      label: `Week of ${shortDateFmt.format(selected)} (due ${shortDateFmt.format(weekDueDate(selected))})`,
    });
  }
  return options;
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
  eligibleMembers,
  effortMatrix,
  isOwner,
  onTemplateIdsChange,
  onPlansChange,
  plans,
}: {
  projectId: string;
  templates: Template[];
  templateIds: string[];
  eligibleMembers: PlanningEligibleMember[];
  effortMatrix?: WeeklyEffortMatrix;
  isOwner: boolean;
  onTemplateIdsChange: (ids: string[]) => void;
  onPlansChange: (plans: PlanState) => void;
  plans: PlanState;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [forcePending, startForce] = useTransition();
  // Force-add flow: pick the extra slot's week first — same week dropdown as
  // the plan's start week; the slot is due that week's Thursday.
  const [forceAddFor, setForceAddFor] = useState<Template | null>(null);
  const [forceWeek, setForceWeek] = useState(() =>
    planningWeekStartOf().toISOString(),
  );

  // Surface action errors as a toast — an uncaught throw inside the
  // transition would crash to the error boundary (digest page in prod).
  const { run: runForceAdd } = useActionHandler();
  const confirmForceAdd = () => {
    const target = forceAddFor;
    if (!target || !forceWeek) return;
    setForceAddFor(null);
    startForce(async () => {
      await runForceAdd("Force Add Slot", async () => {
        await forceAddWeeklySlot(projectId, target.id, new Date(forceWeek));
      });
    });
  };

  const toggleTemplate = (id: string) => {
    const next = templateIds.includes(id)
      ? templateIds.filter((t) => t !== id)
      : [...templateIds, id];
    onTemplateIdsChange(next);
    if (!templateIds.includes(id) && !plans[id]) {
      // New plans join the project's shared start week.
      const plan = { ...defaultPlan(id), startsOn: sharedStart };
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
        ...(plans[templateId] ?? defaultPlan(templateId)),
        ...patch,
      },
    });
  };

  // ONE start week for the whole project — every plan begins the same week,
  // only the per-week counts differ. Shown value: the earliest start among
  // active plans (when the first slots appear).
  const sharedStart = (() => {
    const starts = templateIds
      .map((id) => plans[id])
      .filter((p): p is WeeklyTarget => p != null)
      .map((p) => effectiveStartWeek(p).getTime());
    return starts.length > 0
      ? new Date(Math.min(...starts))
      : planningWeekStartOf();
  })();

  const setSharedStart = (v: string) => {
    const startsOn = new Date(v);
    const next: PlanState = { ...plans };
    for (const id of new Set([...Object.keys(plans), ...templateIds])) {
      next[id] = { ...(next[id] ?? defaultPlan(id)), startsOn };
    }
    onPlansChange(next);
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
      {/* One start week for every plan in the project. */}
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-surface px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium text-foreground">Starts</div>
          <div className="text-xxs text-muted-foreground">
            The week all plans begin creating slots — pick a later week to give
            the team time to prep the backlog first.
          </div>
        </div>
        <SearchableSelect
          value={sharedStart.toISOString()}
          onValueChange={setSharedStart}
          options={startWeekOptions(sharedStart)}
          placeholder="This week"
          className="h-9 w-56 shrink-0 text-xs"
        />
      </div>

      {templates.map((t) => {
        const active = templateIds.includes(t.id);
        const plan = plans[t.id] ?? defaultPlan(t.id);
        const val = plan.perWeek;
        const interval = plan.intervalWeeks || 1;
        const isExpanded = active && (expanded[t.id] ?? true);

        // Predicted hours this target costs the responsible member per week.
        const perTaskMin =
          plan.responsibleMemberId != null
            ? (effortMatrix?.perTaskMinutes[t.id]?.[plan.responsibleMemberId] ??
              null)
            : null;
        const weekMinutes =
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
                    {interval === 1 ? `${val}/wk` : `${val} / ${interval} wks`}
                  </span>
                )}
                {active && weekMinutes != null && (
                  <span
                    className="rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-xxs tabular-nums text-primary"
                    title="Predicted effort for the responsible member (2-min video baseline × their title rates)"
                  >
                    ≈ {formatEffortHours(weekMinutes)}
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
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-foreground">
                      Target
                    </div>
                    <div className="text-xxs text-muted-foreground">
                      {interval === 1
                        ? "Tasks to deliver per week (Sunday–Thursday, due Thursday end-of-day)."
                        : `Tasks to deliver on each planned week (due that week's Thursday end-of-day).`}
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
                      {interval === 1 ? "/ week" : `/ ${interval} weeks`}
                    </span>
                  </div>
                </div>

                {/* Cadence: how often a planned week comes around. Slots are
                    only created on active weeks — none in between. */}
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-foreground">
                      Frequency
                    </div>
                    <div className="text-xxs text-muted-foreground">
                      How often the tasks are created, counted from the start
                      week. Off-weeks get no slots.
                    </div>
                  </div>
                  <SearchableSelect
                    value={String(interval)}
                    onValueChange={(v) =>
                      patchPlan(t.id, { intervalWeeks: Number(v) || 1 })
                    }
                    options={INTERVAL_OPTIONS}
                    placeholder="Every week"
                    className="h-9 w-40 shrink-0 text-xs"
                  />
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
                    extra slot into any week.
                  </div>
                  {isOwner && (
                    <button
                      type="button"
                      disabled={forcePending}
                      onClick={() => {
                        setForceWeek(planningWeekStartOf().toISOString());
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
              Adds one extra {forceAddFor?.name} slot. Pick the week it books
              into — it&apos;s due that week&apos;s Thursday end-of-day.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-xxs font-medium text-muted-foreground">
              Week<span className="text-rose-400"> *</span>
            </Label>
            <SearchableSelect
              value={forceWeek}
              onValueChange={setForceWeek}
              options={startWeekOptions(new Date(forceWeek))}
              placeholder="This week"
              className="h-9 w-full text-xs"
            />
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
              disabled={!forceWeek || forcePending}
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

export { plansFromTargets, defaultPlan };
