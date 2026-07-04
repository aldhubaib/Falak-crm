import { CheckCircle2, Clock, Inbox } from "lucide-react";
import { PublishAvatar } from "./publish-avatar";
import { cn } from "@/lib/utils";
import { type Item } from "./types";
import { fmtShort, groupByProject, parseISO } from "./helpers";

export function QueueView({
  items,
  onSelect,
}: {
  items: Item[];
  onSelect: (id: string) => void;
}) {
  const pending = items.filter((i) => i.status !== "published");
  const unscheduledCount = pending.filter((i) => !i.publishOn).length;
  const scheduledCount = pending.filter((i) => !!i.publishOn).length;
  const groups = groupByProject(pending).map((g) => ({
    project: g.project,
    list: [...g.items].sort((a, b) => {
      const at = a.publishOn ? parseISO(a.publishOn).getTime() : Infinity;
      const bt = b.publishOn ? parseISO(b.publishOn).getTime() : Infinity;
      return at - bt;
    }),
  }));

  if (groups.length === 0) {
    return (
      <div className="p-10 text-center text-sm text-muted-foreground">
        Nothing waiting to publish.
      </div>
    );
  }

  return (
    <div className="divide-y divide-border/60">
      <div className="flex items-center gap-2 px-4 py-3 sm:px-6">
        <span
          className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-surface px-2.5 py-1 text-tiny font-medium text-muted-foreground"
          title={`${unscheduledCount} unscheduled`}
          aria-label={`${unscheduledCount} unscheduled`}
        >
          <Inbox className="size-3.5" />
          {unscheduledCount}
        </span>
        <span
          className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-tiny font-medium text-primary"
          title={`${scheduledCount} scheduled`}
          aria-label={`${scheduledCount} scheduled`}
        >
          <Clock className="size-3.5" />
          {scheduledCount}
        </span>
      </div>
      {groups.map(({ project, list }) => (
        <section key={project.id} className="px-4 py-4 sm:px-6">
          <div className="mb-3 flex items-center gap-2.5">
            <PublishAvatar name={project.name} thumbnailId={project.thumbnailId} size={24} />
            <div className="text-sm font-semibold">{project.name}</div>
            <span className="text-tiny text-muted-foreground">({list.length})</span>
          </div>
          <ul className="space-y-2">
            {list.map((it) => (
              <li key={it.id}>
                <button
                  type="button"
                  onClick={() => onSelect(it.id)}
                  className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border/60 bg-surface p-3 text-left transition-colors hover:border-border"
                >
                  <div className="min-w-0">
                    <div dir="rtl" className="truncate text-right text-sm font-semibold">
                      {it.title}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-tiny text-muted-foreground">
                      <span className="inline-flex items-center gap-1 text-success">
                        <CheckCircle2 className="size-3" />
                        Delivered {fmtShort(parseISO(it.deliveredOn))}
                      </span>
                    </div>
                  </div>
                  <div
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-tiny",
                      it.publishOn
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border/70 text-muted-foreground",
                    )}
                  >
                    <Clock className="size-3" />
                    {it.publishOn ? fmtShort(parseISO(it.publishOn)) : "Unscheduled"}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
