"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  Check,
  CheckSquare,
  ChevronRight,
  ClipboardCheck,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Section } from "@/components/project-settings/section";
import { cn } from "@/lib/utils";
import {
  updateProjectDescription,
  updateProjectRequirePublishing,
  updateProjectStatus,
  updateProjectTemplates,
} from "@/actions/projects";

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
  currentStatusId,
  description: initialDescription,
  requirePublishing: initialRequirePublishing,
  templateIds: initialTemplateIds,
  projectStatuses,
  templates,
}: {
  projectId: string;
  currentStatusId: string | null;
  description: string;
  requirePublishing: boolean;
  templateIds: string[];
  projectStatuses: ProjectStatusOption[];
  templates: Template[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [statusId, setStatusId] = useState(currentStatusId);
  const [description, setDescription] = useState(initialDescription);
  const [requirePublishing, setRequirePublishing] = useState(
    initialRequirePublishing,
  );
  const [templateIds, setTemplateIds] = useState(initialTemplateIds);

  const dirty =
    statusId !== currentStatusId ||
    description !== initialDescription ||
    requirePublishing !== initialRequirePublishing ||
    templateIds.join(",") !== initialTemplateIds.join(",");

  const save = () => {
    startTransition(async () => {
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
      router.refresh();
    });
  };

  const toggleTemplate = (id: string) => {
    setTemplateIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-5 pb-10">
      {/* Save bar */}
      {dirty && (
        <div className="flex justify-end">
          <Button onClick={save} disabled={pending} size="sm">
            {pending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      )}

      {/* Project Status */}
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

      {/* Description */}
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

      {/* Require Publishing */}
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

      {/* Checklist Templates */}
      <Section
        icon={<CheckSquare className="size-4" />}
        title="Checklist Templates"
        hint="Select which checklist templates apply to tasks in this project. When a new task is created, all items from linked templates will be added automatically."
      >
        <div className="space-y-2">
          {templates.length === 0 && (
            <div className="py-4 text-center text-xs text-muted-foreground">
              No templates yet.
            </div>
          )}
          {templates.map((t) => {
            const active = templateIds.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => toggleTemplate(t.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all",
                  active
                    ? "border-primary/50 bg-primary/5"
                    : "border-border/60 bg-surface hover:border-border",
                )}
              >
                <span
                  className={cn(
                    "grid size-5 shrink-0 place-items-center rounded-md border transition-colors",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border",
                  )}
                >
                  {active && <Check className="size-3.5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{t.name}</span>
                    <span className="rounded-md bg-muted/40 px-1.5 py-0.5 text-xxs text-muted-foreground">
                      {t.itemCount} items
                    </span>
                  </div>
                </div>
                <ChevronRight className="size-4 text-muted-foreground" />
              </button>
            );
          })}
        </div>
      </Section>
    </div>
  );
}
