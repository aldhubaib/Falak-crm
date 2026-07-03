import { cn } from "@/lib/utils";
import { type Item } from "./types";
import { DOW_SHORT, parseISO, sameDay, startOfWeek } from "./helpers";
import { EventPill } from "./event-pill";

export function WeekView({
  cursor,
  today,
  items,
  onSelect,
  onDateClick,
}: {
  cursor: Date;
  today: Date;
  items: Item[];
  onSelect: (id: string) => void;
  onDateClick: (d: Date) => void;
}) {
  const start = startOfWeek(cursor);
  const days: Date[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });

  return (
    <div className="min-w-[720px] sm:min-w-0">
      <div className="grid grid-cols-7 border-b border-border/60">
        {days.map((d) => {
          const isToday = sameDay(d, today);
          return (
            <div
              key={d.toISOString()}
              className="border-r border-border/50 px-3 py-3 text-center last:border-r-0"
            >
              <div className="text-xxs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {DOW_SHORT[d.getDay()]}
              </div>
              <div
                className={cn(
                  "mx-auto mt-1 grid size-8 place-items-center rounded-full text-sm font-semibold",
                  isToday && "bg-primary text-primary-foreground",
                )}
              >
                {d.getDate()}
              </div>
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const dayItems = items.filter(
            (it) => it.publishOn && sameDay(parseISO(it.publishOn), d),
          );
          return (
            <button
              type="button"
              key={d.toISOString()}
              onClick={() => onDateClick(d)}
              className="flex min-h-[420px] flex-col gap-2 border-r border-border/50 p-2 text-left transition-colors hover:bg-surface/60 last:border-r-0"
            >
              {dayItems.length === 0 ? (
                <div className="grid flex-1 place-items-center text-xs text-muted-foreground/50">
                  +
                </div>
              ) : (
                <div className="pointer-events-none space-y-2">
                  {dayItems.map((it) => (
                    <EventPill key={it.id} item={it} />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
