import { CheckCircle2, Clock } from "lucide-react";
import { PublishAvatar } from "./publish-avatar";
import { type Item } from "./types";
import { DOW_SHORT, MONTHS, fmtShort, parseISO } from "./helpers";

export function ScheduleView({
  items,
  onSelect,
}: {
  items: Item[];
  onSelect: (id: string) => void;
}) {
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
      {sorted.length === 0 && (
        <div className="p-10 text-center text-sm text-muted-foreground">
          Nothing to publish in this range.
        </div>
      )}
    </div>
  );
}

function ScheduleRow({ item, onClick }: { item: Item; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border/60 bg-surface p-3 text-left transition-colors hover:border-border"
    >
      <PublishAvatar name={item.project.name} thumbnailId={item.project.thumbnailId} size={36} />
      <div className="min-w-0">
        <div dir="rtl" className="truncate text-right text-sm font-semibold">
          {item.title}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-tiny text-muted-foreground">
          <span className="font-medium text-foreground/80">{item.handle}</span>
          <span className="inline-flex items-center gap-1 text-success">
            <CheckCircle2 className="size-3" />
            Delivered {fmtShort(parseISO(item.deliveredOn))}
          </span>
        </div>
      </div>
      <div className="hidden items-center gap-1.5 rounded-full border border-border/70 px-2.5 py-1 text-tiny text-muted-foreground sm:inline-flex">
        <Clock className="size-3" />
        Scheduled
      </div>
    </button>
  );
}
