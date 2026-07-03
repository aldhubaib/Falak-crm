import { cn } from "@/lib/utils";
import { type Item } from "./types";
import { DOW_SHORT, DOW_TINY, parseISO, sameDay, startOfWeek } from "./helpers";
import { EventPill } from "./event-pill";

export function MonthView({
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
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const gridStart = startOfWeek(first);
  const days: Date[] = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });

  return (
    <div className="flex h-full flex-col">
      <div className="grid grid-cols-7 border-b border-border/60 bg-background/60 text-tiny font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {DOW_SHORT.map((d, i) => (
          <div key={d} className="px-2 py-2 text-center sm:text-left sm:px-3">
            <span className="hidden sm:inline">{d}</span>
            <span className="sm:hidden">{DOW_TINY[i]}</span>
          </div>
        ))}
      </div>
      <div className="grid flex-1 auto-rows-fr grid-cols-7">
        {days.map((d) => {
          const inMonth = d.getMonth() === cursor.getMonth();
          const isToday = sameDay(d, today);
          const dayItems = items.filter(
            (it) => it.publishOn && sameDay(parseISO(it.publishOn), d),
          );
          return (
            <button
              type="button"
              key={d.toISOString()}
              onClick={() => onDateClick(d)}
              className={cn(
                "group flex min-h-0 flex-col overflow-hidden border-b border-r border-border/50 p-1.5 text-left transition-colors hover:bg-surface/60 sm:p-2",
                !inMonth && "bg-surface-dim text-muted-foreground/40 hover:bg-surface-dim-hover",
              )}
            >
              <div className="mb-1 flex items-center justify-end sm:justify-start">
                <span
                  className={cn(
                    "grid size-6 place-items-center rounded-full text-tiny font-medium sm:text-xs",
                    isToday
                      ? "bg-primary text-primary-foreground"
                      : inMonth
                        ? dayItems.length > 0
                          ? "text-primary"
                          : "text-foreground/90"
                      : "text-muted-foreground/30",
                  )}
                >
                  {d.getDate()}
                </span>
              </div>
              <div className="pointer-events-none flex flex-1 items-center justify-center">
                {dayItems.length > 0 && (
                  <>
                    {/* Mobile: single "+N" pill */}
                    <div
                      className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-tiny font-semibold text-primary-foreground md:hidden"
                      aria-label={`${dayItems.length} tasks`}
                    >
                      +{dayItems.length}
                    </div>
                    {/* Tablet: 1 avatar + overflow pill */}
                    <div className="hidden items-center md:flex lg:hidden">
                      <EventPill item={dayItems[0]} />
                      {dayItems.length > 1 && (
                        <div
                          className="-ml-2 grid size-8 shrink-0 place-items-center rounded-full bg-primary text-tiny font-semibold text-primary-foreground ring-2 ring-background"
                          aria-label={`${dayItems.length - 1} more`}
                        >
                          +{dayItems.length - 1}
                        </div>
                      )}
                    </div>
                    {/* Desktop: up to 3 avatars + overflow pill */}
                    <div className="hidden items-center lg:flex">
                      {(() => {
                        const max = 3;
                        const overflow = dayItems.length > max;
                        const visible = overflow ? dayItems.slice(0, max) : dayItems;
                        const extra = dayItems.length - visible.length;
                        return (
                          <>
                            {visible.map((it, i) => (
                              <EventPill
                                key={it.id}
                                item={it}
                                className={i === 0 ? "" : "-ml-2"}
                              />
                            ))}
                            {overflow && (
                              <div
                                className="-ml-2 grid size-8 shrink-0 place-items-center rounded-full bg-primary text-tiny font-semibold text-primary-foreground ring-2 ring-background"
                                aria-label={`${extra} more`}
                              >
                                +{extra}
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
