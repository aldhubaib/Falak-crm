import { useState } from "react";
import { CalendarOff, Check, ChevronDown, Clock } from "lucide-react";
import { PublishAvatar } from "./publish-avatar";
import { cn } from "@/lib/utils";
import { type Item } from "./types";
import { DOW_SHORT, MONTHS, parseISO } from "./helpers";

export function ScheduleView({
  items,
  onSelect,
}: {
  items: Item[];
  onSelect: (id: string) => void;
}) {
  const [noDateOpen, setNoDateOpen] = useState(true);

  const unscheduled = items.filter((i) => !i.publishOn);
  const sorted = [...items]
    .filter((i) => i.publishOn)
    .sort(
      (a, b) => parseISO(a.publishOn!).getTime() - parseISO(b.publishOn!).getTime(),
    );
  const groups = new Map<string, Item[]>();
  for (const it of sorted) {
    const arr = groups.get(it.publishOn!) ?? [];
    arr.push(it);
    groups.set(it.publishOn!, arr);
  }

  return (
    <div className="divide-y divide-border/60">
      {unscheduled.length > 0 && (
        <section className="px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={() => setNoDateOpen((v) => !v)}
            aria-expanded={noDateOpen}
            className="flex w-full items-center gap-2 py-1 text-destructive"
          >
            <CalendarOff className="size-4" />
            <span className="text-tiny font-semibold uppercase tracking-[0.16em]">
              No date · {unscheduled.length}
            </span>
            <ChevronDown
              className={cn(
                "ml-auto size-4 text-muted-foreground transition-transform",
                !noDateOpen && "-rotate-90",
              )}
            />
          </button>
          {noDateOpen && (
            <ul className="mt-2 space-y-2">
              {unscheduled.map((it) => (
                <li key={it.id}>
                  <ScheduleRow item={it} noDate onClick={() => onSelect(it.id)} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {[...groups.entries()].map(([date, list]) => {
        const d = parseISO(date);
        return (
          <section key={date} className="px-4 py-4 sm:px-6">
            <div className="mb-3 flex items-baseline gap-3">
              <div className="text-2xl font-bold tabular-nums sm:text-3xl">
                {d.getDate()}
              </div>
              <div className="text-tiny font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {DOW_SHORT[d.getDay()]}, {MONTHS[d.getMonth()].slice(0, 3)}
              </div>
            </div>
            <ul className="space-y-2">
              {list.map((it) => (
                <li key={it.id}>
                  <ScheduleRow item={it} onClick={() => onSelect(it.id)} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {sorted.length === 0 && unscheduled.length === 0 && (
        <div className="p-10 text-center text-sm text-muted-foreground">
          Nothing to publish in this range.
        </div>
      )}
    </div>
  );
}

function ScheduleRow({
  item,
  noDate = false,
  onClick,
}: {
  item: Item;
  noDate?: boolean;
  onClick?: () => void;
}) {
  const isPublished = item.status === "published";
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border/60 bg-surface p-3 text-left transition-colors hover:border-border"
    >
      <PublishAvatar name={item.project.name} thumbnailId={item.project.thumbnailId} size={36} />
      <div className="min-w-0">
        <div className="truncate text-tiny text-muted-foreground">
          @{item.project.name}
        </div>
        <div dir="auto" className="mt-0.5 truncate text-sm font-semibold">
          {item.title}
        </div>
      </div>
      {noDate ? (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-destructive/60 px-2.5 py-1 text-tiny text-destructive">
          <CalendarOff className="size-3" />
          No date
        </span>
      ) : isPublished ? (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-success/60 px-2.5 py-1 text-tiny text-success">
          <Check className="size-3" />
          Published
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 px-2.5 py-1 text-tiny text-muted-foreground">
          <Clock className="size-3" />
          Scheduled
        </span>
      )}
    </button>
  );
}
