"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Calculator,
  ChevronDown,
  ChevronUp,
  Clock,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { getTaskEffort } from "@/actions/effort";
import type { EffortFlag, EffortPerson, EffortRow, TaskEffort } from "@/lib/effort";

const FLAG_LABELS: Record<EffortFlag, string> = {
  no_rate: "No rate for this title",
  no_title: "Doer has no title",
  unknown_duration: "Media duration unknown",
  no_member: "No one attributed",
};

const UNIT_LABELS: Record<string, string> = {
  words: "words",
  audio_min: "audio min",
  video_min: "video min",
  fixed: "item",
  pass: "pass",
};

function initialsOf(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("") || "?"
  );
}

function formatMinutes(min: number | null): string {
  if (min == null) return "—";
  if (!Number.isFinite(min) || min < 0) return "—";
  if (min < 1 / 60) return "<0.01m";

  // Under an hour, show decimal minutes to match audio/video input (e.g. 2.46m).
  if (min < 60) {
    const rounded = Math.round(min * 100) / 100;
    return `${rounded}m`;
  }

  const h = Math.floor(min / 60);
  const m = Math.floor(min - h * 60);
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatQty(row: EffortRow): string {
  if (row.quantity == null) return "—";
  const qty =
    row.unit === "words" || row.unit === "fixed" || row.unit === "pass"
      ? String(Math.round(row.quantity))
      : String(Math.round(row.quantity * 100) / 100);
  return `${qty} ${UNIT_LABELS[row.unit] ?? row.unit}`;
}

function formatRate(row: EffortRow): string {
  if (row.rate == null) return "—";
  const rate = Math.round(row.rate * 100) / 100;
  if (row.unit === "words") {
    return `${Math.round(row.rate * 100 * 100) / 100} min / 100 words`;
  }
  if (row.unit === "audio_min") {
    return `${rate} min / 1 min audio`;
  }
  if (row.unit === "video_min") {
    return `${rate} min / 1 min video`;
  }
  const unit = UNIT_LABELS[row.unit] ?? row.unit;
  return `${rate} min / ${unit}`;
}

function PersonAvatar({
  name,
  imageUrl,
}: {
  name: string;
  imageUrl: string | null;
}) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={name}
        className="size-9 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
      {initialsOf(name)}
    </span>
  );
}

// One person's card: header always visible (avatar, name, subtotal), field
// rows fold away — tasks with many contributors stay scannable.
function PersonCard({ person }: { person: EffortPerson }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="overflow-hidden rounded-lg border border-border/50 bg-background/40">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface/70"
      >
        <PersonAvatar name={person.name} imageUrl={person.imageUrl} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{person.name}</div>
          {person.titleName && (
            <div className="truncate text-xs text-muted-foreground">
              {person.titleName}
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {open
              ? "Subtotal"
              : `${person.rows.length} field${person.rows.length === 1 ? "" : "s"}`}
          </div>
          <div className="text-sm font-bold tabular-nums">
            {formatMinutes(person.minutes)}
          </div>
        </div>
        <span
          aria-hidden
          className="grid h-6 w-6 shrink-0 place-items-center text-muted-foreground"
        >
          {open ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </span>
      </button>
      {open &&
        person.rows.map((row, i) => (
          <FieldRow key={`${person.memberId}-${row.label}-${i}`} row={row} />
        ))}
    </div>
  );
}

function FieldRow({ row }: { row: EffortRow }) {
  return (
    <div className="border-t border-border/40 px-4 py-2.5 first:border-t-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">{row.label}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {formatQty(row)} × {formatRate(row)}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {row.basis === "actual" && (
            <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
              Actual
            </span>
          )}
          <div className="w-14 text-right text-sm font-semibold tabular-nums">
            {formatMinutes(row.minutes)}
          </div>
        </div>
      </div>
      {row.flags.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {row.flags.map((f) => (
            <span
              key={f}
              className="flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-500"
            >
              <AlertTriangle className="h-3 w-3" />
              {FLAG_LABELS[f]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function EffortDialog({
  taskId,
  open,
  onOpenChange,
}: {
  taskId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [effort, setEffort] = useState<TaskEffort | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0);

  const loadEffort = useCallback(() => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);

    return getTaskEffort(taskId)
      .then((data) => {
        if (id !== requestId.current) return;
        setEffort(data);
      })
      .catch((e) => {
        if (id !== requestId.current) return;
        setError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
  }, [taskId]);

  useEffect(() => {
    if (!open) return;
    setEffort(null);
    void loadEffort();
  }, [open, loadEffort]);

  const stageRows = effort?.rows.filter((r) => r.kind === "stage") ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="size-4" />
            Effort breakdown
          </DialogTitle>
          <DialogDescription>
            Effort = uploaded content length × the doer&apos;s title rate.
            While the task is in progress, numbers update live when you change
            rates. After the task is completed, effort locks — apply new rates
            from Settings → Titles → Recalculate.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Calculating…
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {effort && !loading && (
          <div className="space-y-4">
            {effort.people.length === 0 && stageRows.length === 0 && (
              <div className="rounded-md border border-border/50 bg-background/40 p-4 text-center text-sm text-muted-foreground">
                No effort-bearing fields on this task. Set an effort measurement
                on the task type&apos;s fields in Settings → Task Types.
              </div>
            )}

            {effort.people.map((person) => (
              <PersonCard key={person.memberId} person={person} />
            ))}

            {stageRows.length > 0 && (
              <div className="overflow-hidden rounded-lg border border-border/50 bg-background/40">
                <div className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Review passes
                </div>
                {stageRows.map((row, i) => (
                  <FieldRow key={`stage-${i}`} row={row} />
                ))}
              </div>
            )}

            <div className="rounded-lg border border-border/60 bg-surface px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex-1 text-sm font-medium">Task total</div>
                <div className="text-base font-bold tabular-nums">
                  {formatMinutes(effort.totalMinutes)}
                </div>
              </div>
              <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="size-3.5 shrink-0" />
                From uploaded / filled content only
              </div>
              {effort.hasFlags && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-500">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  Some rows can&apos;t be costed — assign a title with rates in
                  Settings → Titles and link it to the doer in Settings → Team.
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
