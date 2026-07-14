"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  Check,
  CheckSquare,
  ClipboardCheck,
  Clock,
  FileText,
} from "lucide-react";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AppHeader } from "@/components/app-header";
import { ProjectPhotoButton } from "@/components/projects/project-photo-button";
import { Section } from "@/components/project-settings/section";
import {
  PlanningTemplatesSection,
  plansFromTargets,
  serializePlans,
} from "@/components/project-settings/planning-templates-section";
import { cn } from "@/lib/utils";
import {
  updateProjectDescription,
  updateProjectRequirePublishing,
  updateProjectStatus,
  updateProjectTemplates,
  updateProjectTimezone,
} from "@/actions/projects";
import { setWeeklyTargets } from "@/actions/weekly-plan";
import type { PlanningEligibleMember, WeeklyEffortMatrix } from "@/actions/weekly-plan";
import { useActionHandler } from "@/hooks/use-action";
import type { WeeklyTarget } from "@/lib/weekly-plan";
import {
  DEFAULT_PROJECT_TIMEZONE,
  PROJECT_TIMEZONE_OPTIONS,
} from "@/lib/timezone";

type ProjectStatusOption = { id: string; name: string; color: string };

type Template = {
  id: string;
  name: string;
  itemCount: number;
};

const STATUS_TONES: Record<string, string> = {
  Active: "text-primary border-primary/40 bg-primary/10",
  "On Hold": "text-amber-400 border-amber-500/30 bg-amber-500/10",
  Completed: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  Cancelled: "text-rose-400 border-rose-500/30 bg-rose-500/10",
};

export function ProjectSettingsClient({
  projectId,
  projectName,
  thumbnailId,
  currentStatusId,
  description: initialDescription,
  requirePublishing: initialRequirePublishing,
  templateIds: initialTemplateIds,
  projectStatuses,
  templates,
  weeklyTargets: initialWeeklyTargets,
  eligibleMembers,
  effortMatrix,
  timezone: initialTimezone,
  isOwner,
}: {
  projectId: string;
  projectName: string;
  thumbnailId: string | null;
  currentStatusId: string | null;
  description: string;
  requirePublishing: boolean;
  templateIds: string[];
  projectStatuses: ProjectStatusOption[];
  templates: Template[];
  weeklyTargets: WeeklyTarget[];
  eligibleMembers: PlanningEligibleMember[];
  effortMatrix: WeeklyEffortMatrix;
  timezone: string;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [statusId, setStatusId] = useState(currentStatusId);
  const [description, setDescription] = useState(initialDescription);
  const [requirePublishing, setRequirePublishing] = useState(
    initialRequirePublishing,
  );
  const [templateIds, setTemplateIds] = useState(initialTemplateIds);
  const [timezone, setTimezone] = useState(
    initialTimezone || DEFAULT_PROJECT_TIMEZONE,
  );
  const [plans, setPlans] = useState(() => plansFromTargets(initialWeeklyTargets));

  const initialPlansKey = serializePlans(plansFromTargets(initialWeeklyTargets));
  const plansDirty = serializePlans(plans) !== initialPlansKey;

  const dirty =
    statusId !== currentStatusId ||
    description !== initialDescription ||
    requirePublishing !== initialRequirePublishing ||
    templateIds.join(",") !== initialTemplateIds.join(",") ||
    timezone !== initialTimezone ||
    plansDirty;

  // Action errors (e.g. plan validation) must surface as a toast — an
  // uncaught throw inside the transition would crash to the error boundary
  // and production hides the message behind a digest.
  const { run: runSave } = useActionHandler();
  const save = () => {
    startTransition(async () => {
      await runSave("Save Project Settings", async () => {
        // Server re-validates, but catching it here gives a readable message
        // instead of a round trip that fails.
        const missingResponsible = Object.values(plans).find(
          (p) =>
            p.perWeek > 0 &&
            templateIds.includes(p.templateId) &&
            !p.responsibleMemberId,
        );
        if (missingResponsible && plansDirty) {
          throw new Error(
            "Select a responsible team member for each active plan",
          );
        }
        if (statusId !== currentStatusId && statusId) {
          await updateProjectStatus(projectId, statusId);
        }
        if (description !== initialDescription) {
          await updateProjectDescription(projectId, description);
        }
        if (requirePublishing !== initialRequirePublishing) {
          await updateProjectRequirePublishing(projectId, requirePublishing);
        }
        if (templateIds.join(",") !== initialTemplateIds.join(",")) {
          await updateProjectTemplates(projectId, templateIds);
        }
        if (timezone !== initialTimezone) {
          await updateProjectTimezone(projectId, timezone);
        }
        if (plansDirty) {
          await setWeeklyTargets(
            projectId,
            Object.values(plans).filter(
              (p) => p.perWeek > 0 && templateIds.includes(p.templateId),
            ),
          );
        }
        router.refresh();
      });
    });
  };

  return (
    <>
      <AppHeader
        backHref={`/projects/${projectId}`}
        title="Project Settings"
        leading={
          <ProjectPhotoButton
            projectId={projectId}
            name={projectName}
            thumbnailId={thumbnailId}
          />
        }
        actions={
          dirty ? (
            <Button onClick={save} disabled={pending} size="sm">
              {pending ? "Saving..." : "Save Changes"}
            </Button>
          ) : undefined
        }
      />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-6 p-5 pb-10">
          <Section
            icon={<Activity className="size-4" />}
            title="Project Status"
            hint="Set the current status of this project."
          >
            <div className="flex flex-wrap gap-2">
              {projectStatuses.map((s) => {
                const active = statusId === s.id;
                const tone =
                  STATUS_TONES[s.name] ??
                  "text-foreground border-border/60 bg-surface";
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStatusId(s.id)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all",
                      active
                        ? tone
                        : "border-border/60 bg-surface text-muted-foreground hover:border-border hover:text-foreground",
                    )}
                  >
                    {active && <Check className="size-3" />}
                    {s.name}
                  </button>
                );
              })}
            </div>
          </Section>

          <Section
            icon={<FileText className="size-4" />}
            title="Project Description"
            hint="Add a description to help your team understand this project."
          >
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              className="resize-none rounded-xl border-border/60 bg-background/60 text-sm leading-relaxed"
              placeholder="What is this project about?"
            />
            <div className="mt-2 text-right text-tiny text-muted-foreground">
              {description.length} chars
            </div>
          </Section>

          <Section
            icon={<ClipboardCheck className="size-4" />}
            title="Require Publishing"
            hint="When enabled, completed tasks must go through a publishing step before they are finalized."
          >
            <div className="flex items-center justify-between rounded-xl border border-border/60 bg-surface px-4 py-3">
              <div className="text-sm">
                <div className="font-medium">
                  {requirePublishing
                    ? "Publishing required"
                    : "Publishing optional"}
                </div>
                <div className="text-xs text-muted-foreground">
                  Tasks marked complete{" "}
                  {requirePublishing
                    ? "await publish approval"
                    : "are finalized immediately"}
                  .
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={requirePublishing}
                onClick={() => setRequirePublishing((v) => !v)}
                className={cn(
                  "relative h-6 w-11 shrink-0 rounded-full border transition-colors",
                  requirePublishing
                    ? "border-primary/60 bg-primary"
                    : "border-border bg-surface",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                    requirePublishing && "translate-x-5",
                  )}
                />
              </button>
            </div>
          </Section>

          <Section
            icon={<Clock className="size-4" />}
            title="Project Timezone"
            hint="Weekly planning and schedule times use this timezone for the whole team."
          >
            <SearchableSelect
              value={timezone}
              onValueChange={setTimezone}
              options={PROJECT_TIMEZONE_OPTIONS.map((o) => ({
                value: o.value,
                label: o.label,
              }))}
              placeholder="Asia/Kuwait"
              className="h-9 text-xs"
            />
          </Section>

          <Section
            icon={<CheckSquare className="size-4" />}
            title="Checklist Templates"
            hint="Turn on the templates that apply to this project. Expand any active template to set how many tasks it should deliver per week."
          >
            <PlanningTemplatesSection
              projectId={projectId}
              templates={templates}
              templateIds={templateIds}
              initialTargets={initialWeeklyTargets}
              eligibleMembers={eligibleMembers}
              effortMatrix={effortMatrix}
              timezone={timezone}
              isOwner={isOwner}
              onTemplateIdsChange={setTemplateIds}
              onPlansChange={setPlans}
              plans={plans}
            />
          </Section>
        </div>
      </main>
    </>
  );
}
