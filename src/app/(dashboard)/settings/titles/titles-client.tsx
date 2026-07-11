"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BadgePlus,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Copy,
  Loader2,
  Pencil,
  RefreshCw,
  Trash2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageContainer } from "@/components/page-container";
import { SurfaceCard } from "@/components/surface-card";
import { EmptyState } from "@/components/empty-state";
import { AddItemInput } from "@/components/add-item-input";
import {
  createTitle,
  deleteTitle,
  duplicateTitle,
  renameTitle,
  setTitleFieldRate,
  setTitleStageRate,
  recalculateTitleEffort,
} from "@/actions/titles";
import { cn } from "@/lib/utils";

export type TitleDTO = {
  id: string;
  name: string;
  fieldRates: { templateItemId: string; minutesPerUnit: number }[];
  stageRates: { statusId: string; minutesPerPass: number }[];
};

export type TemplateDTO = {
  id: string;
  name: string;
  items: { id: string; name: string; effortUnit: string; phase: string }[];
};

export type StageDTO = { id: string; name: string; color: string };

// Words rates are stored per word but entered per 100 words — per-word numbers
// (0.097) are unreadable; "9.7 min per 100 words" is how people think.
const WORDS_DISPLAY_FACTOR = 100;

function rateUnitLabel(effortUnit: string): string {
  switch (effortUnit) {
    case "words":
      return "min / 100 words";
    case "audio_min":
      return "min / 1 min audio";
    case "video_min":
      return "min / 1 min video";
    default:
      return "min (flat)";
  }
}

export function TitlesClient({
  titles,
  templates,
  reviewStages,
  memberCounts,
  isOwner,
}: {
  titles: TitleDTO[];
  templates: TemplateDTO[];
  reviewStages: StageDTO[];
  memberCounts: Record<string, number>;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [toDelete, setToDelete] = useState<TitleDTO | null>(null);

  const addTitle = () => {
    const n = newName.trim();
    if (!n) {
      setError("Enter a title name");
      setShake((s) => s + 1);
      return;
    }
    if (titles.some((t) => t.name.toLowerCase() === n.toLowerCase())) {
      setError("A title with this name already exists");
      setShake((s) => s + 1);
      return;
    }
    startTransition(async () => {
      const result = await createTitle(n);
      if (result.ok) {
        setNewName("");
        setError(null);
        setExpanded(result.data);
        router.refresh();
      } else {
        setError(result.error.message);
        setShake((s) => s + 1);
      }
    });
  };

  const duplicate = (t: TitleDTO) => {
    startTransition(async () => {
      const result = await duplicateTitle(t.id);
      if (result.ok) {
        setExpanded(result.data);
        router.refresh();
      }
    });
  };

  const affected = toDelete ? (memberCounts[toDelete.id] ?? 0) : 0;
  const confirmDelete = () => {
    if (!toDelete) return;
    startTransition(async () => {
      await deleteTitle(toDelete.id);
      if (expanded === toDelete.id) setExpanded(null);
      setToDelete(null);
      router.refresh();
    });
  };

  return (
    <PageContainer className="mx-auto w-full max-w-5xl">
      <SurfaceCard padding="sm">
        <div className="mb-2 flex items-center gap-2 text-hint text-muted-foreground">
          <BadgePlus className="h-3.5 w-3.5" />
          Add a new title — titles hold effort rates, separate from permission roles
        </div>
        <AddItemInput
          key={shake}
          value={newName}
          onChange={(v) => {
            setNewName(v);
            if (error) setError(null);
          }}
          onAdd={addTitle}
          addLabel="Add title"
          placeholder="Title name (e.g. AI Creative Junior A)"
          inputClassName={cn(
            error &&
              "border-destructive text-destructive animate-shake focus-visible:ring-destructive/40",
          )}
        />
        {error && <div className="mt-2 text-hint text-destructive">{error}</div>}
      </SurfaceCard>

      {templates.length === 0 && (
        <SurfaceCard padding="sm">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
            No task-type fields have an effort measurement yet. Set one on each
            work field in Settings → Task Types, then calibrate rates here.
          </div>
        </SurfaceCard>
      )}

      {titles.map((t) => (
        <TitleCard
          key={t.id}
          title={t}
          templates={templates}
          reviewStages={reviewStages}
          count={memberCounts[t.id] ?? 0}
          expanded={expanded === t.id}
          onToggle={() => setExpanded(expanded === t.id ? null : t.id)}
          onDuplicate={() => duplicate(t)}
          onDelete={() => setToDelete(t)}
          isOwner={isOwner}
        />
      ))}
      {titles.length === 0 && <EmptyState message="No titles yet." />}

      <Dialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-destructive/15">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <DialogTitle>Delete title &quot;{toDelete?.name}&quot;?</DialogTitle>
            <DialogDescription>
              {affected > 0
                ? `${affected} member${affected === 1 ? "" : "s"} hold this title — they will be left without a title, and their work won't be costed until a new one is assigned.`
                : "All its rates will be removed. This action cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setToDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={pending}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

function TitleCard({
  title,
  templates,
  reviewStages,
  count,
  expanded,
  onToggle,
  onDuplicate,
  onDelete,
  isOwner,
}: {
  title: TitleDTO;
  templates: TemplateDTO[];
  reviewStages: StageDTO[];
  count: number;
  expanded: boolean;
  onToggle: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  isOwner: boolean;
}) {
  const totalFields = templates.reduce((n, t) => n + t.items.length, 0);
  const ratedFields = title.fieldRates.length;
  const missing = Math.max(0, totalFields - ratedFields) +
    Math.max(0, reviewStages.length - title.stageRates.length);

  return (
    <SurfaceCard padding="none" className="overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-surface/70"
      >
        <ClipboardList className="h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1 truncate font-medium">{title.name}</div>
        {missing > 0 ? (
          <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-500">
            {missing} not calibrated
          </span>
        ) : totalFields > 0 ? (
          <span className="flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            <CheckCheck className="h-3.5 w-3.5" />
            Calibrated
          </span>
        ) : null}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          {count}
        </div>
        <div className="flex items-center gap-1">
          {expanded && (
            <>
              <span
                role="button"
                aria-label="Duplicate title"
                title="Duplicate with all rates"
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicate();
                }}
                className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              >
                <Copy className="h-4 w-4" />
              </span>
              <span
                role="button"
                aria-label="Delete title"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </span>
            </>
          )}
          <span
            aria-hidden
            className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground"
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </span>
        </div>
      </button>

      {expanded && (
        <TitleEditor
          title={title}
          templates={templates}
          reviewStages={reviewStages}
          memberCount={count}
          isOwner={isOwner}
        />
      )}
    </SurfaceCard>
  );
}

function TitleEditor({
  title,
  templates,
  reviewStages,
  memberCount,
  isOwner,
}: {
  title: TitleDTO;
  templates: TemplateDTO[];
  reviewStages: StageDTO[];
  memberCount: number;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [recalculating, setRecalculating] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(title.name);
  const [recalcMessage, setRecalcMessage] = useState<string | null>(null);
  const [recalcError, setRecalcError] = useState<string | null>(null);
  const [confirmRecalc, setConfirmRecalc] = useState(false);

  const fieldRate = new Map(
    title.fieldRates.map((r) => [r.templateItemId, r.minutesPerUnit]),
  );
  const stageRate = new Map(
    title.stageRates.map((r) => [r.statusId, r.minutesPerPass]),
  );

  const saveName = () => {
    const v = name.trim();
    setRenaming(false);
    if (v && v !== title.name) {
      startTransition(async () => {
        await renameTitle(title.id, v);
        router.refresh();
      });
    }
  };

  const runRecalculate = () => {
    setConfirmRecalc(false);
    setRecalcMessage(null);
    setRecalcError(null);
    setRecalculating(true);
    void recalculateTitleEffort(title.id)
      .then((result) => {
        if (result.ok) {
          const { fieldCount, taskCount } = result.data;
          setRecalcMessage(
            fieldCount === 0
              ? "No saved effort found on completed tasks for this title."
              : `Updated ${fieldCount} saved field${fieldCount === 1 ? "" : "s"} across ${taskCount} completed task${taskCount === 1 ? "" : "s"}.`,
          );
        } else {
          setRecalcError(result.error.message);
        }
      })
      .finally(() => setRecalculating(false));
  };

  return (
    <div className="space-y-6 border-t border-border/60 p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        {renaming ? (
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveName();
              if (e.key === "Escape") {
                setName(title.name);
                setRenaming(false);
              }
            }}
            className="h-10 max-w-sm"
          />
        ) : (
          <>
            <div className="text-lg font-semibold">{title.name}</div>
            <button
              type="button"
              onClick={() => setRenaming(true)}
              aria-label="Rename"
              className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>

      {isOwner && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-border/50 bg-background/40 px-3 py-2.5">
          <div className="min-w-0 flex-1 text-sm text-muted-foreground">
            Updates saved effort on completed tasks only — fields done by
            {memberCount > 0
              ? ` the ${memberCount} member${memberCount === 1 ? "" : "s"} with this title.`
              : " members with this title (none assigned yet)."}
            {" "}In-progress tasks are not saved; they always show live rates from
            the numbers above.
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={recalculating || memberCount === 0}
            onClick={() => setConfirmRecalc(true)}
          >
            {recalculating ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            Recalculate old data
          </Button>
        </div>
      )}

      {recalcMessage && (
        <div className="rounded-md border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-primary">
          {recalcMessage}
        </div>
      )}
      {recalcError && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="size-4 shrink-0" />
          {recalcError}
        </div>
      )}

      {templates.map((tpl) => (
        <CollapsibleRateSection
          key={tpl.id}
          label={tpl.name}
          missingCount={tpl.items.filter((i) => fieldRate.get(i.id) == null).length}
        >
          {tpl.items.map((item) => (
            <RateRow
              key={item.id}
              label={item.name}
              unitLabel={rateUnitLabel(item.effortUnit)}
              value={fieldRate.get(item.id) ?? null}
              displayFactor={item.effortUnit === "words" ? WORDS_DISPLAY_FACTOR : 1}
              onSave={(minutes) =>
                startTransition(async () => {
                  await setTitleFieldRate(title.id, item.id, minutes);
                  router.refresh();
                })
              }
            />
          ))}
        </CollapsibleRateSection>
      ))}

      {reviewStages.length > 0 && (
        <CollapsibleRateSection
          label="Review stages — charged per pass"
          missingCount={reviewStages.filter((s) => stageRate.get(s.id) == null).length}
        >
          {reviewStages.map((stage) => (
            <RateRow
              key={stage.id}
              label={stage.name}
              unitLabel="min / pass"
              value={stageRate.get(stage.id) ?? null}
              displayFactor={1}
              onSave={(minutes) =>
                startTransition(async () => {
                  await setTitleStageRate(title.id, stage.id, minutes);
                  router.refresh();
                })
              }
            />
          ))}
        </CollapsibleRateSection>
      )}

      <Dialog open={confirmRecalc} onOpenChange={setConfirmRecalc}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recalculate effort for &quot;{title.name}&quot;?</DialogTitle>
            <DialogDescription>
              This rewrites saved effort snapshots on completed tasks only, using
              the rates shown above. Tasks still in progress are not stored and
              are not changed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmRecalc(false)}>
              Cancel
            </Button>
            <Button onClick={runRecalculate} disabled={recalculating}>
              Recalculate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// One task type's rate list (or the review-stages list) behind a collapsed
// header — titles can span many checklists, so everything starts folded.
function CollapsibleRateSection({
  label,
  missingCount,
  children,
}: {
  label: string;
  missingCount: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <section className="overflow-hidden rounded-lg border border-border/50">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 bg-background/40 px-3 py-2.5 text-left transition-colors hover:bg-surface/70"
      >
        <span className="min-w-0 flex-1 truncate text-xxs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </span>
        {missingCount > 0 ? (
          <span className="shrink-0 rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-500">
            {missingCount} not calibrated
          </span>
        ) : (
          <span className="flex shrink-0 items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            <CheckCheck className="h-3.5 w-3.5" />
            Calibrated
          </span>
        )}
        <span aria-hidden className="grid h-6 w-6 shrink-0 place-items-center text-muted-foreground">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>
      {open && <div className="space-y-1.5 border-t border-border/50 p-2">{children}</div>}
    </section>
  );
}

function RateRow({
  label,
  unitLabel,
  value,
  displayFactor,
  onSave,
}: {
  label: string;
  unitLabel: string;
  /** Stored rate (minutes per unit), null when not calibrated. */
  value: number | null;
  /** Display multiplier (words are stored per word, shown per 100 words). */
  displayFactor: number;
  onSave: (minutesPerUnit: number | null) => void;
}) {
  const displayValue =
    value != null ? String(Math.round(value * displayFactor * 100) / 100) : "";
  const [text, setText] = useState(displayValue);

  const commit = () => {
    const trimmed = text.trim();
    if (!trimmed) {
      if (value != null) onSave(null);
      return;
    }
    const parsed = Number.parseFloat(trimmed);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setText(displayValue);
      return;
    }
    const stored = parsed / displayFactor;
    if (stored !== value) onSave(stored);
  };

  return (
    <div className="flex items-center gap-3 rounded-md border border-border/50 bg-background/40 px-3 py-2">
      <div className="min-w-0 flex-1 truncate text-sm">{label}</div>
      {value == null && !text.trim() && (
        <span className="shrink-0 rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-500">
          Not calibrated
        </span>
      )}
      <Input
        type="number"
        min={0}
        step="any"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        placeholder="—"
        className="h-9 w-24 text-right"
      />
      <div className="w-28 shrink-0 text-xs text-muted-foreground">{unitLabel}</div>
    </div>
  );
}
