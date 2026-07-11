"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import { PageContainer } from "@/components/page-container";
import { Input } from "@/components/ui/input";
import { getWorkloadReport } from "@/actions/effort";
import type { WorkloadPerson, WorkloadReport, WorkloadRow } from "@/lib/workload-report";
import type { EffortFlag } from "@/lib/effort";
import { DEFAULT_TYPE_COLOR, TypeIcon } from "@/components/task-types/task-type-visuals";

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
  if (min == null || !Number.isFinite(min) || min < 0) return "—";
  if (min < 1 / 60) return "<0.01m";
  if (min < 60) return `${Math.round(min * 100) / 100}m`;
  const h = Math.floor(min / 60);
  const m = Math.floor(min - h * 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function formatQty(row: WorkloadRow): string {
  if (row.quantity == null) return "—";
  const qty =
    row.unit === "words" || row.unit === "fixed" || row.unit === "pass"
      ? String(Math.round(row.quantity))
      : String(Math.round(row.quantity * 100) / 100);
  return `${qty} ${UNIT_LABELS[row.unit] ?? row.unit}`;
}

function formatRate(row: WorkloadRow): string {
  if (row.rate == null) return "—";
  const rate = Math.round(row.rate * 100) / 100;
  if (row.unit === "words") {
    return `${Math.round(row.rate * 100 * 100) / 100} min/100 words`;
  }
  if (row.unit === "audio_min") return `${rate} min/audio min`;
  if (row.unit === "video_min") return `${rate} min/video min`;
  return `${rate} min/${UNIT_LABELS[row.unit] ?? row.unit}`;
}

const DATE_FMT = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });

function PersonAvatar({ name, imageUrl }: { name: string; imageUrl: string | null }) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={name}
        className="size-10 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
      {initialsOf(name)}
    </span>
  );
}

function ReportRow({ row }: { row: WorkloadRow }) {
  const accent = row.typeColor ?? DEFAULT_TYPE_COLOR;
  return (
    <div className="border-t border-border/40 px-4 py-3">
      <div className="flex items-start gap-3">
        <div
          className="grid size-9 shrink-0 place-items-center rounded-md"
          style={{ backgroundColor: `${accent}1f`, color: accent }}
        >
          <TypeIcon name={row.typeIcon} className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">
            {row.kind === "review" ? `${row.label} — review pass` : row.taskTitle}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            {row.typeName && (
              <span className="font-medium" style={{ color: accent }}>
                {row.typeName}
              </span>
            )}
            <span>{row.projectName}</span>
            {row.kind === "field" && (
              <span className="text-muted-foreground/80">{row.label}</span>
            )}
            <span>{formatQty(row)}</span>
            <span>× {formatRate(row)}</span>
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
        <div className="shrink-0 text-right">
          <div className="text-sm font-semibold tabular-nums">
            {formatMinutes(row.minutes)}
          </div>
          <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {DATE_FMT.format(new Date(row.date))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PersonGroup({ person }: { person: WorkloadPerson }) {
  const [open, setOpen] = useState(true);

  const percent =
    person.capacityMinutes && person.capacityMinutes > 0
      ? Math.round((person.minutes / person.capacityMinutes) * 100)
      : null;

  return (
    <div className="overflow-hidden rounded-card border border-border/60 bg-surface">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-background/40"
      >
        <PersonAvatar name={person.name} imageUrl={person.imageUrl} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{person.name}</div>
          <div className="truncate text-xs text-muted-foreground">
            {person.taskCount} task{person.taskCount === 1 ? "" : "s"}
            {percent != null && <> · {percent}% of range</>}
            {person.titleName && <> · {person.titleName}</>}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Subtotal
          </div>
          <div className="text-sm font-bold tabular-nums">
            {formatMinutes(person.minutes)}
          </div>
        </div>
        <span
          aria-hidden
          className="grid h-6 w-6 shrink-0 place-items-center text-muted-foreground"
        >
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>
      {open &&
        person.rows.map((row, i) => (
          <ReportRow key={`${row.taskId}-${row.kind}-${row.label}-${i}`} row={row} />
        ))}
    </div>
  );
}

export function WorkloadClient({
  initialFrom,
  initialTo,
  initialReport,
}: {
  initialFrom: string;
  initialTo: string;
  initialReport: WorkloadReport;
}) {
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [report, setReport] = useState<WorkloadReport>(initialReport);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const mounted = useRef(false);

  useEffect(() => {
    // The server already rendered the initial range — only refetch on change.
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (!from || !to) return;
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    getWorkloadReport(from, to)
      .then((data) => {
        if (id !== requestId.current) return;
        setReport(data);
      })
      .catch((e) => {
        if (id !== requestId.current) return;
        setError(e instanceof Error ? e.message : "Failed to load the report");
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
  }, [from, to]);

  return (
    <PageContainer className="mx-auto max-w-3xl space-y-4 pb-10">
      <div className="flex flex-wrap items-center gap-4 rounded-card border border-border/60 bg-surface p-4">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-black text-white">
          <BarChart3 className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium">Workload Report</div>
          <div className="text-xs text-muted-foreground">
            Everyone&apos;s task involvement between the two dates.
          </div>
        </div>
        <div className="flex items-end gap-3">
          <label className="block">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              From
            </div>
            <Input
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
              className="h-9 w-36"
            />
          </label>
          <label className="block">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              To
            </div>
            <Input
              type="date"
              value={to}
              min={from}
              onChange={(e) => setTo(e.target.value)}
              className="h-9 w-36"
            />
          </label>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Building the report…
        </div>
      )}

      {!loading && report.people.length === 0 && !error && (
        <div className="rounded-card border border-border/60 bg-surface p-8 text-center text-sm text-muted-foreground">
          No effort was recorded between these dates.
        </div>
      )}

      {!loading &&
        report.people.map((person) => (
          <PersonGroup key={person.memberId} person={person} />
        ))}

      {!loading && report.people.length > 0 && (
        <div className="rounded-card border border-border/60 bg-surface px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex-1 text-sm font-medium">Range total</div>
            <div className="text-base font-bold tabular-nums">
              {formatMinutes(report.totalMinutes)}
            </div>
          </div>
          {report.hasFlags && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-500">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              Some rows can&apos;t be costed — assign a title with rates in
              Settings → Titles and link it to the doer in Settings → Team.
            </div>
          )}
        </div>
      )}
    </PageContainer>
  );
}
